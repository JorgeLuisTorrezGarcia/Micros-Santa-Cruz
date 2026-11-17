import type { Coordinates, TripOption } from '../types.ts';
import { haversineDistance } from './geo.ts';

export type TrajectoryPhaseType = 'walk_start' | 'bus_leg' | 'transfer' | 'walk_end' | 'arrival';

export interface TrajectoryWaypoint {
  coords: Coordinates;
  distanceFromStart: number;
  bearing: number;
  phase: TrajectoryPhaseType;
  legIndex: number;
  lineLabel: string;
  lineColor: string;
  instruction: string;
}

export interface AnimationSample {
  coords: Coordinates;
  bearing: number;
  cameraBearing: number;
  cameraPitch: number;
  cameraZoom: number;
  phase: TrajectoryPhaseType;
  lineLabel: string;
  lineColor: string;
  isBus: boolean;
  instruction: string;
  progressFraction: number; // 0 to 1
  elapsedSeconds: number;
  totalDurationSeconds: number;
}

export const CAMERA_CHOREOGRAPHIES = [
  { id: 'cinematic', label: 'Cinemática actual' },
  { id: 'close-follow', label: 'Seguimiento cercano' },
  { id: 'side-orbit', label: 'Órbita lateral' },
  { id: 'high-overview', label: 'Panorámica elevada' },
] as const;

export type CameraChoreographyId = (typeof CAMERA_CHOREOGRAPHIES)[number]['id'];

/**
 * Calculates bearing angle in degrees from coord1 to coord2.
 * 0° = North, 90° = East, 180° = South, 270° = West.
 */
export function calculateBearing(c1: Coordinates, c2: Coordinates): number {
  const lon1 = (c1[0] * Math.PI) / 180;
  const lat1 = (c1[1] * Math.PI) / 180;
  const lon2 = (c2[0] * Math.PI) / 180;
  const lat2 = (c2[1] * Math.PI) / 180;

  const y = Math.sin(lon2 - lon1) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(lon2 - lon1);

  const brng = (Math.atan2(y, x) * 180) / Math.PI;
  return (brng + 360) % 360;
}

/**
 * Normalizes angular difference taking shortest path around circle.
 */
export function interpolateAngle(a: number, b: number, t: number): number {
  let diff = (b - a) % 360;
  if (diff < -180) diff += 360;
  if (diff > 180) diff -= 360;
  return (a + diff * t + 360) % 360;
}

function smoothStep(value: number): number {
  const clamped = Math.max(0, Math.min(1, value));
  return clamped * clamped * (3 - 2 * clamped);
}

function interpolateNumber(from: number, to: number, fraction: number): number {
  return from + (to - from) * fraction;
}

/**
 * Builds a dense continuous trajectory from a TripOption.
 */
export class RouteAnimationTrajectory {
  public waypoints: TrajectoryWaypoint[] = [];
  public totalDistanceMeters = 0;
  public totalDurationSeconds = 14; // Default ~14 seconds for optimal TikTok/CapCut pacing

  constructor(trip: TripOption, desiredDurationSeconds = 14) {
    this.totalDurationSeconds = desiredDurationSeconds;
    this.buildTrajectory(trip);
  }

  private buildTrajectory(trip: TripOption) {
    const rawPoints: {
      coords: Coordinates;
      phase: TrajectoryPhaseType;
      legIndex: number;
      lineLabel: string;
      lineColor: string;
      instruction: string;
    }[] = [];

    // 1. Initial Walking Segment (A -> Boarding stop)
    if (trip.walkSegments.length > 0) {
      const walk0 = trip.walkSegments[0];
      const coords =
        walk0.pathCoordinates && walk0.pathCoordinates.length >= 2
          ? walk0.pathCoordinates
          : [walk0.from, walk0.to];

      for (let i = 0; i < coords.length; i++) {
        rawPoints.push({
          coords: coords[i],
          phase: 'walk_start',
          legIndex: 0,
          lineLabel: trip.legs[0]?.routeLabel || 'Caminata',
          lineColor: '#10b981',
          instruction: walk0.instruction || 'Caminando hacia la parada',
        });
      }
    }

    // 2. Transit Legs & Transfers
    trip.legs.forEach((leg, legIdx) => {
      // Leg path coordinates
      const coords =
        leg.pathCoordinates && leg.pathCoordinates.length >= 2
          ? leg.pathCoordinates
          : [leg.boardPoint, leg.alightPoint];

      for (let i = 0; i < coords.length; i++) {
        rawPoints.push({
          coords: coords[i],
          phase: 'bus_leg',
          legIndex: legIdx,
          lineLabel: leg.routeLabel,
          lineColor: leg.color,
          instruction: `En viaje sobre ${leg.routeLabel}`,
        });
      }

      // If transfer to next leg
      if (legIdx < trip.legs.length - 1 && trip.walkSegments.length > 1) {
        const transWalk = trip.walkSegments[1];
        const tCoords =
          transWalk.pathCoordinates && transWalk.pathCoordinates.length >= 2
            ? transWalk.pathCoordinates
            : [transWalk.from, transWalk.to];

        for (let i = 0; i < tCoords.length; i++) {
          rawPoints.push({
            coords: tCoords[i],
            phase: 'transfer',
            legIndex: legIdx,
            lineLabel: `Transbordo a ${trip.legs[legIdx + 1]?.routeLabel}`,
            lineColor: '#f59e0b',
            instruction: transWalk.instruction || 'Transbordo de línea',
          });
        }
      }
    });

    // 3. Final Walking Segment (Alight stop -> Destination B)
    if (trip.walkSegments.length > 1) {
      const finalWalk = trip.walkSegments[trip.walkSegments.length - 1];
      const coords =
        finalWalk.pathCoordinates && finalWalk.pathCoordinates.length >= 2
          ? finalWalk.pathCoordinates
          : [finalWalk.from, finalWalk.to];

      for (let i = 0; i < coords.length; i++) {
        rawPoints.push({
          coords: coords[i],
          phase: 'walk_end',
          legIndex: trip.legs.length - 1,
          lineLabel: 'Destino B',
          lineColor: '#10b981',
          instruction: finalWalk.instruction || 'Caminando al destino B',
        });
      }
    }

    if (rawPoints.length === 0) return;

    // Filter out duplicate consecutive coordinates
    const filteredPoints: typeof rawPoints = [rawPoints[0]];
    for (let i = 1; i < rawPoints.length; i++) {
      const prev = filteredPoints[filteredPoints.length - 1].coords;
      const curr = rawPoints[i].coords;
      if (haversineDistance(prev[0], prev[1], curr[0], curr[1]) >= 1.0) {
        filteredPoints.push(rawPoints[i]);
      }
    }

    // Build dense waypoints with cumulative distance and bearings
    let distAcc = 0;
    this.waypoints = [];

    for (let i = 0; i < filteredPoints.length; i++) {
      const p = filteredPoints[i];
      let brng = 0;

      if (i < filteredPoints.length - 1) {
        brng = calculateBearing(p.coords, filteredPoints[i + 1].coords);
      } else if (i > 0) {
        brng = calculateBearing(filteredPoints[i - 1].coords, p.coords);
      }

      if (i > 0) {
        const prevC = filteredPoints[i - 1].coords;
        distAcc += haversineDistance(prevC[0], prevC[1], p.coords[0], p.coords[1]);
      }

      this.waypoints.push({
        coords: p.coords,
        distanceFromStart: distAcc,
        bearing: brng,
        phase: p.phase,
        legIndex: p.legIndex,
        lineLabel: p.lineLabel,
        lineColor: p.lineColor,
        instruction: p.instruction,
      });
    }

    this.totalDistanceMeters = distAcc;
  }

  /**
   * Samples the animation state at normalized progress t in [0, 1].
   */
  public sampleAtProgress(
    t: number,
    choreography: CameraChoreographyId = 'cinematic'
  ): AnimationSample {
    const sample = this.sampleBaseAtProgress(t);
    if (choreography === 'cinematic') return sample;

    const progress = sample.progressFraction;
    const introBlend = smoothStep(progress / 0.12);
    const outroBlend = smoothStep((progress - 0.82) / 0.18);
    const blend = introBlend * (1 - outroBlend);

    switch (choreography) {
      case 'close-follow':
        return {
          ...sample,
          cameraBearing:
            (sample.bearing + 4 * Math.sin(progress * Math.PI * 2) + 360) % 360,
          cameraPitch: interpolateNumber(
            interpolateNumber(0, sample.isBus ? 64 : 58, introBlend),
            38,
            outroBlend
          ),
          cameraZoom: interpolateNumber(
            interpolateNumber(14.5, sample.isBus ? 17.1 : 16.8, introBlend),
            14.5,
            outroBlend
          ),
        };
      case 'side-orbit':
        return {
          ...sample,
          cameraBearing:
            (sample.bearing + 105 * Math.sin(progress * Math.PI * 2) + 360) % 360,
          cameraPitch: interpolateNumber(
            interpolateNumber(0, 58, introBlend),
            38,
            outroBlend
          ),
          cameraZoom: interpolateNumber(
            interpolateNumber(14.5, 16.7, introBlend),
            14.5,
            outroBlend
          ),
        };
      case 'high-overview':
        return {
          ...sample,
          cameraBearing:
            (sample.bearing + 12 * Math.sin(progress * Math.PI) + 360) % 360,
          cameraPitch: interpolateNumber(
            interpolateNumber(0, 38, introBlend),
            28,
            outroBlend
          ),
          cameraZoom: interpolateNumber(14.5, 15.1, blend),
        };
      default:
        return sample;
    }
  }

  private sampleBaseAtProgress(t: number): AnimationSample {
    const clampedT = Math.max(0, Math.min(1, t));
    const elapsedSec = clampedT * this.totalDurationSeconds;

    if (this.waypoints.length === 0) {
      return {
        coords: [-63.18, -17.78],
        bearing: 0,
        cameraBearing: 0,
        cameraPitch: 55,
        cameraZoom: 16.5,
        phase: 'walk_start',
        lineLabel: 'Santa Cruz',
        lineColor: '#10b981',
        isBus: false,
        instruction: 'Iniciando recorrido',
        progressFraction: clampedT,
        elapsedSeconds: elapsedSec,
        totalDurationSeconds: this.totalDurationSeconds,
      };
    }

    if (clampedT === 0 || this.waypoints.length === 1) {
      const w = this.waypoints[0];
      return {
        coords: w.coords,
        bearing: w.bearing,
        cameraBearing: w.bearing,
        cameraPitch: clampedT === 0 ? 0 : 55,
        cameraZoom: clampedT === 0 ? 14.5 : 16.5,
        phase: w.phase,
        lineLabel: w.lineLabel,
        lineColor: w.lineColor,
        isBus: w.phase === 'bus_leg',
        instruction: w.instruction,
        progressFraction: 0,
        elapsedSeconds: 0,
        totalDurationSeconds: this.totalDurationSeconds,
      };
    }

    if (clampedT >= 1) {
      const last = this.waypoints[this.waypoints.length - 1];
      return {
        coords: last.coords,
        bearing: last.bearing,
        cameraBearing: last.bearing,
        cameraPitch: 40,
        cameraZoom: 14.5,
        phase: 'arrival',
        lineLabel: last.lineLabel,
        lineColor: last.lineColor,
        isBus: false,
        instruction: '¡Llegaste a tu destino!',
        progressFraction: 1,
        elapsedSeconds: this.totalDurationSeconds,
        totalDurationSeconds: this.totalDurationSeconds,
      };
    }

    const targetDist = clampedT * this.totalDistanceMeters;

    // Binary search for surrounding waypoints
    let low = 0;
    let high = this.waypoints.length - 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (this.waypoints[mid].distanceFromStart <= targetDist) {
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    const i1 = Math.max(0, high);
    const i2 = Math.min(this.waypoints.length - 1, i1 + 1);

    const w1 = this.waypoints[i1];
    const w2 = this.waypoints[i2];

    const segLen = w2.distanceFromStart - w1.distanceFromStart;
    const segFraction = segLen > 0 ? (targetDist - w1.distanceFromStart) / segLen : 0;

    // Interpolate coordinates
    const lon = w1.coords[0] + (w2.coords[0] - w1.coords[0]) * segFraction;
    const lat = w1.coords[1] + (w2.coords[1] - w1.coords[1]) * segFraction;
    const interpolatedCoords: Coordinates = [lon, lat];

    // Smoothly interpolate vehicle heading and camera bearing
    const vehicleBearing = interpolateAngle(w1.bearing, w2.bearing, segFraction);

    // Look slightly ahead for camera bearing to avoid jitter
    const lookAheadIdx = Math.min(this.waypoints.length - 1, i2 + 2);
    const lookAheadBearing = this.waypoints[lookAheadIdx].bearing;
    const cameraBearing = interpolateAngle(vehicleBearing, lookAheadBearing, 0.4);

    const activePhase = segFraction > 0.5 ? w2.phase : w1.phase;
    const activeLabel = segFraction > 0.5 ? w2.lineLabel : w1.lineLabel;
    const activeColor = segFraction > 0.5 ? w2.lineColor : w1.lineColor;
    const activeInstruction = segFraction > 0.5 ? w2.instruction : w1.instruction;

    // Zoom adjustments based on phase (closer for walking and transfers, wider for bus cruising)
    const phaseZoom =
      activePhase === 'walk_start' || activePhase === 'walk_end'
        ? 30.0 // 17.0
        : activePhase === 'transfer'
        ? 17.2
        : 16.6;

    const phasePitch =
      activePhase === 'transfer'
        ? 65
        : activePhase === 'walk_start' || activePhase === 'walk_end'
        ? 62
        : 55;
    const introBlend = smoothStep(clampedT / 0.12);
    const outroBlend = smoothStep((clampedT - 0.82) / 0.18);
    const pitch = interpolateNumber(
      interpolateNumber(0, phasePitch, introBlend),
      40,
      outroBlend
    );
    const zoom = interpolateNumber(
      interpolateNumber(14.5, phaseZoom, introBlend),
      14.5,
      outroBlend
    );
    const orbitOffset =
      activePhase === 'transfer'
        ? 35 * Math.sin(clampedT * Math.PI)
        : 5 * Math.sin(clampedT * Math.PI * 2);
    const cinematicBearing = (cameraBearing + orbitOffset + 360) % 360;

    return {
      coords: interpolatedCoords,
      bearing: vehicleBearing,
      cameraBearing: cinematicBearing,
      cameraPitch: pitch,
      cameraZoom: zoom,
      phase: activePhase,
      lineLabel: activeLabel,
      lineColor: activeColor,
      isBus: activePhase === 'bus_leg',
      instruction: activeInstruction,
      progressFraction: clampedT,
      elapsedSeconds: elapsedSec,
      totalDurationSeconds: this.totalDurationSeconds,
    };
  }
}
