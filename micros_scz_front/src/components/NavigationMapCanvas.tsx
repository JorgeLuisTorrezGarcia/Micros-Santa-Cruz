import React, { useEffect, useRef, useState, useImperativeHandle, forwardRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { Coordinates, TripOption } from '../types.ts';
import { ThreeBusLayer } from '../utils/three-bus-layer.ts';
import type { AnimationSample } from '../utils/animation-trajectory.ts';
import { waitForIdle } from '../utils/map-wait.ts';

export interface NavigationMapCanvasHandle {
  getCanvas: () => HTMLCanvasElement | null;
  triggerRepaint: () => void;
  prepareExport: (
    width: number,
    height: number,
    sampleAtProgress: (fraction: number) => AnimationSample
  ) => Promise<HTMLCanvasElement>;
  seek: (fraction: number) => Promise<void>;
  finishExport: () => void;
}

interface NavigationMapCanvasProps {
  trip: TripOption;
  sample: AnimationSample;
  mapStyleUrl?: string;
  aspectRatio: '9:16' | '16:9';
  watermarkText?: string;
}

function synchronizeMapToSample(
  map: maplibregl.Map,
  layer: ThreeBusLayer,
  sample: AnimationSample
) {
  layer.updateState({
    coords: sample.coords,
    bearingDeg: sample.bearing,
    isBus: sample.isBus,
    lineLabel: sample.lineLabel,
    lineColor: sample.lineColor,
    elapsedSeconds: sample.elapsedSeconds,
  });
  const trackerSource = map.getSource(
    'animation-vehicle-tracker-source'
  ) as maplibregl.GeoJSONSource | undefined;
  trackerSource?.setData({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: sample.coords },
    properties: { color: sample.lineColor },
  });
  map.jumpTo({
    center: sample.coords,
    bearing: sample.cameraBearing,
    pitch: sample.cameraPitch,
    zoom: sample.cameraZoom,
  });
}

function initializeNavigationMap(
  map: maplibregl.Map,
  trip: TripOption,
  sample: AnimationSample,
  startCoords: Coordinates,
  mapStyleUrl: string,
  threeLayerRef: React.MutableRefObject<ThreeBusLayer | null>,
  onReady: () => void
) {
        // --- 1. Add GeoJSON source for calculated trip route ---
        const routeFeatures: GeoJSON.Feature[] = [];

        // Walking segments
        trip.walkSegments.forEach((w, idx) => {
          const coords =
            w.pathCoordinates && w.pathCoordinates.length >= 2
              ? w.pathCoordinates
              : [w.from, w.to];
          routeFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: { isWalk: true, id: `walk-${idx}`, color: '#0f172a' },
          });
        });

        // Transit legs
        trip.legs.forEach((leg, idx) => {
          const coords =
            leg.pathCoordinates && leg.pathCoordinates.length >= 2
              ? leg.pathCoordinates
              : [leg.boardPoint, leg.alightPoint];
          routeFeatures.push({
            type: 'Feature',
            geometry: { type: 'LineString', coordinates: coords },
            properties: { isWalk: false, id: `leg-${idx}`, color: leg.color },
          });
        });

        map.addSource('animation-route-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: routeFeatures },
        });

        // --- 1.1 3D Volumetric Extruded Buildings Layer ---
        // Enhances spatial depth and realism as the camera follows the micro through streets
        if (map.getSource('openmaptiles') && !map.getLayer('anim-3d-buildings')) {
          map.addLayer(
            {
              id: 'anim-3d-buildings',
              source: 'openmaptiles',
              'source-layer': 'building',
              type: 'fill-extrusion',
              minzoom: 14,
              paint: {
                'fill-extrusion-color': mapStyleUrl.includes('dark')
                  ? [
                      'interpolate',
                      ['linear'],
                      ['coalesce', ['get', 'render_height'], 9],
                      0,
                      '#1e293b',
                      25,
                      '#334155',
                      60,
                      '#475569',
                    ]
                  : [
                      'interpolate',
                      ['linear'],
                      ['coalesce', ['get', 'render_height'], 9],
                      0,
                      '#e2e8f0',
                      25,
                      '#cbd5e1',
                      60,
                      '#94a3b8',
                    ],
                'fill-extrusion-height': [
                  'interpolate',
                  ['linear'],
                  ['zoom'],
                  14,
                  0,
                  15,
                  ['coalesce', ['get', 'render_height'], 7],
                ],
                'fill-extrusion-base': [
                  'coalesce',
                  ['get', 'render_min_height'],
                  0,
                ],
                'fill-extrusion-opacity': 0.85,
              },
            }
          );
        }

        map.addLayer({
          id: 'anim-bus-glow',
          type: 'line',
          source: 'animation-route-source',
          filter: ['==', ['get', 'isWalk'], false],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 14,
            'line-blur': 7,
            'line-opacity': 0.3,
          },
        });

        // Route casing / road highlight
        map.addLayer({
          id: 'anim-bus-casing',
          type: 'line',
          source: 'animation-route-source',
          filter: ['==', ['get', 'isWalk'], false],
          paint: {
            'line-color': '#ffffff',
            'line-width': 12,
            'line-opacity': 0.95,
          },
        });

        // Bus route colored line
        map.addLayer({
          id: 'anim-bus-line',
          type: 'line',
          source: 'animation-route-source',
          filter: ['==', ['get', 'isWalk'], false],
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: {
            'line-color': ['get', 'color'],
            'line-width': 7.5,
            'line-opacity': 1,
          },
        });

        // Walking route dashed line
        map.addLayer({
          id: 'anim-walk-line',
          type: 'line',
          source: 'animation-route-source',
          filter: ['==', ['get', 'isWalk'], true],
          paint: {
            'line-color': '#0f172a',
            'line-width': 5,
            'line-dasharray': [1.8, 1.8],
          },
        });

        // --- 2. Add Native WebGL Point A and Point B GeoJSON Layers ---
        // Rendering directly inside the MapLibre WebGL canvas guarantees they are
        // 100% visible in the studio AND 100% captured in the downloaded MP4/WebM video!
        const originCoords: Coordinates =
          trip.walkSegments.length > 0 && trip.walkSegments[0].from
            ? trip.walkSegments[0].from
            : trip.legs.length > 0
            ? trip.legs[0].boardPoint
            : sample.coords;

        const destCoords: Coordinates =
          trip.walkSegments.length > 0 && trip.walkSegments[trip.walkSegments.length - 1].to
            ? trip.walkSegments[trip.walkSegments.length - 1].to
            : trip.legs.length > 0
            ? trip.legs[trip.legs.length - 1].alightPoint
            : sample.coords;

        const markerFeatures: GeoJSON.Feature[] = [
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: originCoords },
            properties: {
              role: 'origin',
              letter: 'A',
              title: 'PUNTO A · INICIO',
              color: '#10b981',
              ringColor: '#34d399',
            },
          },
          {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: destCoords },
            properties: {
              role: 'dest',
              letter: 'B',
              title: 'PUNTO B · DESTINO',
              color: '#ef4444',
              ringColor: '#f87171',
            },
          },
        ];

        // Transfer waypoint (if transit transfer exists)
        if (trip.legs.length > 1 && trip.walkSegments.length > 1) {
          const transCoords = trip.walkSegments[1].from || trip.legs[0].alightPoint;
          markerFeatures.push({
            type: 'Feature',
            geometry: { type: 'Point', coordinates: transCoords },
            properties: {
              role: 'transfer',
              letter: '⇄',
              title: 'TRANSBORDO',
              color: '#f59e0b',
              ringColor: '#fbbf24',
            },
          });
        }

        map.addSource('animation-poi-markers-source', {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: markerFeatures },
        });

        // Outer glowing ripple on pavement
        map.addLayer({
          id: 'anim-poi-ground-glow',
          type: 'circle',
          source: 'animation-poi-markers-source',
          paint: {
            'circle-radius': 26,
            'circle-color': ['get', 'ringColor'],
            'circle-opacity': 0.35,
            'circle-pitch-alignment': 'map',
          },
        });

        // Ground anchor disc with solid border
        map.addLayer({
          id: 'anim-poi-ground-ring',
          type: 'circle',
          source: 'animation-poi-markers-source',
          paint: {
            'circle-radius': 16,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.9,
            'circle-stroke-width': 3,
            'circle-stroke-color': '#ffffff',
            'circle-pitch-alignment': 'map',
          },
        });

        // Foreground badge
        map.addLayer({
          id: 'anim-poi-core-badge',
          type: 'circle',
          source: 'animation-poi-markers-source',
          paint: {
            'circle-radius': 14,
            'circle-color': ['get', 'color'],
            'circle-stroke-width': 2.5,
            'circle-stroke-color': '#ffffff',
            'circle-pitch-alignment': 'viewport',
          },
        });

        // Icon Letter ("A" / "B" / "⇄")
        map.addLayer({
          id: 'anim-poi-letter',
          type: 'symbol',
          source: 'animation-poi-markers-source',
          layout: {
            'text-field': ['get', 'letter'],
            'text-size': 13,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#ffffff',
          },
        });

        // Title Label ("PUNTO A · INICIO", "PUNTO B · DESTINO")
        map.addLayer({
          id: 'anim-poi-label',
          type: 'symbol',
          source: 'animation-poi-markers-source',
          layout: {
            'text-field': ['get', 'title'],
            'text-size': 11,
            'text-font': ['Open Sans Bold', 'Arial Unicode MS Bold'],
            'text-offset': [0, 2.0],
            'text-anchor': 'top',
            'text-allow-overlap': true,
            'text-ignore-placement': true,
          },
          paint: {
            'text-color': '#ffffff',
            'text-halo-color': '#0f172a',
            'text-halo-width': 3,
          },
        });

        // --- 3. Live Ground Beacon for Current Vehicle / Pedestrian ---
        map.addSource('animation-vehicle-tracker-source', {
          type: 'geojson',
          data: {
            type: 'Feature',
            geometry: { type: 'Point', coordinates: startCoords },
            properties: { color: sample.lineColor },
          },
        });

        map.addLayer({
          id: 'anim-vehicle-pulse-glow',
          type: 'circle',
          source: 'animation-vehicle-tracker-source',
          paint: {
            'circle-radius': 18,
            'circle-color': ['get', 'color'],
            'circle-opacity': 0.4,
            'circle-pitch-alignment': 'map',
          },
        });

        // --- 4. Add 3D Three.js Bus & Pedestrian CustomLayer ---
        const threeLayer = new ThreeBusLayer();
        threeLayerRef.current = threeLayer;
        map.addLayer(threeLayer);
        synchronizeMapToSample(map, threeLayer, sample);

        onReady();
}

export const NavigationMapCanvas = forwardRef<
  NavigationMapCanvasHandle,
  NavigationMapCanvasProps
>(
  (
    {
      trip,
      sample,
      mapStyleUrl = 'https://tiles.openfreemap.org/styles/liberty',
      aspectRatio,
      watermarkText = 'Micros Santa Cruz · Santa Cruz de la Sierra',
    },
    ref
  ) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const mapRef = useRef<maplibregl.Map | null>(null);
    const threeLayerRef = useRef<ThreeBusLayer | null>(null);
    const exportMapRef = useRef<maplibregl.Map | null>(null);
    const exportLayerRef = useRef<ThreeBusLayer | null>(null);
    const exportContainerRef = useRef<HTMLDivElement | null>(null);
    const exportSamplerRef = useRef<((fraction: number) => AnimationSample) | null>(null);
    const isMountedRef = useRef(false);
    const [mapReady, setMapReady] = useState(false);
    const [previewGeneration, setPreviewGeneration] = useState(0);

    const finishExport = () => {
      const hadExportMap = Boolean(exportMapRef.current || exportContainerRef.current);
      exportMapRef.current?.remove();
      exportMapRef.current = null;
      exportLayerRef.current = null;
      exportContainerRef.current?.remove();
      exportContainerRef.current = null;
      exportSamplerRef.current = null;
      if (hadExportMap && !mapRef.current && isMountedRef.current) {
        setMapReady(false);
        setPreviewGeneration((generation) => generation + 1);
      }
    };

    const prepareExport = async (
      width: number,
      height: number,
      sampleAtProgress: (fraction: number) => AnimationSample
    ) => {
      finishExport();
      const previewMap = mapRef.current;
      mapRef.current = null;
      threeLayerRef.current = null;
      setMapReady(false);
      previewMap?.remove();

      const container = document.createElement('div');
      Object.assign(container.style, {
        position: 'fixed',
        left: '-20000px',
        top: '0',
        width: `${width}px`,
        height: `${height}px`,
        overflow: 'hidden',
        pointerEvents: 'none',
      });
      document.body.appendChild(container);
      exportContainerRef.current = container;
      exportSamplerRef.current = sampleAtProgress;

      const initialSample = sampleAtProgress(0);
      const mapOptions: maplibregl.MapOptions = {
        container,
        style: mapStyleUrl,
        center: initialSample.coords,
        zoom: initialSample.cameraZoom,
        pitch: initialSample.cameraPitch,
        bearing: initialSample.cameraBearing,
        maxPitch: 75,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: true, antialias: false },
        pixelRatio: 1,
        maxCanvasSize: [width, height],
        interactive: false,
        fadeDuration: 0,
      };

      const map = new maplibregl.Map(mapOptions);
      const layerRef: React.MutableRefObject<ThreeBusLayer | null> = { current: null };
      exportMapRef.current = map;

      try {
        await new Promise<void>((resolve, reject) => {
          let loadTimeout: ReturnType<typeof setTimeout>;
          const handleMapLoad = () => {
            clearTimeout(loadTimeout);
            map.off('load', handleMapLoad);
            try {
              initializeNavigationMap(
                map,
                trip,
                initialSample,
                initialSample.coords,
                mapStyleUrl,
                layerRef,
                resolve
              );
            } catch (error) {
              reject(error);
            }
          };
          loadTimeout = setTimeout(() => {
            map.off('load', handleMapLoad);
            reject(new Error('El mapa de exportación tardó demasiado en iniciar.'));
          }, 15000);
          map.on('load', handleMapLoad);
        });

        const layer = layerRef.current;
        if (!layer) throw new Error('No se pudo preparar la capa 3D para exportar.');
        exportLayerRef.current = layer;
        await layer.whenModelReady();

        map.setPixelRatio(0.5);
        for (const fraction of [0, 0.5, 1]) {
          synchronizeMapToSample(map, layer, sampleAtProgress(fraction));
          await waitForIdle(map, 750);
        }
        map.setPixelRatio(1);
        synchronizeMapToSample(map, layer, initialSample);

        if (!(await waitForIdle(map, 15000))) {
          throw new Error('El mapa no terminó de cargar antes de exportar.');
        }

        const canvas = map.getCanvas();
        if (canvas.width !== width || canvas.height !== height) {
          throw new Error('El mapa no alcanzó la resolución solicitada.');
        }
        return canvas;
      } catch (error) {
        finishExport();
        throw error;
      }
    };

    const seekExport = async (fraction: number) => {
      const map = exportMapRef.current;
      const layer = exportLayerRef.current;
      const sampler = exportSamplerRef.current;
      if (!map || !layer || !sampler) {
        throw new Error('La exportación del mapa no está preparada.');
      }

      synchronizeMapToSample(map, layer, sampler(fraction));
      await waitForIdle(map);
    };

    useImperativeHandle(
      ref,
      () => ({
        getCanvas: () => mapRef.current?.getCanvas() || null,
        triggerRepaint: () => mapRef.current?.triggerRepaint(),
        prepareExport,
        seek: seekExport,
        finishExport,
      }),
      [trip, mapStyleUrl]
    );

    useEffect(() => {
      isMountedRef.current = true;
      return () => {
        isMountedRef.current = false;
        finishExport();
      };
    }, []);

    // Initialize MapLibre in 3D pitch/bearing mode
    useEffect(() => {
      if (!containerRef.current) return;

      const startCoords = sample.coords;

      const mapOptions: maplibregl.MapOptions = {
        container: containerRef.current,
        style: mapStyleUrl,
        center: startCoords,
        zoom: 16.5,
        pitch: 56,
        bearing: sample.cameraBearing || 0,
        maxPitch: 75,
        attributionControl: false,
        canvasContextAttributes: { preserveDrawingBuffer: false, antialias: false },
      };

      const map = new maplibregl.Map(mapOptions);
      mapRef.current = map;

      const handleMapLoad = () => {
        initializeNavigationMap(map, trip, sample, startCoords, mapStyleUrl, threeLayerRef, () => setMapReady(true));
      };
      map.on('load', handleMapLoad);

      return () => {
        map.off('load', handleMapLoad);
        if (mapRef.current) {
          mapRef.current.remove();
          mapRef.current = null;
        }
        threeLayerRef.current = null;
      };
    }, [mapStyleUrl, previewGeneration]);

    // Synchronize 3D Vehicle, Live Ground Beacon & Camera with Animation Sample
    useEffect(() => {
      if (!mapReady || !mapRef.current) return;

      const map = mapRef.current;

      const layer = threeLayerRef.current;
      if (layer) synchronizeMapToSample(map, layer, sample);
    }, [sample, mapReady]);

    return (
      <div className="relative w-full h-full overflow-hidden select-none bg-slate-950 flex items-center justify-center">
        {/* MapLibre WebGL Canvas Container */}
        <div
          ref={containerRef}
          className="w-full h-full"
          style={{ width: '100%', height: '100%' }}
        />

        {/* Top Narrative Navigation Pill (Safe for TikTok/Reels/Shorts) */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 px-3.5 py-1.5 rounded-full bg-slate-900/95 backdrop-blur-md border border-white/20 shadow-2xl flex items-center gap-2 max-w-[85%] truncate pointer-events-none">
          <span
            className="w-2.5 h-2.5 rounded-full animate-ping flex-none"
            style={{ backgroundColor: sample.lineColor }}
          />
          <span className="text-xs font-bold text-white truncate">
            {sample.instruction}
          </span>
          <span className="text-[10px] text-slate-300 bg-slate-800/90 px-2 py-0.5 rounded-full font-mono font-semibold border border-white/10">
            {sample.lineLabel}
          </span>
        </div>

        {/* Discrete Brand Watermark for CapCut B-roll (Bottom Safe Zone) */}
        <div className="absolute bottom-2 left-4 z-20 pointer-events-none flex flex-col items-start gap-0.5 opacity-90">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 rounded-md bg-emerald-500 flex items-center justify-center text-[10px] font-black text-slate-950 shadow-md">
              SCZ
            </div>
            <span className="text-[11px] font-semibold text-white drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
              {watermarkText}
            </span>
          </div>
          <span className="ml-7 text-[8px] font-medium text-slate-200 drop-shadow-[0_1px_3px_rgba(0,0,0,0.9)]">
            © OpenStreetMap contributors · OpenFreeMap
          </span>
        </div>

        {/* 3D Heading Compass Pill */}
        <div className="absolute bottom-3 right-4 z-20 pointer-events-none text-[10px] font-mono text-slate-200 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-full border border-white/15 shadow-md flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>3D Nav · {Math.round(sample.bearing)}°</span>
        </div>
      </div>
    );
  }
);
