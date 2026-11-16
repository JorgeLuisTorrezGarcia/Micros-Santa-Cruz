import RBush from 'rbush';
import type { Coordinates, StreetSegment } from '../types.ts';
import { haversineDistance, projectPointOnSegment } from './geo.ts';

export interface StreetCandidate {
  streetName: string;
  distanceMeters: number;
  nearestPoint: Coordinates;
  segment: StreetSegment;
}

export interface WalkingPathResult {
  coordinates: Coordinates[];
  distanceMeters: number;
  streetNames: string[];
}

interface GraphNode {
  id: string;
  coord: Coordinates;
  neighbors: {
    targetId: string;
    distanceMeters: number;
    streetName: string;
  }[];
}

interface SubSegmentRecord {
  segment: StreetSegment;
  n1Id: string;
  n2Id: string;
}

interface IndexedRawSegment extends StreetSegment {
  _idx: number;
}

interface IndexedSubSegment extends StreetSegment {
  _subIdx: number;
}

function segmentIntersectionParams(
  a1: Coordinates,
  a2: Coordinates,
  b1: Coordinates,
  b2: Coordinates
): { t: number; u: number } | null {
  const dx1 = a2[0] - a1[0];
  const dy1 = a2[1] - a1[1];
  const dx2 = b2[0] - b1[0];
  const dy2 = b2[1] - b1[1];
  const denom = dx1 * dy2 - dy1 * dx2;
  if (Math.abs(denom) < 1e-12) return null;

  const dx3 = b1[0] - a1[0];
  const dy3 = b1[1] - a1[1];
  const t = (dx3 * dy2 - dy3 * dx2) / denom;
  const u = (dx3 * dy1 - dy3 * dx1) / denom;

  if (t >= -1e-6 && t <= 1 + 1e-6 && u >= -1e-6 && u <= 1 + 1e-6) {
    return {
      t: Math.max(0, Math.min(1, t)),
      u: Math.max(0, Math.min(1, u)),
    };
  }
  return null;
}

export class StreetIndex {
  private tree = new RBush<IndexedSubSegment>();
  private isLoaded = false;
  private streetCount = 0;
  private nodes = new Map<string, GraphNode>();
  private subSegments: SubSegmentRecord[] = [];
  private nodeSubSegments = new Map<string, number[]>();

  public buildIndex(segments: StreetSegment[]) {
    this.tree.clear();
    this.nodes.clear();
    this.subSegments = [];
    this.nodeSubSegments.clear();
    this.streetCount = segments.length;

    if (segments.length === 0) {
      this.isLoaded = true;
      return;
    }

    // 1. Node the street network: detect segment crossings and T-junctions (within ~18m)
    const indexedRaw: IndexedRawSegment[] = segments.map((s, idx) => ({
      ...s,
      _idx: idx,
    }));
    const rawTree = new RBush<IndexedRawSegment>();
    rawTree.load(indexedRaw);

    const splits: number[][] = segments.map(() => []);
    const epsDeg = 0.00018; // ~18m bbox padding

    for (let i = 0; i < indexedRaw.length; i++) {
      const s = indexedRaw[i];
      const cands = rawTree.search({
        minX: s.minX - epsDeg,
        minY: s.minY - epsDeg,
        maxX: s.maxX + epsDeg,
        maxY: s.maxY + epsDeg,
      });

      for (const c of cands) {
        const j = c._idx;
        if (j <= i) continue;

        const inter = segmentIntersectionParams(s.p1, s.p2, c.p1, c.p2);
        if (inter) {
          if (inter.t > 0.0005 && inter.t < 0.9995) splits[i].push(inter.t);
          if (inter.u > 0.0005 && inter.u < 0.9995) splits[j].push(inter.u);
        } else {
          // Check T-junctions: endpoint of s near segment c
          for (const ep of [s.p1, s.p2]) {
            const proj = projectPointOnSegment(ep[0], ep[1], c.p1[0], c.p1[1], c.p2[0], c.p2[1]);
            if (proj.distanceMeters <= 18) {
              const dx = c.p2[0] - c.p1[0];
              const dy = c.p2[1] - c.p1[1];
              const len2 = dx * dx + dy * dy;
              const u =
                len2 > 0
                  ? ((proj.nearest[0] - c.p1[0]) * dx + (proj.nearest[1] - c.p1[1]) * dy) / len2
                  : 0;
              if (u > 0.0005 && u < 0.9995) {
                splits[j].push(u);
              }
            }
          }
          // Check T-junctions: endpoint of c near segment s
          for (const ep of [c.p1, c.p2]) {
            const proj = projectPointOnSegment(ep[0], ep[1], s.p1[0], s.p1[1], s.p2[0], s.p2[1]);
            if (proj.distanceMeters <= 18) {
              const dx = s.p2[0] - s.p1[0];
              const dy = s.p2[1] - s.p1[1];
              const len2 = dx * dx + dy * dy;
              const t =
                len2 > 0
                  ? ((proj.nearest[0] - s.p1[0]) * dx + (proj.nearest[1] - s.p1[1]) * dy) / len2
                  : 0;
              if (t > 0.0005 && t < 0.9995) {
                splits[i].push(t);
              }
            }
          }
        }
      }
    }

    // 2. Materialize split sub-segments
    const nodedSegments: StreetSegment[] = [];
    for (let i = 0; i < segments.length; i++) {
      const s = segments[i];
      const ts = [0, ...splits[i].sort((a, b) => a - b), 1];
      const pts: Coordinates[] = [];

      for (const t of ts) {
        const pt: Coordinates = [
          s.p1[0] + t * (s.p2[0] - s.p1[0]),
          s.p1[1] + t * (s.p2[1] - s.p1[1]),
        ];
        if (
          pts.length === 0 ||
          haversineDistance(pts[pts.length - 1][0], pts[pts.length - 1][1], pt[0], pt[1]) > 0.5
        ) {
          pts.push(pt);
        }
      }

      for (let k = 0; k < pts.length - 1; k++) {
        const p1 = pts[k];
        const p2 = pts[k + 1];
        nodedSegments.push({
          minX: Math.min(p1[0], p2[0]),
          minY: Math.min(p1[1], p2[1]),
          maxX: Math.max(p1[0], p2[0]),
          maxY: Math.max(p1[1], p2[1]),
          name: s.name,
          type: s.type,
          p1,
          p2,
        });
      }
    }

    // 3. Build topological graph snapping nodes within 18m via 3x3 cell neighborhood
    const cellSize = 0.00018;
    const grid = new Map<string, string[]>();
    let nextNodeId = 1;

    const getOrCreateNode = (coord: Coordinates): GraphNode => {
      const gx = Math.round(coord[0] / cellSize);
      const gy = Math.round(coord[1] / cellSize);
      let bestNode: GraphNode | null = null;
      let bestDist = 18;

      for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
          const list = grid.get(`${gx + dx}_${gy + dy}`);
          if (!list) continue;
          for (const nid of list) {
            const candidateNode = this.nodes.get(nid)!;
            const d = haversineDistance(
              coord[0],
              coord[1],
              candidateNode.coord[0],
              candidateNode.coord[1]
            );
            if (d < bestDist) {
              bestDist = d;
              bestNode = candidateNode;
            }
          }
        }
      }

      if (bestNode) return bestNode;

      const id = `n${nextNodeId++}`;
      const node: GraphNode = { id, coord, neighbors: [] };
      this.nodes.set(id, node);
      const k = `${gx}_${gy}`;
      const bucket = grid.get(k);
      if (bucket) bucket.push(id);
      else grid.set(k, [id]);
      return node;
    };

    const linkNodeSub = (nodeId: string, subIdx: number) => {
      let arr = this.nodeSubSegments.get(nodeId);
      if (!arr) {
        arr = [];
        this.nodeSubSegments.set(nodeId, arr);
      }
      arr.push(subIdx);
    };

    const indexedSub: IndexedSubSegment[] = [];
    for (const seg of nodedSegments) {
      const n1 = getOrCreateNode(seg.p1);
      const n2 = getOrCreateNode(seg.p2);
      const subIdx = this.subSegments.length;
      this.subSegments.push({ segment: seg, n1Id: n1.id, n2Id: n2.id });
      indexedSub.push({ ...seg, _subIdx: subIdx });

      linkNodeSub(n1.id, subIdx);
      if (n1.id !== n2.id) {
        linkNodeSub(n2.id, subIdx);
        const d = haversineDistance(n1.coord[0], n1.coord[1], n2.coord[0], n2.coord[1]);
        n1.neighbors.push({
          targetId: n2.id,
          distanceMeters: d,
          streetName: seg.name,
        });
        n2.neighbors.push({
          targetId: n1.id,
          distanceMeters: d,
          streetName: seg.name,
        });
      }
    }

    this.tree.load(indexedSub);
    this.isLoaded = true;
  }

  public get count(): number {
    return this.streetCount;
  }

  public get loaded(): boolean {
    return this.isLoaded;
  }

  private findNearSubSegments(
    coord: Coordinates,
    searchRadiusMeters: number,
    limit: number = 4
  ): { subIdx: number; streetName: string; distanceMeters: number; nearestPoint: Coordinates; segment: StreetSegment }[] {
    if (!this.isLoaded || this.subSegments.length === 0) return [];

    const [lon, lat] = coord;
    const degLat = searchRadiusMeters / 111320;
    const degLon = searchRadiusMeters / (111320 * Math.max(0.1, Math.cos((lat * Math.PI) / 180)));

    const candidates = this.tree.search({
      minX: lon - degLon,
      minY: lat - degLat,
      maxX: lon + degLon,
      maxY: lat + degLat,
    });

    const scored: {
      subIdx: number;
      streetName: string;
      distanceMeters: number;
      nearestPoint: Coordinates;
      segment: StreetSegment;
    }[] = [];

    for (const cand of candidates) {
      const proj = projectPointOnSegment(
        lon,
        lat,
        cand.p1[0],
        cand.p1[1],
        cand.p2[0],
        cand.p2[1]
      );
      if (proj.distanceMeters <= searchRadiusMeters) {
        scored.push({
          subIdx: cand._subIdx,
          streetName: cand.name,
          distanceMeters: proj.distanceMeters,
          nearestPoint: proj.nearest,
          segment: cand,
        });
      }
    }

    scored.sort((a, b) => a.distanceMeters - b.distanceMeters);
    return scored.slice(0, limit);
  }

  /**
   * Finds the nearest street to a coordinate within searchRadiusMeters.
   */
  public findNearestStreet(
    coord: Coordinates,
    searchRadiusMeters = 300
  ): StreetCandidate | null {
    const matches = this.findNearSubSegments(coord, searchRadiusMeters, 1);
    if (matches.length === 0) return null;
    const best = matches[0];
    return {
      streetName: best.streetName,
      distanceMeters: Math.round(best.distanceMeters),
      nearestPoint: best.nearestPoint,
      segment: best.segment,
    };
  }

  private finalizeCoords(rawCoords: Coordinates[]): { coordinates: Coordinates[]; distanceMeters: number } {
    const cleanedCoords: Coordinates[] = [];
    for (let i = 0; i < rawCoords.length; i++) {
      const pt = rawCoords[i];
      if (i === 0) {
        cleanedCoords.push(pt);
      } else if (i === rawCoords.length - 1) {
        const last = cleanedCoords[cleanedCoords.length - 1];
        if (haversineDistance(last[0], last[1], pt[0], pt[1]) < 1.5 && cleanedCoords.length > 1) {
          cleanedCoords[cleanedCoords.length - 1] = pt;
        } else {
          cleanedCoords.push(pt);
        }
      } else {
        const last = cleanedCoords[cleanedCoords.length - 1];
        if (haversineDistance(last[0], last[1], pt[0], pt[1]) >= 1.5) {
          cleanedCoords.push(pt);
        }
      }
    }

    let totalMeters = 0;
    for (let i = 0; i < cleanedCoords.length - 1; i++) {
      totalMeters += haversineDistance(
        cleanedCoords[i][0],
        cleanedCoords[i][1],
        cleanedCoords[i + 1][0],
        cleanedCoords[i + 1][1]
      );
    }

    return {
      coordinates: cleanedCoords,
      distanceMeters: Math.round(totalMeters),
    };
  }

  private runAStar(
    from: Coordinates,
    to: Coordinates,
    fromCands: { subIdx: number; streetName: string; distanceMeters: number; nearestPoint: Coordinates }[],
    toCands: { subIdx: number; streetName: string; distanceMeters: number; nearestPoint: Coordinates }[]
  ): WalkingPathResult | null {
    const virtualNeighbors = new Map<
      string,
      { targetId: string; distanceMeters: number; streetName: string }[]
    >();
    const virtCoords = new Map<string, Coordinates>();

    const addVirt = (id: string, targetId: string, dist: number, streetName: string) => {
      let list = virtualNeighbors.get(id);
      if (!list) {
        list = [];
        virtualNeighbors.set(id, list);
      }
      list.push({ targetId, distanceMeters: dist, streetName });
    };

    virtCoords.set('__START__', from);
    virtCoords.set('__END__', to);

    for (const cf of fromCands) {
      const sub = this.subSegments[cf.subIdx];
      const p = cf.nearestPoint;
      const sNodeId = `__S_${cf.subIdx}`;
      virtCoords.set(sNodeId, p);
      addVirt('__START__', sNodeId, cf.distanceMeters, cf.streetName);

      const n1 = this.nodes.get(sub.n1Id)!;
      const n2 = this.nodes.get(sub.n2Id)!;
      addVirt(
        sNodeId,
        n1.id,
        haversineDistance(p[0], p[1], n1.coord[0], n1.coord[1]),
        cf.streetName
      );
      addVirt(
        sNodeId,
        n2.id,
        haversineDistance(p[0], p[1], n2.coord[0], n2.coord[1]),
        cf.streetName
      );

      for (const ct of toCands) {
        if (ct.subIdx === cf.subIdx) {
          const eNodeId = `__E_${ct.subIdx}`;
          addVirt(
            sNodeId,
            eNodeId,
            haversineDistance(p[0], p[1], ct.nearestPoint[0], ct.nearestPoint[1]),
            cf.streetName
          );
        }
      }
    }

    for (const ct of toCands) {
      const sub = this.subSegments[ct.subIdx];
      const p = ct.nearestPoint;
      const eNodeId = `__E_${ct.subIdx}`;
      virtCoords.set(eNodeId, p);

      const n1 = this.nodes.get(sub.n1Id)!;
      const n2 = this.nodes.get(sub.n2Id)!;
      addVirt(
        n1.id,
        eNodeId,
        haversineDistance(n1.coord[0], n1.coord[1], p[0], p[1]),
        ct.streetName
      );
      addVirt(
        n2.id,
        eNodeId,
        haversineDistance(n2.coord[0], n2.coord[1], p[0], p[1]),
        ct.streetName
      );
      addVirt(eNodeId, '__END__', ct.distanceMeters, ct.streetName);
    }

    const getCoord = (id: string): Coordinates => virtCoords.get(id) || this.nodes.get(id)!.coord;

    const gScore = new Map<string, number>([['__START__', 0]]);
    const prev = new Map<string, { id: string; streetName: string }>();
    const closed = new Set<string>();
    const open: { id: string; f: number }[] = [
      { id: '__START__', f: haversineDistance(from[0], from[1], to[0], to[1]) },
    ];

    let found = false;
    let iterations = 0;

    while (open.length > 0 && iterations < 8000) {
      iterations++;
      open.sort((a, b) => a.f - b.f);
      const curr = open.shift()!;

      if (curr.id === '__END__') {
        found = true;
        break;
      }
      if (closed.has(curr.id)) continue;
      closed.add(curr.id);

      const gCurr = gScore.get(curr.id)!;
      const baseNode = this.nodes.get(curr.id);
      const vNbrs = virtualNeighbors.get(curr.id);

      const processEdge = (edge: { targetId: string; distanceMeters: number; streetName: string }) => {
        if (closed.has(edge.targetId)) return;
        const ng = gCurr + edge.distanceMeters;
        const existing = gScore.get(edge.targetId);
        if (existing === undefined || ng < existing) {
          gScore.set(edge.targetId, ng);
          prev.set(edge.targetId, { id: curr.id, streetName: edge.streetName });
          const tc = getCoord(edge.targetId);
          const h = haversineDistance(tc[0], tc[1], to[0], to[1]);
          open.push({ id: edge.targetId, f: ng + h });
        }
      };

      if (baseNode) {
        for (const edge of baseNode.neighbors) processEdge(edge);
      }
      if (vNbrs) {
        for (const edge of vNbrs) processEdge(edge);
      }
    }

    if (!found) return null;

    const rawCoords: Coordinates[] = [];
    const streetNamesOrdered: string[] = [];
    let cur: string | null = '__END__';

    while (cur) {
      rawCoords.unshift(getCoord(cur));
      const p = prev.get(cur);
      if (p) {
        if (p.streetName) streetNamesOrdered.unshift(p.streetName);
        cur = p.id;
      } else {
        cur = null;
      }
    }

    const { coordinates, distanceMeters } = this.finalizeCoords(rawCoords);
    return {
      coordinates,
      distanceMeters,
      streetNames: Array.from(new Set(streetNamesOrdered)).filter(Boolean),
    };
  }

  /**
   * Walks along connected GeoJSON street segments starting near `start` (<= 60m)
   * up to the optimal exit point toward `end`, then finishes in a straight line to `end`.
   * Rejects backwards loops or sideways hooks that do not meaningfully advance toward `end`.
   */
  private findBestPartialStreetPath(
    start: Coordinates,
    end: Coordinates,
    nearStart: { subIdx: number; streetName: string; distanceMeters: number; nearestPoint: Coordinates }[]
  ): WalkingPathResult | null {
    const directDist = haversineDistance(start[0], start[1], end[0], end[1]);
    if (nearStart.length === 0 || directDist < 20) return null;

    const tightStart = nearStart.filter((c) => c.distanceMeters <= nearStart[0].distanceMeters + 10);
    const virtualNeighbors = new Map<
      string,
      { targetId: string; distanceMeters: number; streetName: string }[]
    >();
    const virtCoords = new Map<string, Coordinates>();
    const startSnapPointByNode = new Map<string, Coordinates>();

    const addVirt = (id: string, targetId: string, dist: number, streetName: string) => {
      let list = virtualNeighbors.get(id);
      if (!list) {
        list = [];
        virtualNeighbors.set(id, list);
      }
      list.push({ targetId, distanceMeters: dist, streetName });
    };

    virtCoords.set('__START__', start);

    for (const cf of tightStart) {
      const sub = this.subSegments[cf.subIdx];
      const p = cf.nearestPoint;
      const sNodeId = `__S_${cf.subIdx}`;
      virtCoords.set(sNodeId, p);
      startSnapPointByNode.set(sNodeId, p);
      addVirt('__START__', sNodeId, cf.distanceMeters, cf.streetName);

      const n1 = this.nodes.get(sub.n1Id)!;
      const n2 = this.nodes.get(sub.n2Id)!;
      addVirt(sNodeId, n1.id, haversineDistance(p[0], p[1], n1.coord[0], n1.coord[1]), cf.streetName);
      addVirt(sNodeId, n2.id, haversineDistance(p[0], p[1], n2.coord[0], n2.coord[1]), cf.streetName);
    }

    const getCoord = (id: string): Coordinates => virtCoords.get(id) || this.nodes.get(id)!.coord;
    const maxBudget = Math.min(Math.max(directDist * 1.38, directDist + 30), 2500);
    const maxAllowedTotal = Math.max(directDist * 1.42, directDist + 45);

    const gScore = new Map<string, number>([['__START__', 0]]);
    const prev = new Map<string, { id: string; streetName: string }>();
    const entrySnap = new Map<string, Coordinates>();
    const closed = new Set<string>();
    const open: { id: string; g: number }[] = [{ id: '__START__', g: 0 }];

    type PartialExit = {
      nodeId: string;
      exitCoord: Coordinates;
      extraStreetDist: number;
      extraStreetName: string;
      remStraight: number;
      totalScore: number;
    };

    const bestRef: { current: PartialExit | null } = { current: null };

    const considerCandidate = (
      nodeId: string,
      exitCoord: Coordinates,
      gNode: number,
      extraStreetDist: number,
      extraStreetName: string
    ) => {
      const snapPt = entrySnap.get(nodeId);
      if (!snapPt) return;

      const walkedOnStreet = haversineDistance(snapPt[0], snapPt[1], exitCoord[0], exitCoord[1]);
      const streetSoFar = gNode + extraStreetDist;
      // Require meaningful progress along the street so we don't make a pointless sideways hook
      if (walkedOnStreet < 15 && streetSoFar < 18) return;

      const remStraight = haversineDistance(exitCoord[0], exitCoord[1], end[0], end[1]);
      // Must genuinely get closer to the destination than starting point
      if (remStraight > directDist - 15) return;

      const totalScore = streetSoFar + remStraight;
      if (totalScore > maxAllowedTotal) return;

      const curBest = bestRef.current;
      if (
        !curBest ||
        totalScore < curBest.totalScore - 2 ||
        (Math.abs(totalScore - curBest.totalScore) <= 2 && remStraight < curBest.remStraight)
      ) {
        bestRef.current = {
          nodeId,
          exitCoord,
          extraStreetDist,
          extraStreetName,
          remStraight,
          totalScore,
        };
      }
    };

    let iterations = 0;
    while (open.length > 0 && iterations < 2500) {
      iterations++;
      open.sort((a, b) => a.g - b.g);
      const curr = open.shift()!;
      if (closed.has(curr.id)) continue;
      closed.add(curr.id);

      const gCurr = curr.g;
      if (gCurr > maxBudget) break;

      if (curr.id !== '__START__') {
        const currCoord = getCoord(curr.id);
        considerCandidate(curr.id, currCoord, gCurr, 0, '');

        // Also check orthogonal projections onto segments incident to this node (or starting segment)
        const subIds = curr.id.startsWith('__S_')
          ? [Number(curr.id.slice(4))]
          : this.nodeSubSegments.get(curr.id) || [];

        for (const subIdx of subIds) {
          const rec = this.subSegments[subIdx];
          if (!rec) continue;
          const proj = projectPointOnSegment(
            end[0],
            end[1],
            rec.segment.p1[0],
            rec.segment.p1[1],
            rec.segment.p2[0],
            rec.segment.p2[1]
          );
          const dFromCurr = haversineDistance(currCoord[0], currCoord[1], proj.nearest[0], proj.nearest[1]);
          if (dFromCurr >= 1.5 && gCurr + dFromCurr <= maxBudget) {
            considerCandidate(curr.id, proj.nearest, gCurr, dFromCurr, rec.segment.name);
          }
        }
      }

      const baseNode = this.nodes.get(curr.id);
      const vNbrs = virtualNeighbors.get(curr.id);

      const processEdge = (edge: { targetId: string; distanceMeters: number; streetName: string }) => {
        if (closed.has(edge.targetId)) return;
        const ng = gCurr + edge.distanceMeters;
        if (ng > maxBudget) return;
        const existing = gScore.get(edge.targetId);
        if (existing === undefined || ng < existing) {
          gScore.set(edge.targetId, ng);
          prev.set(edge.targetId, { id: curr.id, streetName: edge.streetName });
          const snap =
            startSnapPointByNode.get(edge.targetId) || entrySnap.get(curr.id);
          if (snap) entrySnap.set(edge.targetId, snap);
          open.push({ id: edge.targetId, g: ng });
        }
      };

      if (baseNode) {
        for (const edge of baseNode.neighbors) processEdge(edge);
      }
      if (vNbrs) {
        for (const edge of vNbrs) processEdge(edge);
      }
    }

    const bestExit = bestRef.current;
    if (!bestExit) return null;

    const rawCoords: Coordinates[] = [];
    const streetNamesOrdered: string[] = [];
    let cur: string | null = bestExit.nodeId;

    while (cur) {
      rawCoords.unshift(getCoord(cur));
      const p = prev.get(cur);
      if (p) {
        if (p.streetName) streetNamesOrdered.unshift(p.streetName);
        cur = p.id;
      } else {
        cur = null;
      }
    }

    if (bestExit.extraStreetDist >= 1.5) {
      rawCoords.push(bestExit.exitCoord);
      if (bestExit.extraStreetName) streetNamesOrdered.push(bestExit.extraStreetName);
    }
    rawCoords.push(end);

    const { coordinates, distanceMeters } = this.finalizeCoords(rawCoords);
    return {
      coordinates,
      distanceMeters,
      streetNames: Array.from(new Set(streetNamesOrdered)).filter(Boolean),
    };
  }

  /**
   * Computes a walking path from start to end using local streets within max 60m.
   * Falls back to straight line whenever streets are absent (>60m) or would force a detour.
   */
  public findWalkingPath(from: Coordinates, to: Coordinates): WalkingPathResult {
    const MAX_STREET_SNAP_METERS = 60;
    const directDist = haversineDistance(from[0], from[1], to[0], to[1]);

    if (directDist < 15 || !this.isLoaded || this.subSegments.length === 0) {
      return {
        coordinates: [from, to],
        distanceMeters: Math.round(directDist),
        streetNames: [],
      };
    }

    const nearFrom = this.findNearSubSegments(from, MAX_STREET_SNAP_METERS, 4);
    const nearTo = this.findNearSubSegments(to, MAX_STREET_SNAP_METERS, 4);

    // Neither endpoint has a street within 60m -> draw clean straight line
    if (nearFrom.length === 0 && nearTo.length === 0) {
      return {
        coordinates: [from, to],
        distanceMeters: Math.round(directDist),
        streetNames: [],
      };
    }

    // Both endpoints are within 60m of mapped streets -> try full A* street path
    if (nearFrom.length > 0 && nearTo.length > 0) {
      const tightFrom = nearFrom.filter((c) => c.distanceMeters <= nearFrom[0].distanceMeters + 10);
      const tightTo = nearTo.filter((c) => c.distanceMeters <= nearTo[0].distanceMeters + 10);

      const maxAllowedAStar = Math.max(directDist * 1.65, directDist + 90);
      const tightResult = this.runAStar(from, to, tightFrom, tightTo);
      if (tightResult && tightResult.distanceMeters <= maxAllowedAStar) {
        return tightResult;
      }

      const connectedResult = this.runAStar(from, to, nearFrom, nearTo);
      if (connectedResult && connectedResult.distanceMeters <= maxAllowedAStar) {
        return connectedResult;
      }
    }

    // Origin is near a street (<=60m), destination is uncovered or disconnected:
    // walk along mapped street(s) toward destination, then straight line
    if (nearFrom.length > 0) {
      const partialFrom = this.findBestPartialStreetPath(from, to, nearFrom);
      if (partialFrom) return partialFrom;
    }

    // Destination is near a street (<=60m), origin is uncovered or disconnected:
    // walk straight onto mapped street approaching destination, then follow street
    if (nearTo.length > 0) {
      const partialToRev = this.findBestPartialStreetPath(to, from, nearTo);
      if (partialToRev) {
        return {
          coordinates: [...partialToRev.coordinates].reverse(),
          distanceMeters: partialToRev.distanceMeters,
          streetNames: [...partialToRev.streetNames].reverse(),
        };
      }
    }

    // Default clean straight line when no nearby street genuinely advances the walk
    return {
      coordinates: [from, to],
      distanceMeters: Math.round(directDist),
      streetNames: [],
    };
  }
}

/**
 * Parses a GeoJSON FeatureCollection of streets into StreetSegment array.
 */
export function parseStreetGeoJson(geoJson: any): StreetSegment[] {
  if (!geoJson || !Array.isArray(geoJson.features)) {
    return [];
  }

  const segments: StreetSegment[] = [];

  for (const f of geoJson.features) {
    if (!f || !f.geometry) continue;
    const props = f.properties || {};
    const name =
      props.nombre ||
      props.name ||
      props.NOMBRE ||
      props.NAME ||
      props.calle ||
      props.via ||
      props.CALLE ||
      props.VIA ||
      props.etiqueta ||
      '';

    if (!name || typeof name !== 'string' || name.trim() === '') {
      continue;
    }

    const cleanName = name.trim();
    const type = props.tipo || props.type || props.categoria || props.highway || 'calle';
    const geom = f.geometry;

    let lines: Coordinates[][] = [];
    if (geom.type === 'LineString') {
      lines = [geom.coordinates];
    } else if (geom.type === 'MultiLineString') {
      lines = geom.coordinates;
    }

    for (const line of lines) {
      if (!Array.isArray(line) || line.length < 2) continue;
      for (let i = 0; i < line.length - 1; i++) {
        const p1 = line[i] as Coordinates;
        const p2 = line[i + 1] as Coordinates;
        if (!p1 || !p2) continue;

        segments.push({
          minX: Math.min(p1[0], p2[0]),
          minY: Math.min(p1[1], p2[1]),
          maxX: Math.max(p1[0], p2[0]),
          maxY: Math.max(p1[1], p2[1]),
          name: cleanName,
          type,
          p1,
          p2,
        });
      }
    }
  }

  return segments;
}

// Global singleton street index
export const streetIndex = new StreetIndex();
