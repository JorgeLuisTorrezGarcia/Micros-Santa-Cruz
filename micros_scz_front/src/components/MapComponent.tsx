import React, { useEffect, useRef, useState } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Coordinates, POIItem, RouteItem, TripOption } from '../types.ts';
import { MAP_STYLES, type MapStyleKey } from '../utils/map-styles.ts';

// Configure MapLibre to use local worker URL
if (typeof window !== 'undefined') {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs');
}

interface MapComponentProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  geoJsonData: any;
  visibleRouteIds: Set<string>;
  highlightedRouteId: string | null;
  pointP: Coordinates | null;
  pointA: Coordinates | null;
  pointB: Coordinates | null;
  activeTrip: TripOption | null;
  selectedPOI: POIItem | null;
  allPOIs?: POIItem[];
  activeMode: 'copilot' | 'lines' | 'near' | 'route' | 'places' | 'dataset';
  routeTarget: 'A' | 'B';
  onMapClickPoint: (coords: Coordinates) => void;
  onSelectRoute: (routeId: string) => void;
  onSelectPOI: (poi: POIItem) => void;
  searchRadiusMeters?: number;
  mapStyle: MapStyleKey;
  onMapStyleChange: (style: MapStyleKey) => void;
  customDataset?: {
    geoJson: any | null;
    isVisible: boolean;
    color: string;
  };
  onRegisterCaptureMap?: (captureFn: (options?: { hidePins?: boolean }) => Promise<string>) => void;
}

function initializeBaseMapLayers(
  map: maplibregl.Map,
  geoJsonData: any,
  customDataset: MapComponentProps['customDataset'],
  currentStyle: MapStyleKey,
  setMapLoaded: React.Dispatch<React.SetStateAction<boolean>>
) {
      // 1. Generate directional arrow icon
      const canvas = document.createElement('canvas');
      canvas.width = 24;
      canvas.height = 24;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.moveTo(4, 3);
        ctx.lineTo(21, 12);
        ctx.lineTo(4, 21);
        ctx.lineTo(9, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();

        const imgData = ctx.getImageData(0, 0, 24, 24);
        map.addImage('arrow-dir', imgData);
      }

      // 2. Add Sources
      map.addSource('all-routes', {
        type: 'geojson',
        data: geoJsonData || { type: 'FeatureCollection', features: [] },
      });

      map.addSource('highlighted-route', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('trip-segments', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('radius-circle', {
        type: 'geojson',
        data: { type: 'FeatureCollection', features: [] },
      });

      map.addSource('custom-user-dataset', {
        type: 'geojson',
        data: customDataset?.geoJson || { type: 'FeatureCollection', features: [] },
      });

      // 3. Add Layers

      // Radius circle layer (visualizes search radius around point P)
      map.addLayer({
        id: 'radius-circle-fill',
        type: 'fill',
        source: 'radius-circle',
        paint: {
          'fill-color': '#0284c7',
          'fill-opacity': 0.12,
        },
      });

      map.addLayer({
        id: 'radius-circle-line',
        type: 'line',
        source: 'radius-circle',
        paint: {
          'line-color': '#0284c7',
          'line-width': 2,
          'line-dasharray': [2, 2],
        },
      });

      // Base Routes Line Layer
      map.addLayer({
        id: 'routes-line-base',
        type: 'line',
        source: 'all-routes',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': [
            'interpolate',
            ['linear'],
            ['zoom'],
            10,
            2,
            14,
            3.5,
            18,
            6,
          ],
          'line-opacity': 0.8,
        },
      });

      // Directional Arrows
      map.addLayer({
        id: 'routes-arrows',
        type: 'symbol',
        source: 'all-routes',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 90,
          'icon-image': 'arrow-dir',
          'icon-size': 0.5,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // Detect valid fonts from active MapLibre style to prevent 404 glyph requests
      const styleLayers = map.getStyle()?.layers || [];
      let detectedBoldFont: string[] = currentStyle === 'positron'
        ? ['Montserrat SemiBold', 'Open Sans Bold', 'Noto Sans Regular', 'Noto Sans CJK JP Regular']
        : ['Noto Sans Bold'];
      let detectedRegularFont: string[] = currentStyle === 'positron'
        ? ['Montserrat Medium', 'Open Sans Regular', 'Noto Sans Regular', 'Noto Sans CJK JP Regular']
        : ['Noto Sans Regular'];

      for (const layer of styleLayers) {
        const tf = (layer as { layout?: { 'text-font'?: unknown } }).layout?.['text-font'];
        if (Array.isArray(tf) && tf.every((f) => typeof f === 'string')) {
          const joined = tf.join(' ').toLowerCase();
          if (joined.includes('bold') || joined.includes('semibold')) {
            detectedBoldFont = tf as string[];
          } else if (joined.includes('regular') || joined.includes('medium')) {
            detectedRegularFont = tf as string[];
          }
        }
      }

      // Line Labels (Visible on close zoom >= 14 to avoid visual clutter)
      map.addLayer({
        id: 'routes-line-labels',
        type: 'symbol',
        source: 'all-routes',
        minzoom: 14,
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 180,
          'text-field': ['get', 'label'],
          'text-size': 11.5,
          'text-font': detectedRegularFont,
          'text-allow-overlap': false,
          'text-ignore-placement': false,
          'text-keep-upright': true,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 2.5,
        },
      });

      // Highlighted Route Glow Outer
      map.addLayer({
        id: 'routes-highlight-halo',
        type: 'line',
        source: 'highlighted-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 10,
          'line-opacity': 0.9,
        },
      });

      // Highlighted Route Inner Solid
      map.addLayer({
        id: 'routes-highlight-core',
        type: 'line',
        source: 'highlighted-route',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 5.5,
          'line-opacity': 1.0,
        },
      });

      // Trip Plan: Bus ride segments
      map.addLayer({
        id: 'trip-bus-halo',
        type: 'line',
        source: 'trip-segments',
        filter: ['all', ['==', ['get', 'isWalk'], false], ['!=', ['get', 'isLabelPoint'], true]],
        paint: {
          'line-color': '#ffffff',
          'line-width': 10,
          'line-opacity': 0.9,
        },
      });

      map.addLayer({
        id: 'trip-bus-line',
        type: 'line',
        source: 'trip-segments',
        filter: ['all', ['==', ['get', 'isWalk'], false], ['!=', ['get', 'isLabelPoint'], true]],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': ['get', 'color'],
          'line-width': 6,
          'line-opacity': 1,
        },
      });

      map.addLayer({
        id: 'trip-bus-arrows',
        type: 'symbol',
        source: 'trip-segments',
        filter: ['all', ['==', ['get', 'isWalk'], false], ['!=', ['get', 'isLabelPoint'], true]],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 70,
          'icon-image': 'arrow-dir',
          'icon-size': 0.6,
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
        },
      });

      // Trip Plan: Walking segments (white casing + crisp dashed black line following streets)
      map.addLayer({
        id: 'trip-walk-halo',
        type: 'line',
        source: 'trip-segments',
        filter: ['==', ['get', 'isWalk'], true],
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': '#ffffff',
          'line-width': 7.5,
          'line-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'trip-walk-line',
        type: 'line',
        source: 'trip-segments',
        filter: ['==', ['get', 'isWalk'], true],
        layout: {
          'line-join': 'round',
        },
        paint: {
          'line-color': '#0f172a',
          'line-width': 4,
          'line-dasharray': [1.6, 1.4],
        },
      });

      // Calculated Trip Bus Line Name Labels (along the route)
      map.addLayer({
        id: 'trip-bus-labels',
        type: 'symbol',
        source: 'trip-segments',
        filter: ['all', ['==', ['get', 'isWalk'], false], ['==', ['get', 'useLineLabel'], true]],
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 130,
          'text-field': ['get', 'label'],
          'text-size': 13.5,
          'text-font': detectedBoldFont,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-keep-upright': true,
          'text-max-angle': 45,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 3.5,
        },
      });

      // Fallback midpoint label for short bus legs so line name is always visible on the route
      map.addLayer({
        id: 'trip-bus-point-labels',
        type: 'symbol',
        source: 'trip-segments',
        filter: ['==', ['get', 'isLabelPoint'], true],
        layout: {
          'symbol-placement': 'point',
          'text-field': ['get', 'label'],
          'text-size': 13.5,
          'text-font': detectedBoldFont,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 3.5,
        },
      });

      // Highlighted Route Label (Always visible at any zoom when a route is focused)
      map.addLayer({
        id: 'routes-highlight-labels',
        type: 'symbol',
        source: 'highlighted-route',
        layout: {
          'symbol-placement': 'line',
          'symbol-spacing': 150,
          'text-field': ['get', 'label'],
          'text-size': 13,
          'text-font': detectedBoldFont,
          'text-allow-overlap': true,
          'text-ignore-placement': true,
          'text-keep-upright': true,
        },
        paint: {
          'text-color': '#0f172a',
          'text-halo-color': '#ffffff',
          'text-halo-width': 3,
        },
      });

      // Isolated Custom Dataset Layers (Lines, Polygons, Points from user uploads in Dataset tab)
      map.addLayer({
        id: 'custom-dataset-fill',
        type: 'fill',
        source: 'custom-user-dataset',
        filter: ['==', '$type', 'Polygon'],
        paint: {
          'fill-color': customDataset?.color || '#8b5cf6',
          'fill-opacity': 0.25,
        },
      });

      map.addLayer({
        id: 'custom-dataset-lines',
        type: 'line',
        source: 'custom-user-dataset',
        layout: {
          'line-cap': 'round',
          'line-join': 'round',
        },
        paint: {
          'line-color': customDataset?.color || '#8b5cf6',
          'line-width': 3.5,
          'line-opacity': 0.85,
        },
      });

      map.addLayer({
        id: 'custom-dataset-points',
        type: 'circle',
        source: 'custom-user-dataset',
        filter: ['==', '$type', 'Point'],
        paint: {
          'circle-color': customDataset?.color || '#8b5cf6',
          'circle-radius': 6,
          'circle-stroke-width': 2,
          'circle-stroke-color': '#ffffff',
        },
      });

      setMapLoaded(true);

      // Auto-fit to routes on first load
      if (geoJsonData && geoJsonData.features && geoJsonData.features.length > 0) {
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        for (const f of geoJsonData.features) {
          const coords = f.geometry?.coordinates || [];
          for (const c of coords) {
            if (c[0] < minX) minX = c[0];
            if (c[0] > maxX) maxX = c[0];
            if (c[1] < minY) minY = c[1];
            if (c[1] > maxY) maxY = c[1];
          }
        }
        if (minX !== Infinity) {
          map.fitBounds(
            [
              [minX, minY],
              [maxX, maxY],
            ],
            { padding: { top: 60, bottom: 60, left: 420, right: 60 }, duration: 1000 }
          );
        }
      }
}

interface MapDataLayerOptions {
  mapRef: React.RefObject<maplibregl.Map | null>;
  mapLoaded: boolean;
  geoJsonData: any;
  visibleRouteIds: Set<string>;
  highlightedRouteId: string | null;
  activeTrip: TripOption | null;
  activeMode: MapComponentProps['activeMode'];
  pointP: Coordinates | null;
  searchRadiusMeters: number;
  customDataset: MapComponentProps['customDataset'];
}

function useMapDataLayers({
  mapRef,
  mapLoaded,
  geoJsonData,
  visibleRouteIds,
  highlightedRouteId,
  activeTrip,
  activeMode,
  pointP,
  searchRadiusMeters,
  customDataset,
}: MapDataLayerOptions) {
  // Update GeoJSON source when data changes
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const source = mapRef.current.getSource('all-routes') as maplibregl.GeoJSONSource;
    if (source && geoJsonData) {
      source.setData(geoJsonData);
    }
  }, [geoJsonData, mapLoaded, mapRef]);

  // Filter visible routes on the map (suppress full bus routes while viewing an A->B calculated trip)
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;

    const suppressFullRoutes = activeTrip !== null && activeMode === 'route';

    if (suppressFullRoutes || visibleRouteIds.size === 0) {
      map.setFilter('routes-line-base', ['==', ['get', 'id'], '__NONE__'] as any);
      map.setFilter('routes-arrows', ['==', ['get', 'id'], '__NONE__'] as any);
      map.setFilter('routes-line-labels', ['==', ['get', 'id'], '__NONE__'] as any);
    } else {
      const filterExpr: any = [
        'in',
        ['get', 'id'],
        ['literal', Array.from(visibleRouteIds)],
      ];
      map.setFilter('routes-line-base', filterExpr);
      map.setFilter('routes-arrows', filterExpr);
      map.setFilter('routes-line-labels', filterExpr);
    }
  }, [visibleRouteIds, activeTrip, activeMode, mapLoaded, mapRef]);

  // Update highlighted route and zoom to it
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource('highlighted-route') as maplibregl.GeoJSONSource;
    if (!source) return;

    const suppressFullRoutes = activeTrip !== null && activeMode === 'route';

    // Do NOT draw highlighted route if it is not in visibleRouteIds or A->B trip is active
    if (
      suppressFullRoutes ||
      !highlightedRouteId ||
      !visibleRouteIds.has(highlightedRouteId) ||
      !geoJsonData ||
      !geoJsonData.features
    ) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    const feature = geoJsonData.features.find(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (f: any) => f.properties?.id === highlightedRouteId
    );

    if (feature && feature.geometry?.coordinates) {
      source.setData({
        type: 'FeatureCollection',
        features: [feature],
      });

      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
      for (const c of feature.geometry.coordinates) {
        if (c[0] < minX) minX = c[0];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[1] > maxY) maxY = c[1];
      }
      if (minX !== Infinity) {
        map.fitBounds(
          [
            [minX, minY],
            [maxX, maxY],
          ],
          {
            padding: { top: 80, bottom: 80, left: window.innerWidth > 768 ? 420 : 40, right: 40 },
            maxZoom: 15,
            duration: 800,
          }
        );
      }
    } else {
      source.setData({ type: 'FeatureCollection', features: [] });
    }
  }, [highlightedRouteId, visibleRouteIds, activeTrip, activeMode, geoJsonData, mapLoaded, mapRef]);

  // Update Trip segments on the map and fit bounds
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource('trip-segments') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!activeTrip) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const features: any[] = [];
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const expandBbox = (coords: Coordinates[]) => {
      for (const c of coords) {
        if (c[0] < minX) minX = c[0];
        if (c[0] > maxX) maxX = c[0];
        if (c[1] < minY) minY = c[1];
        if (c[1] > maxY) maxY = c[1];
      }
    };

    // Add walking segments
    activeTrip.walkSegments.forEach((w, idx) => {
      const walkCoords =
        w.pathCoordinates && w.pathCoordinates.length > 0
          ? w.pathCoordinates
          : [w.from, w.to];
      expandBbox(walkCoords);
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: walkCoords,
        },
        properties: {
          isWalk: true,
          color: '#0f172a',
          id: `walk-${idx}`,
        },
      });
    });

    // Add transit legs with line name labels
    activeTrip.legs.forEach((leg, idx) => {
      expandBbox(leg.pathCoordinates);
      const isShortLeg = leg.rideDistanceMeters < 450;
      features.push({
        type: 'Feature',
        geometry: {
          type: 'LineString',
          coordinates: leg.pathCoordinates,
        },
        properties: {
          isWalk: false,
          isLabelPoint: false,
          useLineLabel: !isShortLeg,
          color: leg.color,
          label: leg.routeLabel,
          id: `leg-${idx}`,
        },
      });

      if (isShortLeg && leg.pathCoordinates.length >= 2) {
        const midIdx = Math.floor(leg.pathCoordinates.length / 2);
        const midCoord = leg.pathCoordinates[midIdx];
        features.push({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: midCoord,
          },
          properties: {
            isWalk: false,
            isLabelPoint: true,
            useLineLabel: false,
            label: leg.routeLabel,
            id: `leg-label-${idx}`,
          },
        });
      }
    });

    source.setData({
      type: 'FeatureCollection',
      features,
    });

    if (minX !== Infinity) {
      map.fitBounds(
        [
          [minX, minY],
          [maxX, maxY],
        ],
        {
          padding: { top: 80, bottom: 80, left: window.innerWidth > 768 ? 420 : 40, right: 40 },
          maxZoom: 15,
          duration: 900,
        }
      );
    }
  }, [activeTrip, mapLoaded, mapRef]);

  // Update search radius circle when in "near" mode and pointP is set
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const source = mapRef.current.getSource('radius-circle') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (activeMode !== 'near' || !pointP) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // Generate circle polygon approximation (64 points)
    const [centerLon, centerLat] = pointP;
    const points: Coordinates[] = [];
    const radiusKm = searchRadiusMeters / 1000;
    const degLat = radiusKm / 111.32;
    const degLon = radiusKm / (111.32 * Math.cos((centerLat * Math.PI) / 180));

    for (let i = 0; i <= 64; i++) {
      const angle = (i * 2 * Math.PI) / 64;
      const x = centerLon + degLon * Math.cos(angle);
      const y = centerLat + degLat * Math.sin(angle);
      points.push([x, y]);
    }

    source.setData({
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: {
            type: 'Polygon',
            coordinates: [points],
          },
          properties: {},
        },
      ],
    });
  }, [pointP, searchRadiusMeters, activeMode, mapLoaded, mapRef]);

  // Synchronize isolated custom-user-dataset layer
  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;
    const map = mapRef.current;
    const source = map.getSource('custom-user-dataset') as maplibregl.GeoJSONSource;
    if (!source) return;

    if (!customDataset || !customDataset.isVisible || !customDataset.geoJson) {
      source.setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    source.setData(customDataset.geoJson);

    // Update paint color dynamically
    const layerColor = customDataset.color || '#8b5cf6';
    if (map.getLayer('custom-dataset-lines')) {
      map.setPaintProperty('custom-dataset-lines', 'line-color', layerColor);
    }
    if (map.getLayer('custom-dataset-fill')) {
      map.setPaintProperty('custom-dataset-fill', 'fill-color', layerColor);
    }
    if (map.getLayer('custom-dataset-points')) {
      map.setPaintProperty('custom-dataset-points', 'circle-color', layerColor);
    }
  }, [customDataset, mapLoaded, mapRef]);
}

interface MapMarkerOptions {
  mapRef: { current: maplibregl.Map | null };
  markerARef: { current: maplibregl.Marker | null };
  markerBRef: { current: maplibregl.Marker | null };
  markerPRef: { current: maplibregl.Marker | null };
  markerPOIRef: { current: maplibregl.Marker | null };
  pointA: Coordinates | null;
  pointB: Coordinates | null;
  pointP: Coordinates | null;
  selectedPOI: POIItem | null;
}

function useMapMarkers({
  mapRef,
  markerARef,
  markerBRef,
  markerPRef,
  markerPOIRef,
  pointA,
  pointB,
  pointP,
  selectedPOI,
}: MapMarkerOptions) {
  // Marker helper
  const createMarkerElement = (
    label: string,
    bgColor: string,
    icon: string
  ): HTMLElement => {
    const el = document.createElement('div');
    el.className = 'group relative flex items-center justify-center cursor-pointer';
    el.innerHTML = `
      <div style="background-color: ${bgColor}" class="w-8 h-8 rounded-full border-2 border-white shadow-xl flex items-center justify-center font-bold text-white text-xs transform transition hover:scale-115">
        ${icon}
      </div>
      <div class="absolute -top-7 px-2 py-0.5 bg-slate-900/90 text-white text-[11px] font-semibold rounded-md shadow-md whitespace-nowrap pointer-events-none opacity-90">
        ${label}
      </div>
    `;
    return el;
  };

  // Sync Point A Marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (pointA) {
      if (!markerARef.current) {
        const el = createMarkerElement('A - Origen', '#16a34a', 'A');
        markerARef.current = new maplibregl.Marker({ element: el })
          .setLngLat(pointA)
          .addTo(mapRef.current);
      } else {
        markerARef.current.setLngLat(pointA);
      }
    } else {
      if (markerARef.current) {
        markerARef.current.remove();
        markerARef.current = null;
      }
    }
  }, [pointA, mapRef]);

  // Sync Point B Marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (pointB) {
      if (!markerBRef.current) {
        const el = createMarkerElement('B - Destino', '#dc2626', 'B');
        markerBRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(pointB)
          .addTo(mapRef.current);
      } else {
        markerBRef.current.setLngLat(pointB);
      }
    } else {
      if (markerBRef.current) {
        markerBRef.current.remove();
        markerBRef.current = null;
      }
    }
  }, [pointB, mapRef]);

  // Sync Point P Marker (Nearby query point)
  useEffect(() => {
    if (!mapRef.current) return;
    if (pointP) {
      if (!markerPRef.current) {
        const targetSvg = `<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3" fill="currentColor"/></svg>`;
        const el = createMarkerElement('Punto de Consulta', '#0284c7', targetSvg);
        markerPRef.current = new maplibregl.Marker({ element: el })
          .setLngLat(pointP)
          .addTo(mapRef.current);
      } else {
        markerPRef.current.setLngLat(pointP);
      }
    } else {
      if (markerPRef.current) {
        markerPRef.current.remove();
        markerPRef.current = null;
      }
    }
  }, [pointP, mapRef]);

  // Sync selected POI Marker
  useEffect(() => {
    if (!mapRef.current) return;
    if (selectedPOI) {
      if (!markerPOIRef.current) {
        const pinSvg = `<svg class="w-4 h-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>`;
        const el = createMarkerElement(selectedPOI.name, '#8b5cf6', pinSvg);
        markerPOIRef.current = new maplibregl.Marker({ element: el })
          .setLngLat([selectedPOI.lon, selectedPOI.lat])
          .addTo(mapRef.current);
      } else {
        markerPOIRef.current.setLngLat([selectedPOI.lon, selectedPOI.lat]);
      }
    } else {
      if (markerPOIRef.current) {
        markerPOIRef.current.remove();
        markerPOIRef.current = null;
      }
    }
  }, [selectedPOI, mapRef]);
}

export const MapComponent: React.FC<MapComponentProps> = ({
  geoJsonData,
  visibleRouteIds,
  highlightedRouteId,
  pointP,
  pointA,
  pointB,
  activeTrip,
  selectedPOI,
  allPOIs = [],
  activeMode,
  onMapClickPoint,
  onSelectRoute,
  onSelectPOI,
  searchRadiusMeters = 500,
  mapStyle,
  onMapStyleChange,
  customDataset,
  onRegisterCaptureMap,
}) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const mapViewRef = useRef<{
    center: [number, number];
    zoom: number;
    bearing: number;
    pitch: number;
  } | null>(null);

  // Callback refs to prevent stale closures in MapLibre event listeners
  const onMapClickPointRef = useRef(onMapClickPoint);
  onMapClickPointRef.current = onMapClickPoint;
  const onSelectRouteRef = useRef(onSelectRoute);
  onSelectRouteRef.current = onSelectRoute;
  const onSelectPOIRef = useRef(onSelectPOI);
  onSelectPOIRef.current = onSelectPOI;

  // Markers refs for smooth updates without tearing down the map
  const markerARef = useRef<maplibregl.Marker | null>(null);
  const markerBRef = useRef<maplibregl.Marker | null>(null);
  const markerPRef = useRef<maplibregl.Marker | null>(null);
  const markerPOIRef = useRef<maplibregl.Marker | null>(null);

  // Expose clean map capture without pins
  useEffect(() => {
    if (!onRegisterCaptureMap) return;
    let isActive = true;
    const pendingFrames = new Map<number, () => void>();
    const pendingTimeouts = new Map<number, () => void>();

    const waitForFrame = () =>
      new Promise<void>((resolve) => {
        let frameId = 0;
        const complete = () => {
          pendingFrames.delete(frameId);
          resolve();
        };
        frameId = requestAnimationFrame(complete);
        pendingFrames.set(frameId, complete);
      });

    const waitForPaint = () =>
      new Promise<void>((resolve) => {
        let timeoutId = 0;
        const complete = () => {
          pendingTimeouts.delete(timeoutId);
          resolve();
        };
        timeoutId = window.setTimeout(complete, 60);
        pendingTimeouts.set(timeoutId, complete);
      });

    const captureMap = async (options?: { hidePins?: boolean }): Promise<string> => {
      if (!mapRef.current) return '';
      const map = mapRef.current;

      const markersToHide: HTMLElement[] = [];
      if (options?.hidePins !== false) {
        if (markerARef.current?.getElement()) markersToHide.push(markerARef.current.getElement());
        if (markerBRef.current?.getElement()) markersToHide.push(markerBRef.current.getElement());
        if (markerPRef.current?.getElement()) markersToHide.push(markerPRef.current.getElement());
        if (markerPOIRef.current?.getElement()) markersToHide.push(markerPOIRef.current.getElement());
      }


      markersToHide.forEach((el) => {
        el.style.opacity = '0';
        el.style.pointerEvents = 'none';
      });

      try {
        map.triggerRepaint();
        await waitForFrame();
        if (!isActive) return '';
        await waitForPaint();
        if (!isActive) return '';

        const canvas = map.getCanvas();
        return canvas.toDataURL('image/png');
      } finally {
        markersToHide.forEach((el) => {
          el.style.opacity = '';
          el.style.pointerEvents = '';
        });
      }
    };

    onRegisterCaptureMap(captureMap);

    return () => {
      isActive = false;
      pendingFrames.forEach((complete, frameId) => {
        cancelAnimationFrame(frameId);
        complete();
      });
      pendingTimeouts.forEach((complete, timeoutId) => {
        window.clearTimeout(timeoutId);
        complete();
      });
    };
  }, [onRegisterCaptureMap, mapLoaded]);

  const mapInitialDataRef = useRef({ geoJsonData, customDataset });
  useEffect(() => {
    mapInitialDataRef.current = { geoJsonData, customDataset };
  }, [geoJsonData, customDataset]);

  // Initialize MapLibre GL
  useEffect(() => {
    if (!mapContainerRef.current) return;
    setMapLoaded(false);

    // Default center: Plaza 24 de Septiembre, Santa Cruz de la Sierra
    const map = new maplibregl.Map({
      container: mapContainerRef.current,
      style: MAP_STYLES[mapStyle].url,
      center: mapViewRef.current?.center ?? [-63.1821, -17.7833],
      zoom: mapViewRef.current?.zoom ?? 12.5,
      bearing: mapViewRef.current?.bearing ?? 0,
      pitch: mapViewRef.current?.pitch ?? 0,
      maxZoom: 19,
      minZoom: 9,
      attributionControl: false,
      preserveDrawingBuffer: true,
    } as any);

    map.addControl(
      new maplibregl.AttributionControl({ compact: true }),
      'bottom-right'
    );
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: true, visualizePitch: true }),
      'top-right'
    );

    const handleMapClick = (e: maplibregl.MapMouseEvent) => {
      const clickedCoords: Coordinates = [e.lngLat.lng, e.lngLat.lat];
      onMapClickPointRef.current(clickedCoords);
    };
    const handleMapLoad = () => {
      initializeBaseMapLayers(
        map,
        mapInitialDataRef.current.geoJsonData,
        mapInitialDataRef.current.customDataset,
        mapStyle,
        setMapLoaded
      );
    };
    map.on('load', handleMapLoad);

    // Map Click handler for picking points
    map.on('click', handleMapClick);

    mapRef.current = map;

    return () => {
      const center = map.getCenter();
      mapViewRef.current = {
        center: center.toArray(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      map.off('load', handleMapLoad);
      map.off('click', handleMapClick);
      map.remove();
      mapRef.current = null;
    };
  }, [mapStyle]);

  useEffect(() => {
    if (!mapLoaded || !mapRef.current) return;

    const map = mapRef.current;
    const handleRouteClick = (e: maplibregl.MapLayerMouseEvent) => {
      if (e.features && e.features[0]) {
        const props = e.features[0].properties;
        if (props && props.id) {
          onSelectRouteRef.current(props.id);
        }
      }
    };
    const handleRouteMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };
    const handleRouteMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', 'routes-line-base', handleRouteClick);
    map.on('mouseenter', 'routes-line-base', handleRouteMouseEnter);
    map.on('mouseleave', 'routes-line-base', handleRouteMouseLeave);

    return () => {
      map.off('click', 'routes-line-base', handleRouteClick);
      map.off('mouseenter', 'routes-line-base', handleRouteMouseEnter);
      map.off('mouseleave', 'routes-line-base', handleRouteMouseLeave);
    };
  }, [mapLoaded]);

  useMapDataLayers({
    mapRef,
    mapLoaded,
    geoJsonData,
    visibleRouteIds,
    highlightedRouteId,
    activeTrip,
    activeMode,
    pointP,
    searchRadiusMeters,
    customDataset,
  });

  useMapMarkers({
    mapRef,
    markerARef,
    markerBRef,
    markerPRef,
    markerPOIRef,
    pointA,
    pointB,
    pointP,
    selectedPOI,
  });

  return (
    <div className="relative w-full h-full overflow-hidden bg-slate-950">
      {/* MapLibre WebGL canvas container */}
      <div
        ref={mapContainerRef}
        className="w-full h-full"
        style={{ width: '100%', height: '100%' }}
      />

      {/* Style Switcher pill in top left */}
      <div className="absolute top-3 left-3 z-10 hidden sm:flex items-center bg-slate-900/85 backdrop-blur-md rounded-xl p-1 border border-white/10 shadow-lg text-xs">
        {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={mapStyle === key}
            onClick={() => onMapStyleChange(key)}
            className={`px-2.5 py-1.5 rounded-lg font-medium transition ${
              mapStyle === key
                ? 'bg-emerald-600 text-white shadow-sm'
                : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
            }`}
          >
            {MAP_STYLES[key].name}
          </button>
        ))}
      </div>
    </div>
  );
};
