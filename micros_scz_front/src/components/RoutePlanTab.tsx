import React, { useState, useMemo } from 'react';
import { Coordinates, FavoriteRouteItem, TripOption } from '../types.ts';
import {
  ArrowUpDown,
  Navigation,
  Footprints,
  Clock,
  ArrowRight,
  Route,
  CheckCircle2,
  X,
  BellRing,
  Sparkles,
  Film,
  Star,
  Trash2,
  MessageSquarePlus,
} from 'lucide-react';
import { formatDistance } from '../utils/geo.ts';

interface RoutePlanTabProps {
  pointA: Coordinates | null;
  pointB: Coordinates | null;
  pointAAddress: string;
  pointBAddress: string;
  routeTarget: 'A' | 'B';
  trips: TripOption[];
  activeTrip: TripOption | null;
  isLoading: boolean;
  favoriteTrips?: FavoriteRouteItem[];
  isCurrentTripFavorited?: boolean;
  onSetRouteTarget: (target: 'A' | 'B') => void;
  onSwapPoints: () => void;
  onUseCurrentLocationForA: () => void;
  onClearPoint: (target: 'A' | 'B') => void;
  onSelectTrip: (trip: TripOption) => void;
  onSetGeofenceAlarm?: (target: Coordinates, name: string) => void;
  isGeofenceActive?: boolean;
  onOpenNavigationAnimation?: (trip: TripOption) => void;
  onToggleFavoriteTrip?: () => void;
  onApplyFavoriteTrip?: (fav: FavoriteRouteItem) => void;
  onDeleteFavoriteTrip?: (id: string) => void;
  onOpenFeedbackForTrip?: () => void;
}

interface RouteTripCardProps {
  trip: TripOption;
  activeTrip: TripOption | null;
  expandedTripId: string | null;
  minWalkMeters: number;
  setExpandedTripId: React.Dispatch<React.SetStateAction<string | null>>;
  onSelectTrip: (trip: TripOption) => void;
  onOpenNavigationAnimation?: (trip: TripOption) => void;
}

function RouteTripCard({
  trip,
  activeTrip,
  expandedTripId,
  minWalkMeters,
  setExpandedTripId,
  onSelectTrip,
  onOpenNavigationAnimation,
}: RouteTripCardProps) {
  const isSelected = activeTrip?.id === trip.id;
  const isExpanded = expandedTripId === trip.id;
  const isBestWalk = trip.totalWalkMeters === minWalkMeters && trip.totalWalkMeters <= 350;
  return (
              <div
                key={trip.id}
                onClick={() => {
                  onSelectTrip(trip);
                  setExpandedTripId(isExpanded ? null : trip.id);
                }}
                className={`p-3 rounded-xl border transition cursor-pointer select-none ${
                  isSelected
                    ? 'bg-slate-800/90 border-emerald-500 ring-1 ring-emerald-500/40'
                    : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/70'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 flex-wrap min-w-0">
                    <span className="text-[11px] font-semibold text-emerald-300">
                      {trip.type === 'walk-only'
                        ? 'Solo a pie'
                        : trip.type === 'direct'
                        ? 'Directo'
                        : '1 Transbordo'}
                    </span>
                    {isBestWalk && (
                      <span className="text-[11px] text-emerald-400 flex items-center gap-0.5">
                        · <Sparkles className="w-3 h-3" /> Mínima caminata
                      </span>
                    )}

                    <div className="flex items-center gap-1 text-xs font-semibold text-slate-200">
                      {trip.legs.map((leg, idx) => (
                        <React.Fragment key={idx}>
                          {idx > 0 && (
                            <ArrowRight className="w-3 h-3 text-slate-500" />
                          )}
                          <span className="flex items-center gap-1">
                            <span
                              className="w-2.5 h-2.5 rounded-full inline-block"
                              style={{ backgroundColor: leg.color }}
                            />
                            <span>{leg.routeLabel}</span>
                          </span>
                        </React.Fragment>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-1 text-emerald-400 font-bold text-sm shrink-0 tabular-nums">
                    <Clock className="w-3.5 h-3.5" />
                    <span>~{trip.totalTimeMinutes} min</span>
                  </div>
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 mt-2 tabular-nums">
                  <span className="flex items-center gap-1">
                    <Footprints className="w-3.5 h-3.5 text-emerald-400" />
                    <span>
                      A pie:{' '}
                      <strong
                        className={
                          trip.totalWalkMeters <= 250
                            ? 'text-emerald-300'
                            : 'text-slate-200'
                        }
                      >
                        {formatDistance(trip.totalWalkMeters)}
                      </strong>
                    </span>
                  </span>
                  {trip.totalRideMeters > 0 && (
                    <span>
                      En micro:{' '}
                      <strong className="text-slate-200">
                        {formatDistance(trip.totalRideMeters)}
                      </strong>
                    </span>
                  )}
                  {isSelected && (
                    <span className="ml-auto text-emerald-400 text-[10px] font-semibold flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      Activa
                    </span>
                  )}
                </div>

                {onOpenNavigationAnimation && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectTrip(trip);
                      onOpenNavigationAnimation(trip);
                    }}
                    className="mt-2.5 w-full py-1.5 px-3 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-[0.98] cursor-pointer"
                  >
                    <Film className="w-3.5 h-3.5 text-slate-950" />
                    <span>Animación 3D de Navegación</span>
                  </button>
                )}

                {isExpanded && (
                  <div className="mt-3 pt-2.5 border-t border-slate-700/60 space-y-2 text-xs">
                    <p className="font-semibold text-slate-300 text-[11px]">
                      Itinerario paso a paso (siguiendo calles):
                    </p>
                    {trip.steps.map((step, sIdx) => (
                      <div
                        key={sIdx}
                        className="flex items-start gap-2 text-slate-300 text-[11px]"
                      >
                        <span className="w-4 h-4 rounded-full bg-slate-700 flex items-center justify-center text-[10px] font-bold text-slate-300 flex-none mt-0.5 tabular-nums">
                          {sIdx + 1}
                        </span>
                        <span className="leading-tight">{step}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
}

function FavoriteTripsList({
  favoriteTrips,
  onApplyFavoriteTrip,
  onDeleteFavoriteTrip,
}: {
  favoriteTrips: FavoriteRouteItem[];
  onApplyFavoriteTrip?: (favorite: FavoriteRouteItem) => void;
  onDeleteFavoriteTrip?: (id: string) => void;
}) {
  if (favoriteTrips.length === 0) return null;
  return (
    <>
      {/* Saved Favorite Trips Quick List */}
      {favoriteTrips.length > 0 && (
        <div className="p-2 rounded-xl bg-slate-900/70 border border-slate-800 space-y-1.5">
          <p className="text-[11px] font-semibold text-amber-300 flex items-center gap-1.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="tabular-nums">
              Viajes A → B favoritos ({favoriteTrips.length})
            </span>
          </p>
          <div className="space-y-1 max-h-24 overflow-y-auto pr-0.5">
            {favoriteTrips.map((fav) => (
              <div
                key={fav.id}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-slate-800/70 border border-slate-700/70 text-[11px]"
              >
                <button
                  type="button"
                  onClick={() => onApplyFavoriteTrip?.(fav)}
                  className="text-left text-slate-200 hover:text-emerald-300 truncate flex-1 font-medium"
                >
                  {fav.title}
                </button>
                {onDeleteFavoriteTrip && (
                  <button
                    type="button"
                    onClick={() => onDeleteFavoriteTrip(fav.id)}
                    className="p-0.5 text-slate-500 hover:text-rose-400 transition shrink-0"
                    title="Eliminar viaje favorito"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

type RoutePointsPanelProps = Pick<RoutePlanTabProps,
  | 'pointA' | 'pointB' | 'pointAAddress' | 'pointBAddress' | 'routeTarget'
  | 'favoriteTrips' | 'isCurrentTripFavorited' | 'onSetRouteTarget'
  | 'onSwapPoints' | 'onUseCurrentLocationForA' | 'onClearPoint'
  | 'onToggleFavoriteTrip' | 'onOpenFeedbackForTrip'
>;

const ROUTE_POINT_STYLES = {
  A: {
    activeButton: 'bg-emerald-500 text-white border-emerald-400 ring-2 ring-emerald-500/30',
    inactiveButton: 'bg-emerald-950/80 text-emerald-400 border-emerald-700/60 hover:bg-emerald-900/60',
    activeField: 'bg-slate-900 border-emerald-500/80 text-emerald-300 ring-1 ring-emerald-500/30',
    inactiveField: 'bg-slate-900/60 border-slate-700/70 text-slate-200 hover:border-slate-600',
  },
  B: {
    activeButton: 'bg-rose-500 text-white border-rose-400 ring-2 ring-rose-500/30',
    inactiveButton: 'bg-rose-950/80 text-rose-400 border-rose-700/60 hover:bg-rose-900/60',
    activeField: 'bg-slate-900 border-rose-500/80 text-rose-300 ring-1 ring-rose-500/30',
    inactiveField: 'bg-slate-900/60 border-slate-700/70 text-slate-200 hover:border-slate-600',
  },
} as const;

function PointLocationLabel({
  target,
  active,
  coords,
  address,
}: {
  target: 'A' | 'B';
  active: boolean;
  coords: Coordinates | null;
  address: string;
}) {
  if (coords) {
    return <>{address || `${coords[1].toFixed(5)}, ${coords[0].toFixed(5)}`}</>;
  }

  const prompt = target === 'A' ? 'Fijar Origen A...' : 'Fijar Destino B...';
  return (
    <span className="text-slate-400 italic">
      {active ? `Toca el mapa para fijar Punto ${target}` : prompt}
    </span>
  );
}

function RoutePointField({
  target,
  activeTarget,
  coords,
  address,
  onSetTarget,
  onClearPoint,
  onUseCurrentLocation,
}: {
  target: 'A' | 'B';
  activeTarget: 'A' | 'B';
  coords: Coordinates | null;
  address: string;
  onSetTarget: (target: 'A' | 'B') => void;
  onClearPoint: (target: 'A' | 'B') => void;
  onUseCurrentLocation?: () => void;
}) {
  const isOrigin = target === 'A';
  const isActive = activeTarget === target;
  const styles = ROUTE_POINT_STYLES[target];
  const buttonClass = isActive ? styles.activeButton : styles.inactiveButton;
  const fieldClass = isActive ? styles.activeField : styles.inactiveField;

  return (
    <div className="flex items-center gap-2">
      <button
        onClick={() => onSetTarget(target)}
        className={`w-7 h-7 rounded-lg font-bold text-xs flex items-center justify-center transition border ${buttonClass}`}
        title={`Seleccionar en el mapa para Punto ${target}`}
      >
        {target}
      </button>
      <div
        onClick={() => onSetTarget(target)}
        className={`flex-1 px-2.5 py-1.5 rounded-lg border text-xs cursor-pointer truncate transition ${fieldClass}`}
      >
        <PointLocationLabel
          target={target}
          active={isActive}
          coords={coords}
          address={address}
        />
      </div>
      {isOrigin && (
        <button
          onClick={onUseCurrentLocation}
          className="p-1.5 rounded-lg bg-slate-700/60 hover:bg-slate-700 text-slate-300 hover:text-white transition"
          title="Usar mi ubicación GPS actual"
        >
          <Navigation className="w-3.5 h-3.5 text-emerald-400" />
        </button>
      )}
      {coords && (
        <button
          onClick={() => onClearPoint(target)}
          className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-700/60 transition"
          title={`Limpiar punto ${target}`}
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}

function RoutePointsActions({
  pointA,
  pointB,
  isCurrentTripFavorited,
  onToggleFavoriteTrip,
  onOpenFeedbackForTrip,
}: Pick<RoutePlanTabProps, 'pointA' | 'pointB' | 'isCurrentTripFavorited' | 'onToggleFavoriteTrip' | 'onOpenFeedbackForTrip'>) {
  return (
    <div className="flex items-center justify-between pt-1 text-[11px] gap-2">
      <span className="text-slate-400 truncate">
        {pointA && pointB
          ? 'Calculado con red de calles'
          : 'Selecciona ambos puntos para calcular'}
      </span>
      <div className="flex items-center gap-1.5 shrink-0">
        {pointA && pointB && onToggleFavoriteTrip && (
          <button
            type="button"
            onClick={onToggleFavoriteTrip}
            className={`px-2 py-0.5 rounded-md border text-[11px] font-medium flex items-center gap-1 transition ${
              isCurrentTripFavorited
                ? 'bg-amber-950/60 border-amber-700/60 text-amber-300'
                : 'bg-slate-900/80 border-slate-700 text-slate-300 hover:text-white'
            }`}
            title="Guardar trayecto A → B en favoritos"
          >
            <Star
              className={`w-3 h-3 ${
                isCurrentTripFavorited
                  ? 'text-amber-400 fill-amber-400'
                  : 'text-slate-400'
              }`}
            />
            <span>{isCurrentTripFavorited ? 'Guardado' : 'Guardar'}</span>
          </button>
        )}
        {pointA && pointB && onOpenFeedbackForTrip && (
          <button
            type="button"
            onClick={onOpenFeedbackForTrip}
            className="p-1 rounded-md bg-slate-900/80 border border-slate-700 text-slate-400 hover:text-slate-200 transition"
            title="Reportar precisión de este viaje"
          >
            <MessageSquarePlus className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
}

function RoutePointsPanel(props: RoutePointsPanelProps) {
  const {
    pointA, pointB, pointAAddress, pointBAddress, routeTarget,
    favoriteTrips = [], isCurrentTripFavorited = false, onSetRouteTarget,
    onSwapPoints, onUseCurrentLocationForA, onClearPoint,
    onToggleFavoriteTrip, onOpenFeedbackForTrip,
  } = props;
  return (
    <>
      {/* Origin / Destination Box */}
      <div className="p-3 rounded-xl bg-slate-800/70 border border-slate-700/80 space-y-2 relative">
        <RoutePointField
          target="A"
          activeTarget={routeTarget}
          coords={pointA}
          address={pointAAddress}
          onSetTarget={onSetRouteTarget}
          onClearPoint={onClearPoint}
          onUseCurrentLocation={onUseCurrentLocationForA}
        />

        {/* Swap points & separator */}
        <div className="flex items-center justify-between px-2">
          <div className="h-px bg-slate-700/60 flex-1 ml-7 mr-2" />
          <button
            onClick={onSwapPoints}
            className="p-1 rounded-md bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-600/60"
            title="Invertir Origen y Destino"
          >
            <ArrowUpDown className="w-3 h-3 text-slate-300" />
          </button>
        </div>

        <RoutePointField
          target="B"
          activeTarget={routeTarget}
          coords={pointB}
          address={pointBAddress}
          onSetTarget={onSetRouteTarget}
          onClearPoint={onClearPoint}
        />

        <RoutePointsActions
          pointA={pointA}
          pointB={pointB}
          isCurrentTripFavorited={isCurrentTripFavorited}
          onToggleFavoriteTrip={onToggleFavoriteTrip}
          onOpenFeedbackForTrip={onOpenFeedbackForTrip}
        />
      </div>
    </>
  );
}

export const RoutePlanTab: React.FC<RoutePlanTabProps> = ({
  pointA,
  pointB,
  pointAAddress,
  pointBAddress,
  routeTarget,
  trips,
  activeTrip,
  isLoading,
  favoriteTrips = [],
  isCurrentTripFavorited = false,
  onSetRouteTarget,
  onSwapPoints,
  onUseCurrentLocationForA,
  onClearPoint,
  onSelectTrip,
  onSetGeofenceAlarm,
  isGeofenceActive,
  onOpenNavigationAnimation,
  onToggleFavoriteTrip,
  onApplyFavoriteTrip,
  onDeleteFavoriteTrip,
  onOpenFeedbackForTrip,
}) => {
  const [expandedTripId, setExpandedTripId] = useState<string | null>(
    activeTrip?.id || null
  );

  const minWalkMeters = useMemo(() => {
    if (trips.length === 0) return Infinity;
    return Math.min(...trips.map((t) => t.totalWalkMeters));
  }, [trips]);

  return (
    <div className="flex flex-col h-full space-y-2.5">
      <RoutePointsPanel
        pointA={pointA}
        pointB={pointB}
        pointAAddress={pointAAddress}
        pointBAddress={pointBAddress}
        routeTarget={routeTarget}
        favoriteTrips={favoriteTrips}
        isCurrentTripFavorited={isCurrentTripFavorited}
        onSetRouteTarget={onSetRouteTarget}
        onSwapPoints={onSwapPoints}
        onUseCurrentLocationForA={onUseCurrentLocationForA}
        onClearPoint={onClearPoint}
        onToggleFavoriteTrip={onToggleFavoriteTrip}
        onOpenFeedbackForTrip={onOpenFeedbackForTrip}
      />

      <FavoriteTripsList
        favoriteTrips={favoriteTrips}
        onApplyFavoriteTrip={onApplyFavoriteTrip}
        onDeleteFavoriteTrip={onDeleteFavoriteTrip}
      />

      {/* Geofence Proximity Alarm banner for Point B */}
      {pointB && onSetGeofenceAlarm && (
        <div className="p-2.5 rounded-xl bg-amber-950/40 border border-amber-600/40 text-xs flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-amber-500/20 text-amber-400 shrink-0">
              <BellRing className="w-4 h-4 animate-pulse" />
            </div>
            <div className="min-w-0">
              <p className="font-semibold text-amber-200 text-xs truncate">
                {isGeofenceActive
                  ? 'Alerta de Bajada Activa'
                  : 'Alerta de Bajada GPS'}
              </p>
              <p className="text-[11px] text-slate-300 truncate">
                {isGeofenceActive
                  ? 'Avisará con sonido y vibración al llegar'
                  : 'Avísame a 100, 200 o 300 m antes del destino'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() =>
              onSetGeofenceAlarm(pointB, pointBAddress || 'Punto B (Destino)')
            }
            className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 transition ${
              isGeofenceActive
                ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                : 'bg-amber-600 hover:bg-amber-500 text-white'
            }`}
          >
            {isGeofenceActive ? 'Configurar' : 'Activar'}
          </button>
        </div>
      )}

      {/* Trip Calculation Results Header */}
      <div className="flex items-center justify-between text-xs px-0.5">
        <span className="text-slate-300 font-medium tabular-nums">
          {isLoading
            ? 'Calculando mejores combinaciones con calles...'
            : pointA && pointB
            ? `${trips.length} opción(es) priorizando menor caminata`
            : 'Fija los puntos A y B en el mapa'}
        </span>
      </div>

      {/* Trips list */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
        {!pointA || !pointB ? (
          <div className="text-center py-8 px-4 text-slate-400">
            <Route className="w-10 h-10 mx-auto text-slate-600 mb-2 stroke-1" />
            <p className="font-medium text-slate-300">Planificador de Rutas</p>
            <p className="text-xs mt-1 text-slate-400 leading-relaxed">
              1. Toca <strong>A</strong> o haz clic en el mapa para marcar tu
              origen.
              <br />
              2. Toca <strong>B</strong> en tu destino para calcular la ruta que
              te haga <strong>caminar lo menos posible</strong>.
            </p>
          </div>
        ) : trips.length === 0 ? (
          <div className="text-center py-8 px-4 bg-slate-800/30 rounded-xl border border-slate-800 text-slate-400">
            <p className="font-medium text-slate-300">
              Sin ruta directa cercana
            </p>
            <p className="text-xs mt-1 text-slate-400">
              Prueba tocando un punto más cercano a una avenida, radial o anillo
              principal de Santa Cruz.
            </p>
          </div>
        ) : (
          trips.map((trip) => (
            <RouteTripCard
              key={trip.id}
              trip={trip}
              activeTrip={activeTrip}
              expandedTripId={expandedTripId}
              minWalkMeters={minWalkMeters}
              setExpandedTripId={setExpandedTripId}
              onSelectTrip={onSelectTrip}
              onOpenNavigationAnimation={onOpenNavigationAnimation}
            />
          ))
        )}
      </div>
    </div>
  );
};
