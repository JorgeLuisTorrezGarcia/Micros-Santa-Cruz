import React from 'react';
import {
  Navigation,
  Trash2,
  HelpCircle,
  Layers,
  BellRing,
  Check,
} from 'lucide-react';
import { MAP_STYLES, type MapStyleKey } from '../utils/map-styles.ts';

interface FloatingActionsProps {
  onToggleLiveLocation: () => void;
  isLiveLocationActive: boolean;
  onClearMap: () => void;
  onOpenHelp: () => void;
  mapStyle: MapStyleKey;
  onMapStyleChange: (style: MapStyleKey) => void;
  mobileDrawerHeight: 'collapsed' | 'half' | 'full';
  onOpenGeofenceModal: () => void;
  isGeofenceActive: boolean;
}

export const FloatingActions: React.FC<FloatingActionsProps> = ({
  onToggleLiveLocation,
  isLiveLocationActive,
  onClearMap,
  onOpenHelp,
  mapStyle,
  onMapStyleChange,
  mobileDrawerHeight,
  onOpenGeofenceModal,
  isGeofenceActive,
}) => {
  const [isMapStyleMenuOpen, setIsMapStyleMenuOpen] = React.useState(false);
  const mapStyleButtonPosition =
    mobileDrawerHeight === 'full'
      ? 'top-20'
      : mobileDrawerHeight === 'half'
        ? 'bottom-[calc(48dvh+0.75rem)]'
        : 'bottom-[calc(4rem+0.75rem)]';
  const mapStyleMenuPosition =
    mobileDrawerHeight === 'full' ? 'top-full mt-2' : 'bottom-full mb-2';

  return (
    <>
      <div className="absolute right-3.5 bottom-24 z-20 flex flex-col items-center gap-2 select-none sm:bottom-6">

        <div className="relative">
          <div
            id="map-style-menu"
            hidden={!isMapStyleMenuOpen}
            className={`absolute right-0 ${mapStyleMenuPosition} w-52 rounded-xl border border-slate-700 bg-slate-900/95 p-2 text-slate-100 shadow-2xl backdrop-blur-md`}
          >
            <p className="px-2 pb-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
              Estilo del mapa
            </p>
            {(Object.keys(MAP_STYLES) as MapStyleKey[]).map((key) => (
              <button
                key={key}
                type="button"
                aria-pressed={mapStyle === key}
                onClick={() => {
                  onMapStyleChange(key);
                  setIsMapStyleMenuOpen(false);
                }}
                className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-xs transition ${
                  mapStyle === key
                    ? 'bg-emerald-600/90 font-semibold text-white'
                    : 'text-slate-200 hover:bg-slate-800'
                }`}
              >
                <span>{MAP_STYLES[key].name}</span>
                {mapStyle === key && <Check className="h-3.5 w-3.5" />}
              </button>
            ))}
          </div>
          <button
            type="button"
            onClick={() => setIsMapStyleMenuOpen((isOpen) => !isOpen)}
            className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-slate-900/90 text-slate-100 shadow-xl transition hover:bg-slate-800 hover:text-white"
            title={`Estilo del mapa: ${MAP_STYLES[mapStyle].name}`}
            aria-label="Cambiar estilo del mapa"
            aria-expanded={isMapStyleMenuOpen}
            aria-controls="map-style-menu"
          >
            <Layers className="h-6 w-6 text-emerald-400" />
          </button>
        </div>

        {/* Geofence / Bajada Alarm button */}
        <button
          onClick={onOpenGeofenceModal}
          className={`w-11 h-11 rounded-2xl shadow-xl border flex items-center justify-center transition group active:scale-95 relative ${
            isGeofenceActive
              ? 'bg-amber-500 text-slate-950 border-amber-300 ring-2 ring-amber-400/50 shadow-amber-500/20'
              : 'bg-slate-900/90 text-slate-100 hover:text-white hover:bg-slate-800 border-white/10'
          }`}
          title="Alerta de Bajada por GPS (Avísame cuando esté cerca)"
          aria-label="Alerta de Bajada por GPS"
        >
          <BellRing
            className={`w-5 h-5 ${
              isGeofenceActive ? 'text-slate-950 animate-bounce' : 'text-amber-400 group-hover:scale-110'
            } transition`}
          />
          {isGeofenceActive && (
            <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-slate-900 animate-pulse" />
          )}
        </button>

        {/* GPS Locate button */}
        <button
          type="button"
          onClick={onToggleLiveLocation}
          aria-pressed={isLiveLocationActive}
          className={`w-11 h-11 rounded-2xl shadow-xl border flex items-center justify-center transition group active:scale-95 ${
            isLiveLocationActive
              ? 'bg-sky-500/20 text-white border-sky-400 ring-2 ring-sky-400/40'
              : 'bg-slate-900/90 text-slate-100 hover:text-white hover:bg-slate-800 border-white/10'
          }`}
          title={
            isLiveLocationActive
              ? 'Detener seguimiento de ubicación'
              : 'Seguir mi ubicación en tiempo real'
          }
          aria-label={
            isLiveLocationActive
              ? 'Detener seguimiento de ubicación'
              : 'Seguir mi ubicación en tiempo real'
          }
        >
          <Navigation
            className={`w-5 h-5 ${
              isLiveLocationActive
                ? 'text-sky-300'
                : 'text-sky-400 group-hover:scale-110'
            } transition`}
          />
        </button>

        {/* Clear active points and selection */}
        <button
          onClick={onClearMap}
          className="w-11 h-11 rounded-2xl bg-slate-900/90 text-slate-100 hover:text-white hover:bg-slate-800 shadow-xl border border-white/10 flex items-center justify-center transition group active:scale-95"
          title="Limpiar mapa (quitar puntos A, B y P)"
          aria-label="Limpiar mapa"
        >
          <Trash2 className="w-5 h-5 text-rose-400 group-hover:scale-110 transition" />
        </button>

        {/* Info / Guide modal */}
        <button
          onClick={onOpenHelp}
          className="w-11 h-11 rounded-2xl bg-slate-900/90 text-slate-100 hover:text-white hover:bg-slate-800 shadow-xl border border-white/10 flex items-center justify-center transition group active:scale-95"
          title="Guía y ayuda sobre los micros de Santa Cruz"
          aria-label="Ver ayuda y guía"
        >
          <HelpCircle className="w-5 h-5 text-indigo-400 group-hover:scale-110 transition" />
        </button>
      </div>
    </>
  );
};

