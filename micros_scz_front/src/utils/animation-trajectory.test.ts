import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateBearing,
  interpolateAngle,
  RouteAnimationTrajectory,
} from './animation-trajectory.ts';
import type { TripOption } from '../types.ts';

test('calculateBearing calculates directional compass angles', () => {
  // North: lat increases
  const north = calculateBearing([-63.18, -17.78], [-63.18, -17.77]);
  assert.ok(Math.abs(north - 0) < 1 || Math.abs(north - 360) < 1, `North should be 0°, got ${north}`);

  // East: lon increases
  const east = calculateBearing([-63.18, -17.78], [-63.17, -17.78]);
  assert.ok(Math.abs(east - 90) < 2, `East should be 90°, got ${east}`);

  // South: lat decreases
  const south = calculateBearing([-63.18, -17.77], [-63.18, -17.78]);
  assert.ok(Math.abs(south - 180) < 2, `South should be 180°, got ${south}`);

  // West: lon decreases
  const west = calculateBearing([-63.17, -17.78], [-63.18, -17.78]);
  assert.ok(Math.abs(west - 270) < 2, `West should be 270°, got ${west}`);
});

test('interpolateAngle handles modular 360 wrap around smoothly', () => {
  // 350° to 10° should interpolate across 0° (shortest path = 20° delta)
  const mid = interpolateAngle(350, 10, 0.5);
  assert.ok(Math.abs(mid - 0) < 1 || Math.abs(mid - 360) < 1, `Expected ~0°, got ${mid}`);

  const mid2 = interpolateAngle(10, 350, 0.5);
  assert.ok(Math.abs(mid2 - 0) < 1 || Math.abs(mid2 - 360) < 1, `Expected ~0°, got ${mid2}`);
});

test('RouteAnimationTrajectory samples continuous trajectory along trip', () => {
  const mockTrip: TripOption = {
    id: 'trip-test',
    type: 'direct',
    summary: 'Línea 72',
    totalTimeMinutes: 12,
    totalWalkMeters: 180,
    totalRideMeters: 2400,
    legs: [
      {
        routeId: 'L-72',
        routeLabel: 'Línea 72',
        direction: 1,
        color: '#10b981',
        boardPoint: [-63.185, -17.780],
        alightPoint: [-63.165, -17.770],
        boardDistAlongMeters: 0,
        alightDistAlongMeters: 2400,
        rideDistanceMeters: 2400,
        estimatedRideMinutes: 9,
        pathCoordinates: [
          [-63.185, -17.780],
          [-63.175, -17.775],
          [-63.165, -17.770],
        ],
      },
    ],
    walkSegments: [
      {
        from: [-63.187, -17.781],
        to: [-63.185, -17.780],
        distanceMeters: 90,
        estimatedMinutes: 2,
        instruction: 'Camina hacia parada',
        pathCoordinates: [
          [-63.187, -17.781],
          [-63.185, -17.780],
        ],
      },
      {
        from: [-63.165, -17.770],
        to: [-63.163, -17.769],
        distanceMeters: 90,
        estimatedMinutes: 2,
        instruction: 'Camina a tu destino',
        pathCoordinates: [
          [-63.165, -17.770],
          [-63.163, -17.769],
        ],
      },
    ],
    steps: ['Paso 1', 'Paso 2'],
  };

  const trajectory = new RouteAnimationTrajectory(mockTrip, 14);
  assert.ok(trajectory.waypoints.length >= 4, 'Should build multiple waypoints');
  assert.ok(trajectory.totalDistanceMeters > 2000, 'Distance must match polyline');

  // Sample at start (t = 0)
  const start = trajectory.sampleAtProgress(0);
  assert.equal(start.progressFraction, 0);
  assert.equal(start.phase, 'walk_start');
  assert.equal(start.isBus, false);

  // Sample in middle (t = 0.5)
  const mid = trajectory.sampleAtProgress(0.5);
  assert.equal(mid.progressFraction, 0.5);
  assert.equal(mid.isBus, true);
  assert.equal(mid.lineLabel, 'Línea 72');
  assert.ok(mid.cameraPitch >= 50 && mid.cameraPitch <= 60, 'Camera pitch should be 3D tilt');

  // Sample at end (t = 1)
  const end = trajectory.sampleAtProgress(1);
  assert.equal(end.progressFraction, 1);
  assert.equal(end.phase, 'arrival');
});
