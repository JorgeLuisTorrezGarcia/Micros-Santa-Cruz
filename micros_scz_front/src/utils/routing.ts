import type { Coordinates, RouteItem, TripLeg, TripOption, WalkSegment } from '../types.ts';
import {
  formatDistance,
  formatDuration,
  haversineDistance,
  projectPointOnSegment,
  slicePolylineBetweenDistances,
} from './geo.ts';
import { SpatialRouteIndex } from './spatial-index.ts';
import { streetIndex, StreetIndex } from './street-index.ts';

export interface RoutePlanningOptions {
  pointA: Coordinates;
  pointB: Coordinates;
  spatialIndex: SpatialRouteIndex;
  streetIndex?: StreetIndex;
  searchRadiusMeters?: number;
  maxTransferMeters?: number;
  enforceDirection?: boolean;
}

const WALK_SPEED_M_MIN = 80; // ~4.8 km/h
const BUS_SPEED_M_MIN = 260; // ~15.6 km/h (Santa Cruz urban traffic)
const BUS_INITIAL_WAIT_MIN = 3.5;
const TRANSFER_WAIT_MIN = 5.5;

function findClosestPointOnRoutePortion(
  route: RouteItem,
  minDistAlong: number,
  maxDistAlong: number,
  target: Coordinates
): { nearestPoint: Coordinates; distAlongMeters: number; distanceMeters: number } | null {
  if (maxDistAlong <= minDistAlong || route.coordinates.length < 2) return null;

  let best: { nearestPoint: Coordinates; distAlongMeters: number; distanceMeters: number } | null = null;
  let distAlong = 0;

  for (let i = 0; i < route.coordinates.length - 1; i++) {
    const p1 = route.coordinates[i];
    const p2 = route.coordinates[i + 1];
    const segLen = haversineDistance(p1[0], p1[1], p2[0], p2[1]);
    const segEndDist = distAlong + segLen;

    if (segLen > 0 && segEndDist >= minDistAlong && distAlong <= maxDistAlong) {
      const proj = projectPointOnSegment(target[0], target[1], p1[0], p1[1], p2[0], p2[1]);
      const rawDistAlong = distAlong + proj.fraction * segLen;
      const clampedDistAlong = Math.max(
        Math.max(distAlong, minDistAlong),
        Math.min(Math.min(segEndDist, maxDistAlong), rawDistAlong)
      );
      const frac = (clampedDistAlong - distAlong) / segLen;
      const pt: Coordinates = [
        p1[0] + frac * (p2[0] - p1[0]),
        p1[1] + frac * (p2[1] - p1[1]),
      ];
      const d = haversineDistance(target[0], target[1], pt[0], pt[1]);

      if (!best || d < best.distanceMeters) {
        best = {
          nearestPoint: pt,
          distAlongMeters: clampedDistAlong,
          distanceMeters: d,
        };
      }
    }

    distAlong = segEndDist;
  }

  return best;
}

export function calculateTrips(options: RoutePlanningOptions): TripOption[] {
  const {
    pointA,
    pointB,
    spatialIndex,
    // Optimal default values geared toward minimal walking
    searchRadiusMeters = 350,
    maxTransferMeters = 180,
    enforceDirection = true,
  } = options;

  const straightLineDist = haversineDistance(
    pointA[0],
    pointA[1],
    pointB[0],
    pointB[1]
  );

  const results: TripOption[] = [];
  const sIdx = options.streetIndex || streetIndex;

  const buildDirectWalkOption = (): TripOption => {
    const walkPath = sIdx.findWalkingPath(pointA, pointB);
    const walkMeters = walkPath.distanceMeters;
    const walkMinutes = walkMeters / WALK_SPEED_M_MIN;
    const viaStreets =
      walkPath.streetNames.length > 0
        ? ` por ${walkPath.streetNames.slice(0, 2).join(' y ')}`
        : '';

    return {
      id: 'walk-direct',
      type: 'walk-only',
      summary: 'Caminar directo',
      totalTimeMinutes: Math.max(1, Math.round(walkMinutes)),
      totalWalkMeters: walkMeters,
      totalRideMeters: 0,
      legs: [],
      walkSegments: [
        {
          from: pointA,
          to: pointB,
          distanceMeters: walkMeters,
          estimatedMinutes: Math.max(1, Math.round(walkMinutes)),
          instruction: `Camina directo ${formatDistance(walkMeters)}${viaStreets} hasta tu destino (aprox. ${formatDuration(walkMinutes)}).`,
          pathCoordinates: walkPath.coordinates,
          streetNames: walkPath.streetNames,
        },
      ],
      steps: [
        `🚶 Camina ${formatDistance(walkMeters)}${viaStreets} directamente hasta el punto de destino (≈ ${formatDuration(walkMinutes)}).`,
      ],
    };
  };

  // 1. Direct Walking Option if points are reasonably close (< 900m)
  if (straightLineDist <= 900) {
    results.push(buildDirectWalkOption());
  }

  // 2. Query candidates at A and B with adaptive radius (starts at 350m to minimize walking)
  let nearA = spatialIndex.findRoutesNearPoint(pointA, searchRadiusMeters);
  let nearB = spatialIndex.findRoutesNearPoint(pointB, searchRadiusMeters);

  // If no candidates found with tight radius, expand progressively up to 1200m
  if (nearA.length === 0) nearA = spatialIndex.findRoutesNearPoint(pointA, 550);
  if (nearA.length === 0) nearA = spatialIndex.findRoutesNearPoint(pointA, 850);
  if (nearA.length === 0) nearA = spatialIndex.findRoutesNearPoint(pointA, 1200);

  if (nearB.length === 0) nearB = spatialIndex.findRoutesNearPoint(pointB, 550);
  if (nearB.length === 0) nearB = spatialIndex.findRoutesNearPoint(pointB, 850);
  if (nearB.length === 0) nearB = spatialIndex.findRoutesNearPoint(pointB, 1200);

  const destinationUncovered = nearB.length === 0;
  const originUncovered = nearA.length === 0;

  // Helper to construct a direct bus+walk trip option
  const pushDirectBusOption = (
    routeId: string,
    boardPoint: Coordinates,
    boardDistAlong: number,
    alightPoint: Coordinates,
    alightDistAlong: number,
    isFallbackExtendedWalk = false
  ) => {
    const rideDist = Math.abs(alightDistAlong - boardDistAlong);
    if (rideDist < 120) return;

    const route = spatialIndex.getRoute(routeId);
    if (!route) return;

    const walkPathA = sIdx.findWalkingPath(pointA, boardPoint);
    const walkPathB = sIdx.findWalkingPath(alightPoint, pointB);

    const walkA = walkPathA.distanceMeters;
    const walkB = walkPathB.distanceMeters;
    const totalWalk = walkA + walkB;

    // For uncovered fallback stops, ensure the bus genuinely saves walking compared to walking direct
    if (isFallbackExtendedWalk && totalWalk >= straightLineDist - 120) {
      return;
    }

    const rideMinutes = rideDist / BUS_SPEED_M_MIN;
    const walkMinutes = totalWalk / WALK_SPEED_M_MIN;
    const totalTime = walkMinutes + rideMinutes + BUS_INITIAL_WAIT_MIN;

    const pathCoords = slicePolylineBetweenDistances(
      route.coordinates,
      boardDistAlong,
      alightDistAlong
    );

    const leg: TripLeg = {
      routeId: route.id,
      routeLabel: route.label,
      direction: route.direction,
      color: route.color,
      boardPoint,
      alightPoint,
      boardDistAlongMeters: boardDistAlong,
      alightDistAlongMeters: alightDistAlong,
      rideDistanceMeters: rideDist,
      estimatedRideMinutes: Math.round(rideMinutes),
      pathCoordinates: pathCoords,
    };

    const dirTag = route.direction === 1 ? 'S1 (Ida)' : 'S2 (Vuelta)';
    const streetA = walkPathA.streetNames[0] || '';
    const streetB = walkPathB.streetNames[0] || '';

    const boardText = streetA ? ` sobre ${streetA}` : '';
    const alightText = streetB ? ` cerca de ${streetB}` : '';
    const walkAText = streetA ? `por ${streetA} hacia la parada` : `hacia la parada`;
    const walkBText = streetB ? `por ${streetB} hasta tu destino` : `hasta tu destino`;

    const walkSegments: WalkSegment[] = [
      {
        from: pointA,
        to: boardPoint,
        distanceMeters: walkA,
        estimatedMinutes: Math.max(1, Math.round(walkA / WALK_SPEED_M_MIN)),
        instruction: `Camina ${formatDistance(walkA)} ${walkAText} para tomar ${route.label}.`,
        pathCoordinates: walkPathA.coordinates,
        streetNames: walkPathA.streetNames,
      },
      {
        from: alightPoint,
        to: pointB,
        distanceMeters: walkB,
        estimatedMinutes: Math.max(1, Math.round(walkB / WALK_SPEED_M_MIN)),
        instruction: `Camina ${formatDistance(walkB)} ${walkBText}.`,
        pathCoordinates: walkPathB.coordinates,
        streetNames: walkPathB.streetNames,
      },
    ];

    results.push({
      id: `direct-${route.id}`,
      type: 'direct',
      summary: `${route.label} (${dirTag})`,
      totalTimeMinutes: Math.max(1, Math.round(totalTime)),
      totalWalkMeters: Math.round(totalWalk),
      totalRideMeters: Math.round(rideDist),
      legs: [leg],
      walkSegments,
      steps: [
        `🚶 Camina ${formatDistance(walkA)} hasta la parada de ${route.label}${boardText}.`,
        `🚌 Sube a ${route.label} (${dirTag}) y viaja ${formatDistance(rideDist)} (≈ ${formatDuration(rideMinutes)}).`,
        isFallbackExtendedWalk
          ? `🛑 Bájate en la parada más cercana al destino${alightText}.`
          : `🛑 Bájate en la parada${alightText}.`,
        `🚶 Camina ${formatDistance(walkB)} ${walkBText}.`,
      ],
    });
  };

  // Fallback when destination B has no routes within 1200m:
  // Ride the closest micro near A as close as possible toward B, then walk the final stretch.
  if (destinationUncovered && nearA.length > 0) {
    for (const candA of nearA.slice(0, 12)) {
      const route = spatialIndex.getRoute(candA.routeId);
      if (!route) continue;

      const forwardBest = findClosestPointOnRoutePortion(
        route,
        candA.distAlongMeters + 120,
        route.totalDistanceMeters,
        pointB
      );
      let chosen = forwardBest;

      if (!enforceDirection) {
        const backwardBest = findClosestPointOnRoutePortion(
          route,
          0,
          Math.max(0, candA.distAlongMeters - 120),
          pointB
        );
        if (backwardBest && (!chosen || backwardBest.distanceMeters < chosen.distanceMeters)) {
          chosen = backwardBest;
        }
      }

      if (chosen) {
        pushDirectBusOption(
          route.id,
          candA.nearestPoint,
          candA.distAlongMeters,
          chosen.nearestPoint,
          chosen.distAlongMeters,
          true
        );
      }
    }

    // Also search wider around B (up to 4500m) so transfer loop below can combine a 1-transfer closer to B
    nearB = spatialIndex.findRoutesNearPoint(pointB, 2500);
    if (nearB.length === 0) nearB = spatialIndex.findRoutesNearPoint(pointB, 4500);
  }

  // Fallback when origin A has no routes within 1200m:
  // Walk from A to the closest boarding point of a route serving B.
  if (originUncovered && nearB.length > 0) {
    for (const candB of nearB.slice(0, 12)) {
      const route = spatialIndex.getRoute(candB.routeId);
      if (!route) continue;

      const priorBest = findClosestPointOnRoutePortion(
        route,
        0,
        Math.max(0, candB.distAlongMeters - 120),
        pointA
      );
      let chosen = priorBest;

      if (!enforceDirection) {
        const afterBest = findClosestPointOnRoutePortion(
          route,
          candB.distAlongMeters + 120,
          route.totalDistanceMeters,
          pointA
        );
        if (afterBest && (!chosen || afterBest.distanceMeters < chosen.distanceMeters)) {
          chosen = afterBest;
        }
      }

      if (chosen) {
        pushDirectBusOption(
          route.id,
          chosen.nearestPoint,
          chosen.distAlongMeters,
          candB.nearestPoint,
          candB.distAlongMeters,
          true
        );
      }
    }

    nearA = spatialIndex.findRoutesNearPoint(pointA, 2500);
    if (nearA.length === 0) nearA = spatialIndex.findRoutesNearPoint(pointA, 4500);
  }

  // Fallback when BOTH A and B are outside 1200m coverage
  if (originUncovered && destinationUncovered && results.length === 0) {
    nearA = spatialIndex.findRoutesNearPoint(pointA, 3000);
    nearB = spatialIndex.findRoutesNearPoint(pointB, 3000);
  }

  if (nearA.length === 0 || nearB.length === 0) {
    if (results.length === 0) {
      results.push(buildDirectWalkOption());
    }
    return results.slice(0, 8);
  }

  const mapB = new Map(nearB.map((nb) => [nb.routeId, nb]));

  // Direct routes: lines passing near A and near B
  for (const candA of nearA) {
    const candB = mapB.get(candA.routeId);
    if (!candB) continue;

    // Directionality check
    const isDirectionValid = !enforceDirection || candA.distAlongMeters < candB.distAlongMeters;
    if (!isDirectionValid) continue;

    pushDirectBusOption(
      candA.routeId,
      candA.nearestPoint,
      candA.distAlongMeters,
      candB.nearestPoint,
      candB.distAlongMeters,
      destinationUncovered || originUncovered
    );
  }

  // 3. One-Transfer Routes (Only if needed or to find faster/low-walk alternatives)
  // Limit to routes passing closest to A and B
  const topA = nearA.slice(0, 8);
  const topB = nearB.slice(0, 8);

  for (const candA of topA) {
    const route1 = spatialIndex.getRoute(candA.routeId);
    if (!route1) continue;

    const r1Len = route1.totalDistanceMeters;
    const startMeters = candA.distAlongMeters;
    const sampleStepMeters = 180; // fine sampling to find optimal transfer with minimal walk

    const samples: { point: Coordinates; distAlong: number }[] = [];
    let curDist = startMeters + sampleStepMeters;
    while (curDist < r1Len - 80) {
      const ptSlice = slicePolylineBetweenDistances(route1.coordinates, curDist, curDist + 1);
      if (ptSlice.length > 0) {
        samples.push({ point: ptSlice[0], distAlong: curDist });
      }
      curDist += sampleStepMeters;
    }

    if (samples.length === 0) continue;

    for (const candB of topB) {
      if (candB.routeLabel === candA.routeLabel) continue;

      const route2 = spatialIndex.getRoute(candB.routeId);
      if (!route2) continue;

      let bestTransfer: {
        sampleDistAlong1: number;
        transferWalkMeters: number;
        alight1: Coordinates;
        board2: Coordinates;
        boardDistAlong2: number;
        totalMins: number;
        walkPathTransfer: ReturnType<StreetIndex['findWalkingPath']>;
      } | null = null;

      for (const smp of samples) {
        const nearOnR2 = spatialIndex.findRoutesNearPoint(smp.point, maxTransferMeters);
        const match2 = nearOnR2.find((m) => m.routeId === route2.id);

        if (!match2) continue;

        if (enforceDirection && match2.distAlongMeters >= candB.distAlongMeters) {
          continue;
        }

        const ride1 = smp.distAlong - candA.distAlongMeters;
        const ride2 = candB.distAlongMeters - match2.distAlongMeters;
        if (ride1 < 120 || ride2 < 120) continue;

        // Trace street path for transfer
        const walkPathTransfer = sIdx.findWalkingPath(smp.point, match2.nearestPoint);
        const transferWalk = walkPathTransfer.distanceMeters;

        // Keep transfer walking reasonable
        if (transferWalk > 320) continue;

        const totalWalk = candA.distanceMeters + transferWalk + candB.distanceMeters;
        const totalRide = ride1 + ride2;

        const estMinutes =
          totalWalk / WALK_SPEED_M_MIN +
          totalRide / BUS_SPEED_M_MIN +
          BUS_INITIAL_WAIT_MIN +
          TRANSFER_WAIT_MIN;

        if (!bestTransfer || estMinutes < bestTransfer.totalMins) {
          bestTransfer = {
            sampleDistAlong1: smp.distAlong,
            transferWalkMeters: transferWalk,
            alight1: smp.point,
            board2: match2.nearestPoint,
            boardDistAlong2: match2.distAlongMeters,
            totalMins: estMinutes,
            walkPathTransfer,
          };
        }
      }

      if (bestTransfer) {
        const rideDist1 = bestTransfer.sampleDistAlong1 - candA.distAlongMeters;
        const rideDist2 = candB.distAlongMeters - bestTransfer.boardDistAlong2;
        const rideMins1 = rideDist1 / BUS_SPEED_M_MIN;
        const rideMins2 = rideDist2 / BUS_SPEED_M_MIN;

        const walkPathA = sIdx.findWalkingPath(pointA, candA.nearestPoint);
        const walkPathB = sIdx.findWalkingPath(candB.nearestPoint, pointB);

        const walkA = walkPathA.distanceMeters;
        const walkB = walkPathB.distanceMeters;
        const totalWalk = walkA + bestTransfer.transferWalkMeters + walkB;
        const totalRide = rideDist1 + rideDist2;

        // Skip transfer trips where user has to walk excessively (relax cap only when endpoint is outside bus coverage)
        const maxTransferTotalWalk =
          destinationUncovered || originUncovered
            ? Math.max(850, straightLineDist - 120)
            : 850;
        if (totalWalk > maxTransferTotalWalk) continue;

        const path1 = slicePolylineBetweenDistances(
          route1.coordinates,
          candA.distAlongMeters,
          bestTransfer.sampleDistAlong1
        );
        const path2 = slicePolylineBetweenDistances(
          route2.coordinates,
          bestTransfer.boardDistAlong2,
          candB.distAlongMeters
        );

        const leg1: TripLeg = {
          routeId: route1.id,
          routeLabel: route1.label,
          direction: route1.direction,
          color: route1.color,
          boardPoint: candA.nearestPoint,
          alightPoint: bestTransfer.alight1,
          boardDistAlongMeters: candA.distAlongMeters,
          alightDistAlongMeters: bestTransfer.sampleDistAlong1,
          rideDistanceMeters: rideDist1,
          estimatedRideMinutes: Math.round(rideMins1),
          pathCoordinates: path1,
        };

        const leg2: TripLeg = {
          routeId: route2.id,
          routeLabel: route2.label,
          direction: route2.direction,
          color: route2.color,
          boardPoint: bestTransfer.board2,
          alightPoint: candB.nearestPoint,
          boardDistAlongMeters: bestTransfer.boardDistAlong2,
          alightDistAlongMeters: candB.distAlongMeters,
          rideDistanceMeters: rideDist2,
          estimatedRideMinutes: Math.round(rideMins2),
          pathCoordinates: path2,
        };

        const streetA = walkPathA.streetNames[0] || '';
        const streetB = walkPathB.streetNames[0] || '';
        const streetTrans = bestTransfer.walkPathTransfer.streetNames[0] || '';

        const board1Text = streetA ? ` sobre ${streetA}` : '';
        const alight2Text = streetB ? ` cerca de ${streetB}` : '';
        const transText = streetTrans ? ` por ${streetTrans}` : '';

        results.push({
          id: `transfer-${route1.id}-${route2.id}`,
          type: 'transfer',
          summary: `${route1.label} → ${route2.label}`,
          totalTimeMinutes: Math.max(1, Math.round(bestTransfer.totalMins)),
          totalWalkMeters: Math.round(totalWalk),
          totalRideMeters: Math.round(totalRide),
          legs: [leg1, leg2],
          walkSegments: [
            {
              from: pointA,
              to: candA.nearestPoint,
              distanceMeters: walkA,
              estimatedMinutes: Math.max(1, Math.round(walkA / WALK_SPEED_M_MIN)),
              instruction: `Camina ${formatDistance(walkA)}${board1Text} hacia la parada de ${route1.label}.`,
              pathCoordinates: walkPathA.coordinates,
              streetNames: walkPathA.streetNames,
            },
            {
              from: bestTransfer.alight1,
              to: bestTransfer.board2,
              distanceMeters: bestTransfer.transferWalkMeters,
              estimatedMinutes: Math.max(1, Math.round(bestTransfer.transferWalkMeters / WALK_SPEED_M_MIN)),
              instruction: `Transbordo: camina ${formatDistance(bestTransfer.transferWalkMeters)}${transText} para tomar ${route2.label}.`,
              pathCoordinates: bestTransfer.walkPathTransfer.coordinates,
              streetNames: bestTransfer.walkPathTransfer.streetNames,
            },
            {
              from: candB.nearestPoint,
              to: pointB,
              distanceMeters: walkB,
              estimatedMinutes: Math.max(1, Math.round(walkB / WALK_SPEED_M_MIN)),
              instruction: `Camina ${formatDistance(walkB)}${alight2Text} hasta tu destino B.`,
              pathCoordinates: walkPathB.coordinates,
              streetNames: walkPathB.streetNames,
            },
          ],
          steps: [
            `🚶 Camina ${formatDistance(walkA)} hasta la parada de ${route1.label}${board1Text}.`,
            `🚌 Toma ${route1.label} y viaja ${formatDistance(rideDist1)} (≈ ${formatDuration(rideMins1)}).`,
            `🛑 Bájate en el punto de transbordo.`,
            `🔄 Camina ${formatDistance(bestTransfer.transferWalkMeters)}${transText} para transbordar a ${route2.label}.`,
            `🚌 Sube a ${route2.label} y viaja ${formatDistance(rideDist2)} (≈ ${formatDuration(rideMins2)}).`,
            `🛑 Bájate${alight2Text} y camina ${formatDistance(walkB)} hasta B.`,
          ],
        });
      }
    }
  }

  // 4. Scoring strictly prioritizing MINIMAL WALKING DISTANCE ("para no me permita caminar mucho")
  // Heavy penalty for walking meters: 100m walk is penalised equivalent to ~4.5 minutes
  const seenCombos = new Set<string>();

  const ranked = results
    .sort((a, b) => {
      // Prioritize minimal walk distance as requested
      const walkScoreA = (a.totalWalkMeters * 3.5) / WALK_SPEED_M_MIN;
      const walkScoreB = (b.totalWalkMeters * 3.5) / WALK_SPEED_M_MIN;

      // Transfer penalty so direct routes are preferred unless transfer saves huge walking
      const transferPenaltyA = a.type === 'transfer' ? 9 : 0;
      const transferPenaltyB = b.type === 'transfer' ? 9 : 0;

      const rideTimeA = a.totalRideMeters / BUS_SPEED_M_MIN;
      const rideTimeB = b.totalRideMeters / BUS_SPEED_M_MIN;

      const totalScoreA = walkScoreA + rideTimeA + transferPenaltyA;
      const totalScoreB = walkScoreB + rideTimeB + transferPenaltyB;

      return totalScoreA - totalScoreB;
    })
    .filter((trip) => {
      const key = trip.legs.map((l) => `${l.routeLabel}_S${l.direction}`).join('>');
      if (!key) return true; // walk only
      if (seenCombos.has(key)) return false;
      seenCombos.add(key);
      return true;
    });

  if (ranked.length === 0) {
    return [buildDirectWalkOption()];
  }

  return ranked.slice(0, 8);
}
