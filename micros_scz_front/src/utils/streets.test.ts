import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { StreetIndex, parseStreetGeoJson } from './street-index.ts';
import { calculateTrips } from './routing.ts';
import { SpatialRouteIndex } from './spatial-index.ts';
import type { RouteItem } from '../types.ts';
import { haversineDistance } from './geo.ts';

test('parseStreetGeoJson loads official Santa Cruz streets geojson', () => {
  const filePath = path.resolve('public/data/calles_scz.geojson');
  assert.ok(fs.existsSync(filePath), 'calles_scz.geojson must exist in public/data');

  const raw = fs.readFileSync(filePath, 'utf-8');
  const geojson = JSON.parse(raw);
  assert.ok(geojson.features && geojson.features.length > 1000, 'Should have over 1000 street features');

  const segments = parseStreetGeoJson(geojson);
  assert.ok(segments.length > 1000, `Should parse segments, got ${segments.length}`);

  const sIdx = new StreetIndex();
  sIdx.buildIndex(segments);
  assert.equal(sIdx.loaded, true);
  assert.equal(sIdx.count, segments.length);

  // Test finding nearest street near 1er Anillo / Cañoto
  // Approx: [-63.189, -17.783]
  const nearest = sIdx.findNearestStreet([-63.189, -17.783], 400);
  assert.ok(nearest, 'Should find a street near central Santa Cruz');
  assert.ok(nearest.streetName.length > 0, 'Street name should not be empty');
  assert.ok(nearest.distanceMeters <= 400, 'Distance should be within radius');
});

test('StreetIndex findWalkingPath traces street network coordinates', () => {
  const filePath = path.resolve('public/data/calles_scz.geojson');
  const raw = fs.readFileSync(filePath, 'utf-8');
  const geojson = JSON.parse(raw);
  const segments = parseStreetGeoJson(geojson);

  const sIdx = new StreetIndex();
  sIdx.buildIndex(segments);

  // Pick two points across multiple city blocks in central Santa Cruz
  // Origin near Calle Cobija / Sucre -> Dest near Calle Ingavi / Cordillera
  const from = [-63.18181, -17.7807] as [number, number];
  const to = [-63.18696, -17.78584] as [number, number];

  const walkPath = sIdx.findWalkingPath(from, to);
  assert.ok(walkPath.coordinates.length >= 6, `Walking path across blocks must follow street corners, got ${walkPath.coordinates.length} points`);
  assert.ok(walkPath.streetNames.length >= 2, `Should traverse multiple streets, got ${walkPath.streetNames.join(', ')}`);
  assert.ok(walkPath.distanceMeters > haversineDistance(from[0], from[1], to[0], to[1]), 'Street path distance must exceed straight-line crow-flies distance');
  assert.equal(walkPath.coordinates[0][0], from[0]);
  assert.equal(walkPath.coordinates[0][1], from[1]);
  const last = walkPath.coordinates[walkPath.coordinates.length - 1];
  assert.equal(last[0], to[0]);
  assert.equal(last[1], to[1]);
});

test('calculateTrips strictly prioritizes routes with minimal walking distance', () => {
  // Create 2 competing bus lines:
  // Route A (passes 50m from origin and 50m from destination)
  // Route B (passes 400m from origin and 400m from destination, but faster bus ride)
  const routeLowWalk: RouteItem = {
    id: 'L-LowWalk-1',
    label: 'Línea Baja Caminata',
    direction: 1,
    directionLabel: 'Ida (S1)',
    color: '#10b981',
    coordinates: [
      [-63.1805, -17.7800],
      [-63.1805, -17.7600],
    ],
    totalDistanceMeters: haversineDistance(-63.1805, -17.7800, -63.1805, -17.7600),
    bbox: [-63.1805, -17.7800, -63.1805, -17.7600],
  };

  const routeHighWalk: RouteItem = {
    id: 'L-HighWalk-1',
    label: 'Línea Larga Caminata',
    direction: 1,
    directionLabel: 'Ida (S1)',
    color: '#f59e0b',
    coordinates: [
      [-63.1840, -17.7800],
      [-63.1840, -17.7600],
    ],
    totalDistanceMeters: haversineDistance(-63.1840, -17.7800, -63.1840, -17.7600),
    bbox: [-63.1840, -17.7800, -63.1840, -17.7600],
  };

  const spatialIndex = new SpatialRouteIndex();
  spatialIndex.buildIndex([routeLowWalk, routeHighWalk]);

  // Origin at [-63.1800, -17.7800] (50m from LowWalk, 400m from HighWalk)
  // Dest at [-63.1800, -17.7600] (50m from LowWalk, 400m from HighWalk)
  const trips = calculateTrips({
    pointA: [-63.1800, -17.7800],
    pointB: [-63.1800, -17.7600],
    spatialIndex,
    searchRadiusMeters: 500,
  });

  assert.ok(trips.length >= 2, 'Should find both route options');
  // The first ranked trip MUST be the one with minimal walking distance!
  assert.equal(trips[0].legs[0].routeLabel, 'Línea Baja Caminata');
  assert.ok(trips[0].totalWalkMeters < trips[1].totalWalkMeters, 'First option must have less walk meters');
  assert.ok(trips[0].walkSegments[0].pathCoordinates !== undefined, 'Walk segment should contain pathCoordinates');
});

test('StreetIndex enforces 60m proximity, straight-line fallback, and partial street continuation without detours', () => {
  const sIdx = new StreetIndex();
  // Avenue running North-South along x = -63.1800, plus a short side street going West for 120m
  sIdx.buildIndex([
    {
      minX: -63.1800,
      minY: -17.7700,
      maxX: -63.1800,
      maxY: -17.7600,
      name: 'Av. Principal',
      type: 'c',
      p1: [-63.1800, -17.7700],
      p2: [-63.1800, -17.7600],
    },
    {
      minX: -63.1812,
      minY: -17.7640,
      maxX: -63.1800,
      maxY: -17.7640,
      name: 'Calle Lateral',
      type: 'c',
      p1: [-63.1800, -17.7640],
      p2: [-63.1812, -17.7640],
    },
  ]);

  // 1. Neither endpoint within 60m -> clean 2-point straight line
  const farFrom: [number, number] = [-63.1850, -17.7640];
  const farTo: [number, number] = [-63.1880, -17.7660];
  const farWalk = sIdx.findWalkingPath(farFrom, farTo);
  assert.equal(farWalk.coordinates.length, 2, 'Should draw straight line when no streets within 60m');
  assert.deepEqual(farWalk.streetNames, []);

  // 2. Origin on Av. Principal (<=60m) where Calle Lateral advances toward uncovered destination >60m away
  const busStop: [number, number] = [-63.1801, -17.7660];
  const uncoveredDest: [number, number] = [-63.1825, -17.7635];
  const partialWalk = sIdx.findWalkingPath(busStop, uncoveredDest);
  const directDist = haversineDistance(busStop[0], busStop[1], uncoveredDest[0], uncoveredDest[1]);
  assert.ok(partialWalk.coordinates.length >= 3, 'Should trace mapped street(s) before straight continuation');
  assert.ok(partialWalk.streetNames.includes('Av. Principal'), 'Should use Av. Principal');
  assert.ok(partialWalk.distanceMeters <= directDist * 1.45, 'Must not introduce excessive backwards detour');

  // 3. Origin on perpendicular Av. Principal where destination is directly West (no mapped side street there)
  const alightPt: [number, number] = [-63.1801, -17.7685];
  const westDest: [number, number] = [-63.1822, -17.7685];
  const straightFallback = sIdx.findWalkingPath(alightPt, westDest);
  assert.equal(straightFallback.coordinates.length, 2, 'Should go straight instead of making useless sideways/backwards triangle');
});

test('calculateTrips routes via closest micro stop and final walk when destination is outside 1200m bus coverage', () => {
  const sIdx = new StreetIndex();
  sIdx.buildIndex([]);

  const routeA: RouteItem = {
    id: 'L-72-S1',
    label: 'Línea 72',
    direction: 1,
    directionLabel: 'Ida (S1)',
    color: '#e11d48',
    coordinates: [
      [-63.1800, -17.7800],
      [-63.1800, -17.7600],
    ],
    totalDistanceMeters: haversineDistance(-63.1800, -17.7800, -63.1800, -17.7600),
    bbox: [-63.1800, -17.7800, -63.1800, -17.7600],
  };

  const spatialIndex = new SpatialRouteIndex();
  spatialIndex.buildIndex([routeA]);

  // Point A is 50m from route start; Point B is ~2.2km north-west (>1200m from any bus route)
  const pointA: [number, number] = [-63.1805, -17.7800];
  const pointB: [number, number] = [-63.1950, -17.7520];
  const trips = calculateTrips({
    pointA,
    pointB,
    spatialIndex,
    streetIndex: sIdx,
  });

  const busTrip = trips.find((t) => t.type === 'direct');
  assert.ok(busTrip, 'Should still offer closest micro + final walk when destination is uncovered');
  assert.equal(busTrip.legs[0].routeLabel, 'Línea 72');
  assert.ok(busTrip.totalRideMeters > 1500, 'Should ride bus close to the destination');
  assert.ok(
    busTrip.totalWalkMeters < haversineDistance(pointA[0], pointA[1], pointB[0], pointB[1]),
    'Total walk must be much less than walking straight from A to B'
  );
});
