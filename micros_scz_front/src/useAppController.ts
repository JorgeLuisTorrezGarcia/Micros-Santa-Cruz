import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import {
  CommunityPOIItem,
  Coordinates,
  DatasetStats,
  FavoriteRouteItem,
  FeedbackTargetType,
  NearResult,
  PlaceCategoryItem,
  RouteItem,
  TripOption,
  GeofenceAlarmConfig,
  CustomDatasetConfig,
  UserProfile,
} from './types.ts';
import { routeWorkerService } from './workers/worker-client.ts';
import { getUserFriendlyError } from './services/apiClient.ts';
import {
  bootstrapCommunity,
  createFavoriteRoute,
  deleteCommunityPlace,
  deleteFavoriteRoute,
  fetchCurrentUser,
  closeSession,
} from './services/communityService.ts';
import {
  mergeStaticAndCommunityCategories,
  mergeStaticAndCommunityPlaces,
} from './utils/communityMerge.ts';
import { haversineDistance } from './utils/geo.ts';
import { startAlarmLoop, stopAlarmLoop } from './utils/audioAlarm.ts';
import { useToast } from './hooks/useToast.ts';



export function useAppController() {
  // Routes & Data state
  const [routes, setRoutes] = useState<RouteItem[]>([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [geoJsonData, setGeoJsonData] = useState<any>(null);
  const [visibleRouteIds, setVisibleRouteIds] = useState<Set<string>>(new Set());
  const [highlightedRouteId, setHighlightedRouteId] = useState<string | null>(null);
  const [stats, setStats] = useState<DatasetStats | null>(null);
  const [staticPois, setStaticPois] = useState<CommunityPOIItem[]>([]);
  const [communityPois, setCommunityPois] = useState<CommunityPOIItem[]>([]);
  const [staticCategoryNames, setStaticCategoryNames] = useState<string[]>([]);
  const [communityCategories, setCommunityCategories] = useState<PlaceCategoryItem[]>([]);
  const [selectedPOI, setSelectedPOI] = useState<CommunityPOIItem | null>(null);

  // Auth, PostgreSQL sync, Favorites, Feedback & Moderation state
  const [user, setUser] = useState<UserProfile | null>(null);
  const [dbConfigured, setDbConfigured] = useState<boolean>(false);
  const [favorites, setFavorites] = useState<FavoriteRouteItem[]>([]);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isFeedbackModalOpen, setIsFeedbackModalOpen] = useState<boolean>(false);
  const [feedbackDefaultTarget, setFeedbackDefaultTarget] = useState<{
    type: FeedbackTargetType;
    ref: string;
  }>({ type: 'app', ref: '' });
  const [isTransportComplaintModalOpen, setIsTransportComplaintModalOpen] =
    useState(false);
  const [isPickingComplaintCoords, setIsPickingComplaintCoords] = useState(false);
  const [transportComplaintCoords, setTransportComplaintCoords] =
    useState<Coordinates | null>(null);
  const [transportComplaintLocationAccuracy, setTransportComplaintLocationAccuracy] =
    useState<number | null>(null);
  const [transportComplaintResetToken, setTransportComplaintResetToken] =
    useState(0);
  const [isModerationOpen, setIsModerationOpen] = useState<boolean>(false);
  const [isAddPlaceModalOpen, setIsAddPlaceModalOpen] = useState<boolean>(false);
  const [isPickingPlaceCoords, setIsPickingPlaceCoords] = useState<boolean>(false);
  const [pickedPlaceCoords, setPickedPlaceCoords] = useState<Coordinates | null>(null);

  const pois = useMemo(
    () => mergeStaticAndCommunityPlaces(staticPois, communityPois),
    [staticPois, communityPois]
  );

  const allCategories = useMemo(
    () => mergeStaticAndCommunityCategories(staticCategoryNames, communityCategories),
    [staticCategoryNames, communityCategories]
  );

  const favoriteLines = useMemo(
    () => favorites.filter((f) => f.kind === 'line'),
    [favorites]
  );

  const favoriteTrips = useMemo(
    () => favorites.filter((f) => f.kind === 'trip_ab'),
    [favorites]
  );

  // Isolated Custom Dataset state (for technical user overlay without altering micro routes)
  const [customDataset, setCustomDataset] = useState<CustomDatasetConfig>({
    geoJson: null,
    fileName: '',
    featureCount: 0,
    isVisible: false,
    color: '#8b5cf6',
  });

  // Active navigation / tab
  const [activeTab, setActiveTab] = useState<
    'copilot' | 'lines' | 'near' | 'route' | 'places' | 'dataset'
  >('copilot');

  // Near mode state
  const [pointP, setPointP] = useState<Coordinates | null>(null);
  const [nearResults, setNearResults] = useState<NearResult[]>([]);
  const [searchRadiusMeters, setSearchRadiusMeters] = useState<number>(500);

  // Route Planning mode state
  const [pointA, setPointA] = useState<Coordinates | null>(null);
  const [pointB, setPointB] = useState<Coordinates | null>(null);
  const [pointAAddress, setPointAAddress] = useState<string>('');
  const [pointBAddress, setPointBAddress] = useState<string>('');
  const [routeTarget, setRouteTarget] = useState<'A' | 'B'>('A');
  const [trips, setTrips] = useState<TripOption[]>([]);
  const [activeTrip, setActiveTrip] = useState<TripOption | null>(null);

  // Geofence / Proximity Drop-off Alarm state
  const [alarmConfig, setAlarmConfig] = useState<GeofenceAlarmConfig>({
    isActive: false,
    targetCoords: null,
    targetName: '',
    thresholdMeters: 200,
    soundEnabled: true,
    vibrateEnabled: true,
    isTriggered: false,
    currentDistanceMeters: null,
    currentAccuracyMeters: null,
  });
  const [isGeofenceModalOpen, setIsGeofenceModalOpen] = useState<boolean>(false);
  const [isSoundMuted, setIsSoundMuted] = useState<boolean>(false);
  const [isSimulatingApproach, setIsSimulatingApproach] = useState<boolean>(false);
  const simulationIntervalRef = useRef<number | null>(null);
  const watchPositionIdRef = useRef<number | null>(null);
  const liveLocationWatchIdRef = useRef<number | null>(null);
  const liveLocationSessionRef = useRef(0);
  const [liveLocation, setLiveLocation] = useState<Coordinates | null>(null);
  const [isLiveLocationActive, setIsLiveLocationActive] = useState(false);

  // 3D Navigation Map Animation state
  const [isAnimationModalOpen, setIsAnimationModalOpen] = useState<boolean>(false);
  const [selectedAnimationTrip, setSelectedAnimationTrip] = useState<TripOption | null>(null);

  const handleOpenNavigationAnimation = useCallback((trip: TripOption) => {
    setSelectedAnimationTrip(trip);
    setIsAnimationModalOpen(true);
  }, []);

  // Loading & UI state
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toastMessage, showToast } = useToast();
  const [isHelpOpen, setIsHelpOpen] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [mobileDrawerHeight, setMobileDrawerHeight] = useState<'collapsed' | 'half' | 'full'>('half');

  // Load Initial Base Routes Dataset
  const loadDefaultDataset = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/data/rutas_micro_scz.geojson');
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const text = await response.text();
      const res = await routeWorkerService.initData({
        geoJsonText: text,
        fileName: 'rutas_micro_scz.geojson',
        fileSizeBytes: text.length,
      });

      setRoutes(res.routes);
      setGeoJsonData(res.geoJson);
      setStats(res.stats);

      // Make all base routes visible initially
      const ids = new Set(res.routes.map((r) => r.id));
      setVisibleRouteIds(ids);

      showToast(`¡${res.routes.length} rutas cargadas en ${res.stats.loadTimeMs} ms!`);
    } catch (err: unknown) {
      console.error('Error cargando rutas predeterminadas:', err);
      showToast('No pudimos cargar las rutas. Intenta actualizar la página.');
    } finally {
      setIsLoading(false);
    }
  }, [showToast]);

  // Load Santa Cruz static offline POIs & categories (immutable base)
  useEffect(() => {
    fetch('/data/lugares_scz.json')
      .then((r) => (r.ok ? r.json() : []))
      .then((items) => {
        if (Array.isArray(items)) {
          setStaticPois(items);
        }
      })
      .catch((e) => console.warn('Could not load POIs', e));

    fetch('/data/categoria_lugares.json')
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (json && Array.isArray(json.data)) {
          const names = json.data
            .map((d: { type_name?: string }) => d.type_name)
            .filter((n: unknown): n is string => typeof n === 'string');
          setStaticCategoryNames(names);
        }
      })
      .catch((e) => console.warn('Could not load categories', e));
  }, []);

  const refreshCommunityData = useCallback(async () => {
    try {
      const data = await bootstrapCommunity();
      setDbConfigured(Boolean(data.dbConfigured));
      setCommunityCategories(Array.isArray(data.categories) ? data.categories : []);
      setCommunityPois(Array.isArray(data.places) ? data.places : []);
      setFavorites(Array.isArray(data.favorites) ? data.favorites : []);
    } catch {
      // Offline or external API temporarily unreachable: static offline mode remains active
      setDbConfigured(false);
    }
  }, []);

  useEffect(() => {
    fetchCurrentUser()
      .then((u) => setUser(u))
      .catch(() => setUser(null))
      .finally(() => refreshCommunityData());
  }, [refreshCommunityData]);

  // Load Santa Cruz Streets dataset for enriched A->B step-by-step guidance
  useEffect(() => {
    fetch('/data/calles_scz.geojson')
      .then((r) => (r.ok ? r.json() : null))
      .then((geoJsonObject) => {
        if (geoJsonObject) {
          routeWorkerService
            .initStreets(geoJsonObject)
            .then((res) => console.log(`Red de calles cargada offline: ${res.count} segmentos`))
            .catch((e) => console.warn('Error inicializando calles:', e));
        }
      })
      .catch((e) => console.warn('Could not load streets dataset:', e));
  }, []);

  useEffect(() => {
    loadDefaultDataset();
  }, [loadDefaultDataset]);

  // Handle custom file upload in Dataset Tab as an isolated technical layer
  // (Preserves rutas_micro_scz.geojson as the immutable truth for bus routes)
  const handleLoadCustomFile = async (file: File) => {
    setIsLoading(true);
    showToast(`Cargando ${file.name}...`);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const count = parsed?.features?.length || 0;

      setCustomDataset({
        geoJson: parsed,
        fileName: file.name,
        featureCount: count,
        isVisible: true,
        color: '#8b5cf6',
      });

      showToast(`Agregamos ${count} elementos de ${file.name} al mapa.`);
    } catch (err: unknown) {
      console.error('Error cargando archivo GeoJSON personalizado:', err);
      showToast('No pudimos abrir el archivo. Verifica que sea un GeoJSON válido e inténtalo de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleCustomDatasetVisibility = () => {
    setCustomDataset((prev) => ({
      ...prev,
      isVisible: !prev.isVisible,
    }));
  };

  const handleChangeCustomDatasetColor = (color: string) => {
    setCustomDataset((prev) => ({
      ...prev,
      color,
    }));
  };

  const handleClearCustomDataset = () => {
    setCustomDataset({
      geoJson: null,
      fileName: '',
      featureCount: 0,
      isVisible: false,
      color: '#8b5cf6',
    });
    showToast('Capa personalizada removida');
  };

  // Run Near Query whenever pointP or searchRadiusMeters changes
  useEffect(() => {
    if (!pointP) {
      setNearResults([]);
      return;
    }

    let isSubscribed = true;
    routeWorkerService
      .queryNear(pointP, searchRadiusMeters)
      .then((results) => {
        if (isSubscribed) {
          setNearResults(results);
          // Auto-visible nearest routes
          if (results.length > 0) {
            const nearIds = new Set(results.map((r) => r.routeId));
            setVisibleRouteIds(nearIds);
          }
        }
      })
      .catch((err) => {
        console.error('Error al buscar líneas cercanas:', err);
        if (isSubscribed) {
          showToast('No pudimos buscar las líneas cercanas. Inténtalo nuevamente.');
        }
      });

    return () => {
      isSubscribed = false;
    };
  }, [pointP, searchRadiusMeters, showToast]);

  // Run Route Planning whenever pointA, pointB, or params change
  useEffect(() => {
    if (!pointA || !pointB) {
      setTrips([]);
      setActiveTrip(null);
      return;
    }

    let isSubscribed = true;
    setIsLoading(true);

    routeWorkerService
      .queryPlan({
        pointA,
        pointB,
        searchRadiusMeters: 350,
        maxTransferMeters: 180,
        enforceDirection: true,
      })
      .then((calculatedTrips) => {
        if (isSubscribed) {
          setTrips(calculatedTrips);
          if (calculatedTrips.length > 0) {
            setActiveTrip(calculatedTrips[0]);
            // Hide full bus routes so only the calculated trip path + line name is shown
            setVisibleRouteIds(new Set());
            setHighlightedRouteId(null);
          } else {
            setActiveTrip(null);
          }
        }
      })
      .catch((err) => {
        console.error('Error al calcular las rutas:', err);
        if (isSubscribed) {
          showToast('No pudimos calcular las rutas. Inténtalo nuevamente.');
        }
      })
      .finally(() => {
        if (isSubscribed) setIsLoading(false);
      });

    return () => {
      isSubscribed = false;
    };
  }, [pointA, pointB, showToast]);

  // Map Click Handler: responds based on activeTab or coordinate picking
  const handleMapClickPoint = (coords: Coordinates) => {
    if (isPickingComplaintCoords) {
      setTransportComplaintCoords(coords);
      setTransportComplaintLocationAccuracy(null);
      setIsPickingComplaintCoords(false);
      setIsTransportComplaintModalOpen(true);
      showToast('Ubicación del incidente añadida');
      return;
    }

    if (isPickingPlaceCoords) {
      setPickedPlaceCoords(coords);
      setIsPickingPlaceCoords(false);
      setIsAddPlaceModalOpen(true);
      showToast('Ubicación capturada del mapa');
      return;
    }

    if (activeTab === 'near') {
      setPointP(coords);
      showToast('Punto de consulta fijado');
    } else if (activeTab === 'route') {
      if (routeTarget === 'A') {
        setPointA(coords);
        setPointAAddress('');
        setRouteTarget('B');
        showToast('Punto A fijado. Ahora toca tu destino B');
      } else {
        setPointB(coords);
        setPointBAddress('');
        showToast('Punto B fijado. Calculando rutas...');
      }
    } else {
      // In other modes, click sets point P and switches to near mode for convenience
      setPointP(coords);
      setActiveTab('near');
      showToast('Punto seleccionado para consulta cercana');
    }
  };

  // GPS Locate User
  const handleLocateUser = () => {
    if (!navigator.geolocation) {
      showToast('Este dispositivo no permite compartir tu ubicación. Puedes fijar el punto en el mapa.');
      return;
    }

    showToast('Buscando señal GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coords: Coordinates = [pos.coords.longitude, pos.coords.latitude];
        if (activeTab === 'route') {
          if (routeTarget === 'A') {
            setPointA(coords);
            setPointAAddress('Mi ubicación actual');
            setRouteTarget('B');
            showToast('Punto A fijado con tu GPS');
          } else {
            setPointB(coords);
            setPointBAddress('Mi ubicación actual');
            showToast('Punto B fijado con tu GPS');
          }
        } else {
          setPointP(coords);
          setActiveTab('near');
          showToast('Ubicación GPS establecida');
        }
      },
      (err) => {
        console.warn('Geolocation error:', err);
        showToast('No pudimos obtener tu ubicación. Revisa los permisos o fija el punto en el mapa.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const handleToggleLiveLocation = useCallback(() => {
    if (isLiveLocationActive) {
      liveLocationSessionRef.current += 1;
      if (
        liveLocationWatchIdRef.current !== null &&
        typeof navigator !== 'undefined' &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(liveLocationWatchIdRef.current);
        liveLocationWatchIdRef.current = null;
      }
      setIsLiveLocationActive(false);
      setLiveLocation(null);
      showToast('Seguimiento de ubicación detenido');
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Este dispositivo no permite compartir tu ubicación.');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      showToast('Para usar tu ubicación, abre la aplicación mediante una conexión segura.');
      return;
    }

    const sessionId = liveLocationSessionRef.current + 1;
    liveLocationSessionRef.current = sessionId;
    setLiveLocation(null);
    setIsLiveLocationActive(true);
    showToast('Solicitando acceso a tu ubicación...');

    let hasReportedTemporaryIssue = false;
    let hasAnnouncedLocation = false;
    let watchId: number;
    try {
      watchId = navigator.geolocation.watchPosition(
        (position) => {
          if (liveLocationSessionRef.current !== sessionId) return;
          setLiveLocation([position.coords.longitude, position.coords.latitude]);
          if (!hasAnnouncedLocation) {
            showToast('Ubicación activa. Tus coordenadas no se guardan en la app.');
            hasAnnouncedLocation = true;
          }
        },
        (error) => {
          if (liveLocationSessionRef.current !== sessionId) return;
          console.warn('Live location error:', error);

          if (error.code === GeolocationPositionError.PERMISSION_DENIED) {
            liveLocationSessionRef.current += 1;
            if (liveLocationWatchIdRef.current !== null) {
              navigator.geolocation.clearWatch(liveLocationWatchIdRef.current);
              liveLocationWatchIdRef.current = null;
            }
            setIsLiveLocationActive(false);
            setLiveLocation(null);
            showToast('No se concedió el permiso de ubicación. Puedes activarlo en los ajustes del navegador.');
            return;
          }

          if (!hasReportedTemporaryIssue) {
            showToast('La señal GPS no está disponible por el momento. Seguiremos intentando obtener tu ubicación.');
            hasReportedTemporaryIssue = true;
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 3000,
          timeout: 10000,
        }
      );
    } catch (error: unknown) {
      liveLocationSessionRef.current += 1;
      console.error('Could not start live geolocation tracking:', error);
      setIsLiveLocationActive(false);
      setLiveLocation(null);
      showToast('No pudimos iniciar la ubicación. Revisa los permisos del navegador e inténtalo nuevamente.');
      return;
    }

    liveLocationWatchIdRef.current = watchId;
  }, [isLiveLocationActive, showToast]);

  // GPS watcher for Geofence Proximity Alarm
  useEffect(() => {
    if (!alarmConfig.isActive || isSimulatingApproach || !alarmConfig.targetCoords) {
      if (watchPositionIdRef.current !== null && typeof navigator !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
      return;
    }

    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      showToast('Este dispositivo no permite compartir tu ubicación; la alarma no podrá seguir tu recorrido.');
      return;
    }

    const [tLon, tLat] = alarmConfig.targetCoords;

    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const uLon = pos.coords.longitude;
        const uLat = pos.coords.latitude;
        const dist = Math.round(haversineDistance(uLon, uLat, tLon, tLat));

        setAlarmConfig((prev) => {
          const shouldTrigger = !prev.isTriggered && dist <= prev.thresholdMeters;
          if (shouldTrigger) {
            startAlarmLoop(prev.soundEnabled, prev.vibrateEnabled);
          }
          return {
            ...prev,
            currentDistanceMeters: dist,
            currentAccuracyMeters: Math.round(pos.coords.accuracy),
            isTriggered: prev.isTriggered || shouldTrigger,
          };
        });
      },
      (err) => {
        console.warn('Geolocation watch error:', err);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 3000,
        timeout: 10000,
      }
    );

    watchPositionIdRef.current = id;

    return () => {
      if (watchPositionIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchPositionIdRef.current);
        watchPositionIdRef.current = null;
      }
    };
  }, [alarmConfig.isActive, isSimulatingApproach, alarmConfig.targetCoords, showToast]);

  // Clean up alarm sound & vibrations on unmount
  useEffect(() => {
    return () => {
      stopAlarmLoop();
      liveLocationSessionRef.current += 1;
      if (
        liveLocationWatchIdRef.current !== null &&
        typeof navigator !== 'undefined' &&
        navigator.geolocation
      ) {
        navigator.geolocation.clearWatch(liveLocationWatchIdRef.current);
        liveLocationWatchIdRef.current = null;
      }
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
      }
    };
  }, []);

  const handleActivateGeofence = (
    targetCoords: Coordinates,
    targetName: string,
    threshold: number,
    sound: boolean,
    vibrate: boolean
  ) => {
    stopAlarmLoop();
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsSimulatingApproach(false);

    setAlarmConfig({
      isActive: true,
      targetCoords,
      targetName,
      thresholdMeters: threshold,
      soundEnabled: sound,
      vibrateEnabled: vibrate,
      isTriggered: false,
      currentDistanceMeters: null,
      currentAccuracyMeters: null,
    });
    setIsSoundMuted(false);
    showToast(`🔔 Alarma activada: te avisará a ${threshold} m de ${targetName}`);
  };

  const handleDeactivateGeofence = () => {
    stopAlarmLoop();
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsSimulatingApproach(false);
    setAlarmConfig((prev) => ({
      ...prev,
      isActive: false,
      isTriggered: false,
    }));
    showToast('Alarma de bajada cancelada');
  };

  const handleStopAlarm = () => {
    stopAlarmLoop();
    if (simulationIntervalRef.current) {
      clearInterval(simulationIntervalRef.current);
      simulationIntervalRef.current = null;
    }
    setIsSimulatingApproach(false);
    setAlarmConfig((prev) => ({
      ...prev,
      isActive: false,
      isTriggered: false,
    }));
    showToast('¡Llegada confirmada! Alarma detenida.');
  };

  const handleMuteSound = () => {
    stopAlarmLoop();
    setIsSoundMuted(true);
    showToast('Sonido silenciado');
  };

  const handleOpenGeofenceForTarget = (coords: Coordinates, name: string) => {
    setAlarmConfig((prev) => ({
      ...prev,
      targetCoords: coords,
      targetName: name,
    }));
    setIsGeofenceModalOpen(true);
  };

  const handleSimulateApproach = () => {
    if (isSimulatingApproach) {
      if (simulationIntervalRef.current) {
        clearInterval(simulationIntervalRef.current);
        simulationIntervalRef.current = null;
      }
      setIsSimulatingApproach(false);
      showToast('Simulación detenida');
      return;
    }

    const target = alarmConfig.targetCoords || pointB || pointP || [-63.1821, -17.7833];
    const name =
      alarmConfig.targetName ||
      (pointB ? pointBAddress || 'Punto B (Destino)' : 'Destino en Santa Cruz');
    const threshold = alarmConfig.thresholdMeters || 200;

    setIsSimulatingApproach(true);
    setAlarmConfig((prev) => ({
      ...prev,
      isActive: true,
      targetCoords: target,
      targetName: name,
      thresholdMeters: threshold,
      isTriggered: false,
      currentDistanceMeters: 550,
    }));
    showToast('Simulando avance en micro hacia el destino...');

    let currentDist = 550;
    simulationIntervalRef.current = window.setInterval(() => {
      currentDist -= 90;
      if (currentDist <= 40) currentDist = 40;

      setAlarmConfig((prev) => {
        const triggered = !prev.isTriggered && currentDist <= prev.thresholdMeters;
        if (triggered) {
          startAlarmLoop(prev.soundEnabled, prev.vibrateEnabled);
          if (simulationIntervalRef.current) {
            clearInterval(simulationIntervalRef.current);
            simulationIntervalRef.current = null;
          }
          setIsSimulatingApproach(false);
        }
        return {
          ...prev,
          currentDistanceMeters: currentDist,
          isTriggered: prev.isTriggered || triggered,
        };
      });
    }, 1200);
  };

  // Toggle Visibility of a Route

  const handleToggleRouteVisibility = (routeId: string) => {
    setVisibleRouteIds((prev) => {
      const next = new Set(prev);
      if (next.has(routeId)) {
        next.delete(routeId);
      } else {
        next.add(routeId);
      }
      return next;
    });
    // Immediately clear highlight if the unselected route was highlighted
    setHighlightedRouteId((prev) => (prev === routeId ? null : prev));
  };

  const handleShowAllRoutes = () => {
    setVisibleRouteIds(new Set(routes.map((r) => r.id)));
    showToast('Todas las líneas visibles');
  };

  const handleHideAllRoutes = () => {
    setVisibleRouteIds(new Set());
    setHighlightedRouteId(null);
    showToast('Líneas ocultadas');
  };

  const handleHighlightRoute = (routeId: string) => {
    if (!routeId) {
      setHighlightedRouteId(null);
      return;
    }
    setHighlightedRouteId(routeId);
    setVisibleRouteIds((prev) => new Set([...prev, routeId]));
  };

  const handleSelectTrip = useCallback((trip: TripOption) => {
    setActiveTrip(trip);
    setVisibleRouteIds(new Set());
    setHighlightedRouteId(null);
  }, []);

  const handleClearMap = () => {
    setPointA(null);
    setPointB(null);
    setPointP(null);
    setPointAAddress('');
    setPointBAddress('');
    setTrips([]);
    setActiveTrip(null);
    setHighlightedRouteId(null);
    setSelectedPOI(null);
    showToast('Puntos eliminados del mapa');
  };

  const handleSwapPoints = () => {
    const tempCoords = pointA;
    const tempAddr = pointAAddress;
    setPointA(pointB);
    setPointAAddress(pointBAddress);
    setPointB(tempCoords);
    setPointBAddress(tempAddr);
    showToast('Origen y Destino invertidos');
  };

  const handleSetPointAs = (type: 'A' | 'B', coords: Coordinates, name?: string) => {
    if (type === 'A') {
      setPointA(coords);
      setPointAAddress(name || '');
      setRouteTarget('B');
    } else {
      setPointB(coords);
      setPointBAddress(name || '');
    }
    setActiveTab('route');
    showToast(`Punto ${type} establecido: ${name || 'Coordenadas'}`);
  };

  const handleZoomToRoute = (route: RouteItem) => {
    handleHighlightRoute(route.id);
  };

  const handleOpenFeedback = useCallback(
    (type: FeedbackTargetType = 'app', ref = '') => {
      setFeedbackDefaultTarget({ type, ref });
      setIsFeedbackModalOpen(true);
    },
    []
  );

  const handleOpenTransportComplaint = useCallback(() => {
    setTransportComplaintCoords(null);
    setTransportComplaintLocationAccuracy(null);
    setIsPickingComplaintCoords(false);
    setTransportComplaintResetToken((token) => token + 1);
    setIsTransportComplaintModalOpen(true);
  }, []);

  const handleStartPickComplaintCoords = useCallback(() => {
    setIsTransportComplaintModalOpen(false);
    setIsPickingComplaintCoords(true);
  }, []);

  const handleCancelPickComplaintCoords = useCallback(() => {
    setIsPickingComplaintCoords(false);
    setIsTransportComplaintModalOpen(true);
  }, []);

  const handleSetTransportComplaintLocation = useCallback(
    (coordinates: Coordinates | null, accuracyMeters: number | null = null) => {
      setTransportComplaintCoords(coordinates);
      setTransportComplaintLocationAccuracy(accuracyMeters);
    },
    []
  );

  const handleSignOut = useCallback(async () => {
    try {
      await closeSession();
      setUser(null);
      setFavorites([]);
      refreshCommunityData();
      showToast('Sesión cerrada');
    } catch (error) {
      console.error('No se pudo cerrar la sesión en el servidor:', error);
      showToast(getUserFriendlyError(error, 'No pudimos cerrar tu sesión. Inténtalo nuevamente.'));
    }
  }, [refreshCommunityData, showToast]);

  const handleToggleFavoriteLine = useCallback(
    async (route: RouteItem) => {
      if (!user) {
        setIsAuthModalOpen(true);
        showToast('Inicia sesión con Google para guardar líneas favoritas');
        return;
      }

      const existing = favoriteLines.find((f) => f.routeId === route.id);
      try {
        if (existing) {
          await deleteFavoriteRoute(existing.id);
          showToast(`${route.label} quitada de favoritas`);
        } else {
          await createFavoriteRoute({
            kind: 'line',
            title: `${route.label} (${route.direction === 1 ? 'Ida' : 'Vuelta'})`,
            routeId: route.id,
          });
          showToast(`${route.label} guardada en favoritas`);
        }
        await refreshCommunityData();
      } catch (err: unknown) {
        console.error('Error al actualizar tus líneas favoritas:', err);
        showToast(getUserFriendlyError(err, 'No pudimos actualizar tus favoritos. Inténtalo nuevamente.'));
      }
    },
    [user, favoriteLines, refreshCommunityData, showToast]
  );

  const matchingTripFavorite = useMemo(() => {
    if (!pointA || !pointB) return null;
    return (
      favoriteTrips.find(
        (f) =>
          f.originLat != null &&
          f.originLon != null &&
          f.destLat != null &&
          f.destLon != null &&
          Math.abs(f.originLat - pointA[1]) < 0.0005 &&
          Math.abs(f.originLon - pointA[0]) < 0.0005 &&
          Math.abs(f.destLat - pointB[1]) < 0.0005 &&
          Math.abs(f.destLon - pointB[0]) < 0.0005
      ) || null
    );
  }, [favoriteTrips, pointA, pointB]);

  const handleToggleFavoriteTrip = useCallback(async () => {
    if (!pointA || !pointB) return;
    if (!user) {
      setIsAuthModalOpen(true);
      showToast('Inicia sesión con Google para guardar viajes favoritos');
      return;
    }

    try {
      if (matchingTripFavorite) {
        await deleteFavoriteRoute(matchingTripFavorite.id);
        showToast('Ruta quitado de favoritos');
      } else {
        const originLabel =
          pointAAddress || `${pointA[1].toFixed(4)}, ${pointA[0].toFixed(4)}`;
        const destLabel =
          pointBAddress || `${pointB[1].toFixed(4)}, ${pointB[0].toFixed(4)}`;
        await createFavoriteRoute({
          kind: 'trip_ab',
          title: `${originLabel} → ${destLabel}`,
          originName: originLabel,
          originLat: pointA[1],
          originLon: pointA[0],
          destName: destLabel,
          destLat: pointB[1],
          destLon: pointB[0],
          tripSummary: activeTrip?.summary || null,
        });
        showToast('Ruta guardado en favoritos');
      }
      await refreshCommunityData();
    } catch (err: unknown) {
      console.error('Error al actualizar tus viajes favoritos:', err);
      showToast(getUserFriendlyError(err, 'No pudimos actualizar tus favoritos. Inténtalo nuevamente.'));
    }
  }, [
    pointA,
    pointB,
    pointAAddress,
    pointBAddress,
    user,
    matchingTripFavorite,
    activeTrip,
    refreshCommunityData,
    showToast,
  ]);

  const handleApplyFavoriteTrip = useCallback(
    (fav: FavoriteRouteItem) => {
      if (
        fav.originLon == null ||
        fav.originLat == null ||
        fav.destLon == null ||
        fav.destLat == null
      ) {
        return;
      }
      setPointA([fav.originLon, fav.originLat]);
      setPointAAddress(fav.originName || 'Origen guardado');
      setPointB([fav.destLon, fav.destLat]);
      setPointBAddress(fav.destName || 'Destino guardado');
      setActiveTab('route');
      showToast(`Cargando viaje favorito: ${fav.title}`);
    },
    [showToast]
  );

  const handleDeleteFavorite = useCallback(
    async (id: string) => {
      try {
        await deleteFavoriteRoute(id);
        await refreshCommunityData();
        showToast('Favorito eliminado');
      } catch (err: unknown) {
        console.error('Error al eliminar el favorito:', err);
        showToast(getUserFriendlyError(err, 'No pudimos eliminar el favorito. Inténtalo nuevamente.'));
      }
    },
    [refreshCommunityData, showToast]
  );

  const handleDeletePlace = useCallback(
    async (id: string) => {
      try {
        await deleteCommunityPlace(id);
        await refreshCommunityData();
        showToast('Lugar eliminado');
      } catch (err: unknown) {
        console.error('Error al eliminar el lugar:', err);
        showToast(getUserFriendlyError(err, 'No pudimos eliminar el lugar. Inténtalo nuevamente.'));
      }
    },
    [refreshCommunityData, showToast]
  );

  // Landmark coordinate dictionary for common Santa Cruz references
  const SCZ_LANDMARKS: Record<string, Coordinates> = useMemo(
    () => ({
      'el cristo': [-63.1818, -17.7695],
      'cristo redentor': [-63.1818, -17.7695],
      'plaza 24 de septiembre': [-63.1821, -17.7833],
      'plaza principal': [-63.1821, -17.7833],
      'centro': [-63.1821, -17.7833],
      'parque urbano': [-63.1706, -17.7885],
      'uagrm': [-63.1912, -17.7758],
      'la gabriel': [-63.1912, -17.7758],
      'campus': [-63.1912, -17.7758],
      'ventura': [-63.1992, -17.755],
      'ventura mall': [-63.1992, -17.755],
      'las brisas': [-63.1793, -17.7516],
      'ramada': [-63.1925, -17.794],
      'mercado la ramada': [-63.1925, -17.794],
      'pozos': [-63.1765, -17.7788],
      'mercado los pozos': [-63.1765, -17.7788],
      'mutualista': [-63.163, -17.769],
      'mercado mutualista': [-63.163, -17.769],
      'terminal bimodal': [-63.1615, -17.7925],
      'bimodal': [-63.1615, -17.7925],
      'aeropuerto el trompillo': [-63.18, -17.808],
      'cine center': [-63.174, -17.797],
    }),
    []
  );

  const resolveLocationCoords = useCallback(
    (name: string): { coords: Coordinates; label: string } | null => {
      if (!name) return null;
      const q = name.toLowerCase().trim();

      // Check landmarks map
      for (const [key, coords] of Object.entries(SCZ_LANDMARKS)) {
        if (q.includes(key) || key.includes(q)) {
          return { coords, label: name };
        }
      }

      // Check POIs list
      const matchedPOI =
        pois.find((p) => p.name.toLowerCase() === q) ||
        pois.find((p) => p.name.toLowerCase().includes(q) || q.includes(p.name.toLowerCase())) ||
        pois.find((p) => p.dir && (p.dir.toLowerCase().includes(q) || q.includes(p.dir.toLowerCase())));

      if (matchedPOI) {
        return { coords: [matchedPOI.lon, matchedPOI.lat], label: matchedPOI.name };
      }

      // Fallback to center of Santa Cruz
      return { coords: [-63.1821, -17.7833], label: name };
    },
    [pois, SCZ_LANDMARKS]
  );

  // Copilot Action Executions
  const handleExecutePlanRoute = useCallback(
    (originName: string, destName: string) => {
      const origin = resolveLocationCoords(originName);
      const dest = resolveLocationCoords(destName);

      if (origin) {
        setPointA(origin.coords);
        setPointAAddress(origin.label);
      }
      if (dest) {
        setPointB(dest.coords);
        setPointBAddress(dest.label);
      }
      setActiveTab('route');
      showToast(`Copiloto: calculando viaje de "${originName}" a "${destName}"`);
    },
    [resolveLocationCoords, showToast]
  );

  const handleExecuteNearby = useCallback(
    (locationName: string, radiusMeters?: number) => {
      const loc = resolveLocationCoords(locationName);
      if (loc) {
        setPointP(loc.coords);
        if (radiusMeters) setSearchRadiusMeters(radiusMeters);
        setActiveTab('near');
        showToast(`Copiloto: buscando micros cerca de "${locationName}"`);
      }
    },
    [resolveLocationCoords, showToast]
  );

  const handleExecuteHighlightLine = useCallback(
    (lineIdOrNumber: string) => {
      const cleanNum = lineIdOrNumber.replace(/[^0-9a-zA-Z]/g, '').toLowerCase();
      const matched = routes.find(
        (r) =>
          r.id.toLowerCase().includes(cleanNum) ||
          r.label.toLowerCase().includes(cleanNum) ||
          r.label.toLowerCase().includes(lineIdOrNumber.toLowerCase())
      );

      if (matched) {
        setVisibleRouteIds(new Set([matched.id]));
        setHighlightedRouteId(matched.id);
        setActiveTab('lines');
        showToast(`Copiloto: mostrando recorrido de ${matched.label}`);
      } else {
        showToast(`No se encontró la línea "${lineIdOrNumber}" en el sistema.`);
      }
    },
    [routes, showToast]
  );

  const handleExecuteGeofence = useCallback(
    (targetName: string, thresholdMeters?: number) => {
      const loc = resolveLocationCoords(targetName);
      const threshold = thresholdMeters || 200;
      if (loc) {
        handleActivateGeofence(loc.coords, loc.label, threshold, true, true);
      } else if (pointB) {
        handleActivateGeofence(pointB, pointBAddress || targetName, threshold, true, true);
      } else {
        showToast(`Fija el destino en el mapa para activar la alarma.`);
      }
    },
    [resolveLocationCoords, pointB, pointBAddress, handleActivateGeofence, showToast]
  );

  const handleExecuteExplorePlaces = useCallback(
    (category?: string, query?: string) => {
      setActiveTab('places');
      showToast(`Copiloto: explorando ${category || query || 'lugares'}`);
    },
    [showToast]
  );

  return {
    routes, geoJsonData, visibleRouteIds, setVisibleRouteIds, highlightedRouteId,
    setHighlightedRouteId, stats, pois, allCategories, favoriteLines, favoriteTrips,
    selectedPOI, setSelectedPOI, customDataset, activeTab, setActiveTab,
    isLoading, toastMessage, showToast, isHelpOpen, setIsHelpOpen,
    isSidebarCollapsed, setIsSidebarCollapsed, mobileDrawerHeight, setMobileDrawerHeight,
    pointP, setPointP, nearResults, searchRadiusMeters, setSearchRadiusMeters,
    pointA, setPointA, pointB, setPointB, pointAAddress, pointBAddress,
    routeTarget, setRouteTarget, trips, activeTrip, alarmConfig, isGeofenceModalOpen,
    setIsGeofenceModalOpen, isSimulatingApproach,
    liveLocation, isLiveLocationActive,
    isAnimationModalOpen, setIsAnimationModalOpen, selectedAnimationTrip,
    isAuthModalOpen, setIsAuthModalOpen, isFeedbackModalOpen, setIsFeedbackModalOpen,
    isTransportComplaintModalOpen, setIsTransportComplaintModalOpen,
    isPickingComplaintCoords, transportComplaintCoords,
    transportComplaintLocationAccuracy, transportComplaintResetToken,
    handleOpenTransportComplaint, handleStartPickComplaintCoords,
    handleCancelPickComplaintCoords, handleSetTransportComplaintLocation,
    feedbackDefaultTarget, isModerationOpen, setIsModerationOpen,
    isAddPlaceModalOpen, setIsAddPlaceModalOpen, isPickingPlaceCoords,
    setIsPickingPlaceCoords, pickedPlaceCoords, dbConfigured, user, setUser, handleOpenFeedback,
    handleOpenNavigationAnimation, handleMapClickPoint, handleHighlightRoute,
    handleExecutePlanRoute, handleExecuteNearby, handleExecuteHighlightLine,
    handleExecuteGeofence, handleExecuteExplorePlaces, handleToggleRouteVisibility,
    handleShowAllRoutes, handleHideAllRoutes, handleZoomToRoute, handleToggleFavoriteLine,
    handleSetPointAs, handleLocateUser, handleToggleLiveLocation, handleSwapPoints,
    handleSelectTrip, handleClearMap,
    matchingTripFavorite, handleToggleFavoriteTrip, handleApplyFavoriteTrip,
    handleDeleteFavorite, handleDeletePlace, handleOpenGeofenceForTarget,
    handleActivateGeofence, handleDeactivateGeofence, handleSimulateApproach,
    handleStopAlarm, handleMuteSound, isSoundMuted, handleSignOut, refreshCommunityData,
    handleLoadCustomFile, loadDefaultDataset, handleToggleCustomDatasetVisibility,
    handleChangeCustomDatasetColor, handleClearCustomDataset,
  };
}
