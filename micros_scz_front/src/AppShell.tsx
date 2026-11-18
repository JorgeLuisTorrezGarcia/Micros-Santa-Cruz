import React, { useEffect, useRef, useState } from 'react';
import { MapComponent } from './components/MapComponent.tsx';
import { LinesTab } from './components/LinesTab.tsx';
import { NearTab } from './components/NearTab.tsx';
import { RoutePlanTab } from './components/RoutePlanTab.tsx';
import { PlacesTab } from './components/PlacesTab.tsx';
import { DatasetTab } from './components/DatasetTab.tsx';
import { FloatingActions } from './components/FloatingActions.tsx';
import { InfoModal } from './components/InfoModal.tsx';
import { GeofenceModal } from './components/GeofenceModal.tsx';
import { GeofenceTriggerModal } from './components/GeofenceTriggerModal.tsx';
import { GeofenceActiveBanner } from './components/GeofenceActiveBanner.tsx';
import { CopilotTab } from './components/CopilotTab.tsx';
import { NavigationAnimationModal } from './components/NavigationAnimationModal.tsx';
import { AuthModal } from './components/AuthModal.tsx';
import { FeedbackModal } from './components/FeedbackModal.tsx';
import { TransportComplaintModal } from './components/TransportComplaintModal.tsx';
import { ModerationModal } from './components/ModerationModal.tsx';
import { AddPlaceModal } from './components/AddPlaceModal.tsx';
import {
  Bus,
  MapPin,
  Route as RouteIcon,
  Radar,
  FileCode,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  User,
  ShieldCheck,
  MessageSquarePlus,
  Siren,
} from 'lucide-react';
import { useAppController } from './useAppController.ts';
import { type MapStyleKey } from './utils/map-styles.ts';

type AppController = ReturnType<typeof useAppController>;
type AppShellProps = { controller: AppController };
type AppNavigationProps = AppShellProps & { tabsConfig: typeof tabsConfig };
type MapStyleProps = {
  mapStyle: MapStyleKey;
  onMapStyleChange: (style: MapStyleKey) => void;
};

const tabsConfig = [
    { id: 'copilot', label: 'MicroBot scz', icon: Sparkles },
    { id: 'lines', label: 'Líneas', icon: Bus },
    { id: 'near', label: 'Cerca', icon: Radar },
    { id: 'route', label: 'Navegación', icon: RouteIcon },
    { id: 'places', label: 'Lugares', icon: MapPin },
    { id: 'dataset', label: 'Agregar', icon: FileCode },
  ] as const;

function AppHeader({ controller, tabsConfig }: AppNavigationProps) {
  const { stats, activeTab, setActiveTab, isSidebarCollapsed, setIsSidebarCollapsed, isLoading, user, setIsModerationOpen, handleOpenFeedback, handleOpenTransportComplaint, setIsAuthModalOpen, setIsHelpOpen } = controller;
  return (
    <>
      {/* Top Navbar */}
      <header className="relative z-30 flex flex-none flex-row items-center justify-between bg-slate-900/95 px-3 pt-[env(safe-area-inset-top)] shadow-md backdrop-blur-md border-b border-slate-800 select-none md:h-14 md:px-4 md:pt-0">
        <div className="flex h-14 min-w-0 flex-1 items-center gap-3 md:flex-none">
          <div
            role="img"
            aria-label="Micros Santa Cruz"
            title="Micros Santa Cruz"
            className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-green-400 flex items-center justify-center text-white shadow-md shadow-emerald-950/50"
          >
            <Bus className="w-4 h-4" />
          </div>
          <span className="inline-flex md:hidden text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-white-400 border border-emerald-500/30">
            Santa Cruz 
          </span>
          <div className="hidden min-w-0 md:block">
            <div className="flex items-center gap-2">
              <h1 className="truncate font-bold text-xs sm:text-base text-white tracking-tight">
                Micros Santa Cruz
              </h1>
              <span className="hidden sm:inline-flex text-[10px] px-1.5 py-0.5 rounded font-bold bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                SCZ 🇧🇴
              </span>
            </div>
            <p className="text-[10px] text-slate-400 hidden sm:block">
              {stats
                ? `${stats.routeCount} rutas listas para consultar`
                : 'Cargando rutas...'}
            </p>
          </div>
        </div>

        {/* Desktop Navigation Tabs */}
        <div className="hidden md:flex items-center gap-1 bg-slate-800/80 p-1 rounded-xl border border-slate-700/80">
          {tabsConfig.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                data-testid={`desktop-tab-${tab.id}`}
                aria-label={`Pestaña ${tab.label}`}
                onClick={() => {
                  setActiveTab(tab.id);
                  if (isSidebarCollapsed) setIsSidebarCollapsed(false);
                }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                  isActive
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700/50'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Right Header Status & Account */}
        <div className="hidden md:flex items-center gap-1.5 sm:gap-2">
          {isLoading && (
            <div className="hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-950/80 border border-emerald-700/60 text-emerald-300 text-xs animate-pulse">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Procesando...</span>
            </div>
          )}

          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setIsModerationOpen(true)}
              data-testid="moderation-button"
              className="px-2.5 py-1.5 rounded-xl bg-emerald-950/80 hover:bg-emerald-900 text-emerald-300 border border-emerald-700/70 text-xs font-semibold transition flex items-center gap-1.5 cursor-pointer"
              title="Moderación comunitaria"
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span className="hidden lg:inline">Moderar</span>
            </button>
          )}

          <button
            type="button"
            onClick={handleOpenTransportComplaint}
            data-testid="transport-complaint-button"
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-amber-950/70 hover:bg-amber-900 text-amber-100 border border-amber-800/70 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            title="Registrar una denuncia de transporte"
            aria-label="Denunciar un incidente"
          >
            <Siren className="w-3.5 h-3.5 text-amber-300" />
            <span className="hidden sm:inline">Denunciar</span>
          </button>

          <button
            type="button"
            onClick={() => handleOpenFeedback('app', '')}
            data-testid="feedback-button"
            className="p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            title="Enviar feedback o reportar ruta"
            aria-label="Enviar feedback"
          >
            <MessageSquarePlus className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden lg:inline">Feedback</span>
          </button>

          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            data-testid="auth-button"
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            title={user ? `Cuenta: ${user.displayName}` : 'Iniciar sesión con Google'}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt={user.displayName}
                className="w-4 h-4 rounded-full object-cover"
              />
            ) : (
              <User className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span className="hidden sm:inline max-w-[100px] truncate">
              {user ? user.displayName.split(' ')[0] : 'Ingresar'}
            </span>
          </button>

          <button
            onClick={() => setIsHelpOpen(true)}
            className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-medium transition flex items-center gap-1.5 cursor-pointer"
            title="Guía y Ayuda"
          >
            <span className="hidden sm:inline">Guía</span>
            <span className="text-[10px] bg-slate-700 px-1.5 py-0.2 rounded-md">?</span>
          </button>
        </div>

        <div className="flex flex-none items-center gap-1 md:hidden">
          <button
            type="button"
            onClick={handleOpenTransportComplaint}
            data-testid="transport-complaint-button-mobile"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-amber-800/70 bg-amber-950/70 text-amber-100 transition hover:bg-amber-900"
            aria-label="Denunciar un incidente"
          >
            <Siren className="h-3.5 w-3.5 flex-none text-amber-300" />
          </button>
          <button
            type="button"
            onClick={() => handleOpenFeedback('app', '')}
            data-testid="feedback-button-mobile"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700"
            aria-label="Enviar feedback"
          >
            <MessageSquarePlus className="h-3.5 w-3.5 flex-none text-emerald-400" />
          </button>
          <button
            type="button"
            onClick={() => setIsAuthModalOpen(true)}
            data-testid="auth-button-mobile"
            className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-slate-700 bg-slate-800 text-slate-200 transition hover:bg-slate-700"
            title={user ? `Cuenta: ${user.displayName}` : 'Iniciar sesión con Google'}
            aria-label={user ? `Cuenta: ${user.displayName}` : 'Iniciar sesión'}
          >
            {user?.avatarUrl ? (
              <img
                src={user.avatarUrl}
                alt=""
                className="h-3.5 w-3.5 flex-none rounded-full object-cover"
              />
            ) : (
              <User className="h-3.5 w-3.5 flex-none text-emerald-400" />
            )}
          </button>
          {user?.role === 'admin' && (
            <button
              type="button"
              onClick={() => setIsModerationOpen(true)}
              data-testid="moderation-button-mobile"
              className="flex h-10 w-10 flex-none items-center justify-center rounded-xl border border-emerald-700/70 bg-emerald-950/80 text-emerald-300 transition hover:bg-emerald-900"
              aria-label="Moderar reportes"
            >
              <ShieldCheck className="h-3.5 w-3.5 flex-none" />
            </button>
          )}
        </div>
      </header>
    </>
  );
}

function AppMap({
  controller,
  mapStyle,
  onMapStyleChange,
}: AppShellProps & MapStyleProps) {
  const { geoJsonData, visibleRouteIds, highlightedRouteId, pointP, pointA, pointB, activeTrip, selectedPOI, pois, activeTab, routeTarget, handleMapClickPoint, handleHighlightRoute, setSelectedPOI, searchRadiusMeters, customDataset } = controller;
  return (
    <>
        {/* Full-screen MapLibre GL instance */}
        <MapComponent
          geoJsonData={geoJsonData}
          visibleRouteIds={visibleRouteIds}
          highlightedRouteId={highlightedRouteId}
          pointP={pointP}
          pointA={pointA}
          pointB={pointB}
          activeTrip={activeTrip}
          selectedPOI={selectedPOI}
          allPOIs={pois}
          activeMode={activeTab}
          routeTarget={routeTarget}
          onMapClickPoint={handleMapClickPoint}
          onSelectRoute={handleHighlightRoute}
          onSelectPOI={setSelectedPOI}
          searchRadiusMeters={searchRadiusMeters}
          mapStyle={mapStyle}
          onMapStyleChange={onMapStyleChange}
          customDataset={customDataset}
        />
    </>
  );
}

function getSidebarStatusLabel(controller: AppController) {
  const { activeTab, routes, pointP, nearResults, pointA, pointB, trips, pois } = controller;
  const labels = {
    copilot: 'Asistente de rutas',
    lines: `${routes.length} líneas`,
    near: pointP ? `${nearResults.length} cercanas` : 'Sin punto',
    route: pointA && pointB ? `${trips.length} rutas` : 'A → B',
    places: `${pois.length} lugares`,
    dataset: 'Datos del mapa',
  };
  return labels[activeTab];
}

function renderDesktopSidebarContent(controller: AppController): React.ReactNode {
  const {
    activeTab, routes, pois, visibleRouteIds, highlightedRouteId, favoriteLines,
    pointP, nearResults, searchRadiusMeters, isLoading, pointA, pointB,
    pointAAddress, pointBAddress, routeTarget, trips, activeTrip, favoriteTrips,
    matchingTripFavorite, alarmConfig, selectedPOI, user, dbConfigured, stats,
    customDataset, handleExecutePlanRoute, handleExecuteNearby,
    handleExecuteHighlightLine, handleExecuteGeofence, handleExecuteExplorePlaces,
    handleToggleRouteVisibility, handleShowAllRoutes, handleHideAllRoutes,
    handleHighlightRoute, handleZoomToRoute, handleToggleFavoriteLine,
    handleOpenFeedback, setSearchRadiusMeters, handleLocateUser, setPointP,
    handleSetPointAs, setRouteTarget, handleSwapPoints, setPointA, setPointB,
    handleSelectTrip, handleOpenGeofenceForTarget, handleOpenNavigationAnimation,
    handleToggleFavoriteTrip, handleApplyFavoriteTrip, handleDeleteFavorite,
    setSelectedPOI, setIsAddPlaceModalOpen, handleDeletePlace, handleLoadCustomFile,
    loadDefaultDataset, handleToggleCustomDatasetVisibility,
    handleChangeCustomDatasetColor, handleClearCustomDataset,
  } = controller;

  switch (activeTab) {
    case 'copilot':
      return (
        <CopilotTab
          pois={pois}
          routes={routes}
          onExecutePlanRoute={handleExecutePlanRoute}
          onExecuteNearby={handleExecuteNearby}
          onExecuteHighlightLine={handleExecuteHighlightLine}
          onExecuteGeofence={handleExecuteGeofence}
          onExecuteExplorePlaces={handleExecuteExplorePlaces}
          onNavigateToTab={controller.setActiveTab}
        />
      );
    case 'lines':
      return (
        <LinesTab
          routes={routes}
          visibleRouteIds={visibleRouteIds}
          highlightedRouteId={highlightedRouteId}
          favoriteLines={favoriteLines}
          onToggleRouteVisibility={handleToggleRouteVisibility}
          onShowAllRoutes={handleShowAllRoutes}
          onHideAllRoutes={handleHideAllRoutes}
          onHighlightRoute={handleHighlightRoute}
          onZoomToRoute={handleZoomToRoute}
          onToggleFavoriteLine={handleToggleFavoriteLine}
          onOpenFeedbackForLine={(label) => handleOpenFeedback('line', label)}
        />
      );
    case 'near':
      return (
        <NearTab
          pointP={pointP}
          nearResults={nearResults}
          searchRadiusMeters={searchRadiusMeters}
          isLoading={isLoading}
          onSetSearchRadius={setSearchRadiusMeters}
          onUseCurrentLocation={handleLocateUser}
          onClearPointP={() => setPointP(null)}
          onHighlightRoute={handleHighlightRoute}
          onSetPointAs={handleSetPointAs}
        />
      );
    case 'route':
      return (
        <RoutePlanTab
          pointA={pointA}
          pointB={pointB}
          pointAAddress={pointAAddress}
          pointBAddress={pointBAddress}
          routeTarget={routeTarget}
          trips={trips}
          activeTrip={activeTrip}
          isLoading={isLoading}
          favoriteTrips={favoriteTrips}
          isCurrentTripFavorited={Boolean(matchingTripFavorite)}
          onSetRouteTarget={setRouteTarget}
          onSwapPoints={handleSwapPoints}
          onUseCurrentLocationForA={handleLocateUser}
          onClearPoint={(target) => target === 'A' ? setPointA(null) : setPointB(null)}
          onSelectTrip={handleSelectTrip}
          onSetGeofenceAlarm={handleOpenGeofenceForTarget}
          isGeofenceActive={alarmConfig.isActive}
          onOpenNavigationAnimation={handleOpenNavigationAnimation}
          onToggleFavoriteTrip={handleToggleFavoriteTrip}
          onApplyFavoriteTrip={handleApplyFavoriteTrip}
          onDeleteFavoriteTrip={handleDeleteFavorite}
          onOpenFeedbackForTrip={() =>
            handleOpenFeedback(
              'trip',
              `${pointAAddress || 'Punto A'} -> ${pointBAddress || 'Punto B'}`
            )
          }
        />
      );
    case 'places':
      return (
        <PlacesTab
          pois={pois}
          selectedPOI={selectedPOI}
          user={user}
          dbConfigured={dbConfigured}
          onSelectPOI={setSelectedPOI}
          onSetPointAs={handleSetPointAs}
          onFlyToPOI={setSelectedPOI}
          onSetGeofenceAlarm={handleOpenGeofenceForTarget}
          onOpenAddPlace={() => setIsAddPlaceModalOpen(true)}
          onDeletePlace={handleDeletePlace}
          onOpenFeedbackForPlace={(name) => handleOpenFeedback('place', name)}
        />
      );
    case 'dataset':
      return (
        <DatasetTab
          stats={stats}
          isLoading={isLoading}
          onLoadCustomFile={handleLoadCustomFile}
          onResetDefaultDataset={loadDefaultDataset}
          customDataset={customDataset}
          onToggleCustomDatasetVisibility={handleToggleCustomDatasetVisibility}
          onChangeCustomDatasetColor={handleChangeCustomDatasetColor}
          onClearCustomDataset={handleClearCustomDataset}
        />
      );
  }
}

function AppDesktopSidebar({ controller, tabsConfig }: AppNavigationProps) {
  const { isSidebarCollapsed, setIsSidebarCollapsed, activeTab } = controller;
  return (
    <>
        {/* Desktop Left Floating Sidebar */}
        <div
          className={`hidden md:flex flex-col absolute top-3 left-3 bottom-3 z-20 w-96 lg:w-[26rem] bg-slate-900/92 backdrop-blur-xl border border-slate-700/70 rounded-2xl shadow-2xl transition-all duration-300 ${
            isSidebarCollapsed ? '-translate-x-[calc(100%+1rem)]' : 'translate-x-0'
          }`}
        >
          {/* Sidebar Top bar */}
          <div className="p-3 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-slate-100">
                {tabsConfig.find((t) => t.id === activeTab)?.label}
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-800 text-slate-300 border border-slate-700">
                {getSidebarStatusLabel(controller)}
              </span>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setIsSidebarCollapsed(true)}
                className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
                title="Ocultar panel lateral"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Sidebar Body with active tab component */}
          <div className="flex-1 p-3 overflow-hidden">
            {renderDesktopSidebarContent(controller)}
          </div>
        </div>
    </>
  );
}

function AppSidebarRestore({ controller }: AppShellProps) {
  const { isSidebarCollapsed, setIsSidebarCollapsed } = controller;
  return (
    <>
        {/* Collapsed Sidebar Restore Tab */}
        {isSidebarCollapsed && (
          <button
            onClick={() => setIsSidebarCollapsed(false)}
            className="hidden md:flex absolute top-4 left-3 z-20 items-center gap-1.5 px-3 py-2 bg-slate-900/90 backdrop-blur-md border border-slate-700/80 rounded-xl shadow-xl text-xs font-semibold text-slate-200 hover:text-white transition"
          >
            <ChevronRight className="w-4 h-4 text-emerald-400" />
            <span>Abrir panel</span>
          </button>
        )}
    </>
  );
}

function AppMobileDrawer({ controller, tabsConfig }: AppNavigationProps) {
  const { activeTab, setActiveTab, mobileDrawerHeight, setMobileDrawerHeight, routes, pois, pointP, nearResults, searchRadiusMeters, isLoading, visibleRouteIds, highlightedRouteId, favoriteLines, pointA, pointB, pointAAddress, pointBAddress, routeTarget, trips, activeTrip, favoriteTrips, matchingTripFavorite, alarmConfig, selectedPOI, user, dbConfigured, stats, customDataset, handleExecutePlanRoute, handleExecuteNearby, handleExecuteHighlightLine, handleExecuteGeofence, handleExecuteExplorePlaces, handleToggleRouteVisibility, handleShowAllRoutes, handleHideAllRoutes, handleHighlightRoute, handleZoomToRoute, handleToggleFavoriteLine, handleOpenFeedback, setSearchRadiusMeters, handleLocateUser, setPointP, handleSetPointAs, setRouteTarget, handleSwapPoints, setPointA, setPointB, handleSelectTrip, handleOpenGeofenceForTarget, handleOpenNavigationAnimation, handleToggleFavoriteTrip, handleApplyFavoriteTrip, handleDeleteFavorite, setSelectedPOI, setIsAddPlaceModalOpen, handleDeletePlace, handleLoadCustomFile, loadDefaultDataset, handleToggleCustomDatasetVisibility, handleChangeCustomDatasetColor, handleClearCustomDataset } = controller;
  const mobileTabContainerRef = useRef<HTMLDivElement>(null);
  const mobileTabItemRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  useEffect(() => {
    const el = mobileTabItemRefs.current[activeTab];
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
  }, [activeTab]);
  return (
    <>
        {/* Mobile Bottom Sheet Drawer */}
        <div
          className={`md:hidden flex flex-col absolute left-0 right-0 bottom-0 z-30 pb-[env(safe-area-inset-bottom)] bg-slate-900/95 backdrop-blur-xl border-t border-slate-700/80 rounded-t-2xl shadow-2xl transition-all duration-300 ${
            mobileDrawerHeight === 'collapsed'
              ? 'h-16'
              : mobileDrawerHeight === 'half'
              ? 'h-[48dvh]'
              : 'h-[85dvh]'
          }`}
        >
          {/* Drawer Handle & Tabs */}
          <div className="flex-none p-2 border-b border-slate-800 flex items-center justify-between gap-1">
            <div className="flex items-center min-w-0 flex-1 relative">
              <button
                type="button"
                onClick={() => {
                  mobileTabContainerRef.current?.scrollBy({ left: -110, behavior: 'smooth' });
                }}
                className="p-1 -ml-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg shrink-0 transition"
                aria-label="Desplazar pestañas a la izquierda"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>

              <div
                ref={mobileTabContainerRef}
                className="flex items-center gap-1.5 overflow-x-auto no-scrollbar touch-pan-x scroll-smooth flex-1 min-w-0 px-1 py-0.5"
              >
                {tabsConfig.map((tab) => {
                  const Icon = tab.icon;
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      ref={(el) => {
                        mobileTabItemRefs.current[tab.id] = el;
                      }}
                      data-testid={`mobile-tab-${tab.id}`}
                      aria-label={`Pestaña ${tab.label}`}
                      onClick={() => {
                        setActiveTab(tab.id);
                        if (mobileDrawerHeight === 'collapsed') {
                          setMobileDrawerHeight('half');
                        }
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold shrink-0 select-none whitespace-nowrap transition active:scale-95 ${
                        isActive
                          ? 'bg-emerald-600 text-white shadow-md shadow-emerald-950/60 font-bold'
                          : 'text-slate-300 bg-slate-800/80 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      <Icon className="w-3.5 h-3.5" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => {
                  mobileTabContainerRef.current?.scrollBy({ left: 110, behavior: 'smooth' });
                }}
                className="p-1 -mr-1 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg shrink-0 transition"
                aria-label="Desplazar pestañas a la derecha"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => {
                setMobileDrawerHeight((prev) =>
                  prev === 'collapsed' ? 'half' : prev === 'half' ? 'full' : 'collapsed'
                );
              }}
              className="p-1.5 rounded-xl bg-slate-800/90 text-slate-300 hover:text-white flex-none border border-slate-700/60 ml-1 transition hover:bg-slate-700"
              title="Expandir o colapsar menú"
              aria-label="Expandir o colapsar panel móvil"
            >
              {mobileDrawerHeight === 'collapsed' ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          </div>

          {/* Drawer Content */}
          {mobileDrawerHeight !== 'collapsed' && (
            <div className="flex-1 p-3 overflow-y-auto">
              {activeTab === 'copilot' && (
                <CopilotTab
                  pois={pois}
                  routes={routes}
                  onExecutePlanRoute={handleExecutePlanRoute}
                  onExecuteNearby={handleExecuteNearby}
                  onExecuteHighlightLine={handleExecuteHighlightLine}
                  onExecuteGeofence={handleExecuteGeofence}
                  onExecuteExplorePlaces={handleExecuteExplorePlaces}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                />
              )}

              {activeTab === 'lines' && (
                <LinesTab
                  routes={routes}
                  visibleRouteIds={visibleRouteIds}
                  highlightedRouteId={highlightedRouteId}
                  favoriteLines={favoriteLines}
                  onToggleRouteVisibility={handleToggleRouteVisibility}
                  onShowAllRoutes={handleShowAllRoutes}
                  onHideAllRoutes={handleHideAllRoutes}
                  onHighlightRoute={handleHighlightRoute}
                  onZoomToRoute={handleZoomToRoute}
                  onToggleFavoriteLine={handleToggleFavoriteLine}
                  onOpenFeedbackForLine={(label) => handleOpenFeedback('line', label)}
                />
              )}

              {activeTab === 'near' && (
                <NearTab
                  pointP={pointP}
                  nearResults={nearResults}
                  searchRadiusMeters={searchRadiusMeters}
                  isLoading={isLoading}
                  onSetSearchRadius={setSearchRadiusMeters}
                  onUseCurrentLocation={handleLocateUser}
                  onClearPointP={() => setPointP(null)}
                  onHighlightRoute={handleHighlightRoute}
                  onSetPointAs={handleSetPointAs}
                />
              )}

              {activeTab === 'route' && (
                <RoutePlanTab
                  pointA={pointA}
                  pointB={pointB}
                  pointAAddress={pointAAddress}
                  pointBAddress={pointBAddress}
                  routeTarget={routeTarget}
                  trips={trips}
                  activeTrip={activeTrip}
                  isLoading={isLoading}
                  favoriteTrips={favoriteTrips}
                  isCurrentTripFavorited={Boolean(matchingTripFavorite)}
                  onSetRouteTarget={setRouteTarget}
                  onSwapPoints={handleSwapPoints}
                  onUseCurrentLocationForA={handleLocateUser}
                  onClearPoint={(t) => (t === 'A' ? setPointA(null) : setPointB(null))}
                  onSelectTrip={handleSelectTrip}
                  onSetGeofenceAlarm={handleOpenGeofenceForTarget}
                  isGeofenceActive={alarmConfig.isActive}
                  onOpenNavigationAnimation={handleOpenNavigationAnimation}
                  onToggleFavoriteTrip={handleToggleFavoriteTrip}
                  onApplyFavoriteTrip={handleApplyFavoriteTrip}
                  onDeleteFavoriteTrip={handleDeleteFavorite}
                  onOpenFeedbackForTrip={() =>
                    handleOpenFeedback(
                      'trip',
                      `${pointAAddress || 'Punto A'} -> ${pointBAddress || 'Punto B'}`
                    )
                  }
                />
              )}

              {activeTab === 'places' && (
                <PlacesTab
                  pois={pois}
                  selectedPOI={selectedPOI}
                  user={user}
                  dbConfigured={dbConfigured}
                  onSelectPOI={setSelectedPOI}
                  onSetPointAs={handleSetPointAs}
                  onFlyToPOI={(poi) => setSelectedPOI(poi)}
                  onSetGeofenceAlarm={handleOpenGeofenceForTarget}
                  onOpenAddPlace={() => setIsAddPlaceModalOpen(true)}
                  onDeletePlace={handleDeletePlace}
                  onOpenFeedbackForPlace={(name) => handleOpenFeedback('place', name)}
                />
              )}

              {activeTab === 'dataset' && (
                <DatasetTab
                  stats={stats}
                  isLoading={isLoading}
                  onLoadCustomFile={handleLoadCustomFile}
                  onResetDefaultDataset={loadDefaultDataset}
                  customDataset={customDataset}
                  onToggleCustomDatasetVisibility={handleToggleCustomDatasetVisibility}
                  onChangeCustomDatasetColor={handleChangeCustomDatasetColor}
                  onClearCustomDataset={handleClearCustomDataset}
                />
              )}
            </div>
          )}
        </div>
    </>
  );
}

function AppOverlays({
  controller,
  mapStyle,
  onMapStyleChange,
}: AppShellProps & MapStyleProps) {
  const { isLoading, isGeofenceModalOpen, setIsGeofenceModalOpen, alarmConfig, pointB, pointBAddress, pointP, handleActivateGeofence, handleDeactivateGeofence, handleSimulateApproach, isSimulatingApproach, isSoundMuted, handleStopAlarm, handleMuteSound, toastMessage, isHelpOpen, setIsHelpOpen, isAnimationModalOpen, setIsAnimationModalOpen, selectedAnimationTrip, activeTrip, isPickingPlaceCoords, setIsPickingPlaceCoords, isPickingComplaintCoords, isTransportComplaintModalOpen, setIsTransportComplaintModalOpen, transportComplaintCoords, transportComplaintLocationAccuracy, transportComplaintResetToken, handleStartPickComplaintCoords, handleCancelPickComplaintCoords, handleSetTransportComplaintLocation, setIsAddPlaceModalOpen, isAuthModalOpen, setIsAuthModalOpen, user, setUser, dbConfigured, refreshCommunityData, showToast, handleSignOut, setIsModerationOpen, isAddPlaceModalOpen, allCategories, pickedPlaceCoords, isFeedbackModalOpen, setIsFeedbackModalOpen, feedbackDefaultTarget, isModerationOpen, handleOpenFeedback, handleOpenNavigationAnimation, handleOpenGeofenceForTarget, handleLocateUser, handleClearMap, mobileDrawerHeight, routes } = controller;
  const complaintLineOptions = Array.from(
    new Map(
      routes.map((route) => [
        route.label.trim(),
        { id: route.id, label: route.label.trim() },
      ])
    ).values()
  ).sort((first, second) => first.label.localeCompare(second.label, 'es'));
  return (
    <>
        {/* Floating Action Buttons */}
        <FloatingActions
          onLocateUser={handleLocateUser}
          onClearMap={handleClearMap}
          onOpenHelp={() => setIsHelpOpen(true)}
          mapStyle={mapStyle}
          onMapStyleChange={onMapStyleChange}
          mobileDrawerHeight={mobileDrawerHeight}
          onOpenGeofenceModal={() => setIsGeofenceModalOpen(true)}
          isGeofenceActive={alarmConfig.isActive}
        />

        {/* Active Geofence Floating Banner */}
        <GeofenceActiveBanner
          alarmConfig={alarmConfig}
          onOpenModal={() => setIsGeofenceModalOpen(true)}
          onCancelAlarm={handleDeactivateGeofence}
        />

        {/* Geofence Configuration & Status Modal */}
        <GeofenceModal
          isOpen={isGeofenceModalOpen}
          onClose={() => setIsGeofenceModalOpen(false)}
          alarmConfig={alarmConfig}
          pointB={pointB}
          pointBAddress={pointBAddress}
          pointP={pointP}
          onActivateAlarm={handleActivateGeofence}
          onDeactivateAlarm={handleDeactivateGeofence}
          onSimulateApproach={handleSimulateApproach}
          isSimulating={isSimulatingApproach}
        />

        {/* High Urgency Arrival Alarm Trigger Modal */}
        <GeofenceTriggerModal
          isOpen={alarmConfig.isTriggered}
          targetName={alarmConfig.targetName}
          targetCoords={alarmConfig.targetCoords}
          currentDistanceMeters={alarmConfig.currentDistanceMeters}
          thresholdMeters={alarmConfig.thresholdMeters}
          onStopAlarm={handleStopAlarm}
          onMuteSound={handleMuteSound}
          isSoundMuted={isSoundMuted}
        />

        {/* Floating Toast Notification */}
        {toastMessage && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-slate-900/95 text-slate-100 text-xs font-medium rounded-full shadow-2xl border border-slate-700/80 animate-fade-in flex items-center gap-2 max-w-[90vw] truncate">
            <span className="w-2 h-2 rounded-full bg-emerald-400 flex-none animate-ping" />
            <span className="truncate">{toastMessage}</span>
          </div>
        )}

        {/* Info & Help Guide Modal */}
        <InfoModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

        {/* 3D Navigation Map Animation Studio Modal */}
        <NavigationAnimationModal
          isOpen={isAnimationModalOpen}
          onClose={() => setIsAnimationModalOpen(false)}
          trip={selectedAnimationTrip || activeTrip}
        />

        {/* Map coordinate picking banner when adding a new place */}
        {isPickingPlaceCoords && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-emerald-950/95 text-emerald-100 text-xs font-semibold rounded-xl shadow-2xl border border-emerald-500/70 flex items-center gap-3">
            <span>Toca el mapa para fijar las coordenadas del nuevo lugar</span>
            <button
              type="button"
              onClick={() => {
                setIsPickingPlaceCoords(false);
                setIsAddPlaceModalOpen(true);
              }}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
            >
              Volver
            </button>
          </div>
        )}

        {isPickingComplaintCoords && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-40 px-4 py-2 bg-amber-950/95 text-amber-100 text-xs font-semibold rounded-xl shadow-2xl border border-amber-500/70 flex items-center gap-3">
            <span>Toca el mapa para señalar dónde ocurrió el incidente</span>
            <button
              type="button"
              onClick={handleCancelPickComplaintCoords}
              className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px]"
            >
              Volver
            </button>
          </div>
        )}

        {/* Google Auth Modal */}
        <AuthModal
          isOpen={isAuthModalOpen}
          onClose={() => setIsAuthModalOpen(false)}
          user={user}
          dbConfigured={dbConfigured}
          onAuthSuccess={(signedInUser) => {
            setUser(signedInUser);
            refreshCommunityData();
            showToast(`Bienvenido, ${signedInUser.displayName}`);
          }}
          onSignOut={handleSignOut}
          onOpenModeration={() => setIsModerationOpen(true)}
        />

        {/* Add Community/Private Place Modal */}
        <AddPlaceModal
          isOpen={isAddPlaceModalOpen}
          onClose={() => setIsAddPlaceModalOpen(false)}
          user={user}
          categories={allCategories}
          pickedCoords={pickedPlaceCoords}
          onStartPickFromMap={() => {
            setIsAddPlaceModalOpen(false);
            setIsPickingPlaceCoords(true);
          }}
          onOpenAuth={() => {
            setIsAddPlaceModalOpen(false);
            setIsAuthModalOpen(true);
          }}
          onCreated={refreshCommunityData}
          onToast={showToast}
        />

        {/* Community Feedback Modal */}
        <FeedbackModal
          isOpen={isFeedbackModalOpen}
          onClose={() => setIsFeedbackModalOpen(false)}
          defaultTargetType={feedbackDefaultTarget.type}
          defaultTargetRef={feedbackDefaultTarget.ref}
          onToast={showToast}
        />

        <TransportComplaintModal
          isOpen={isTransportComplaintModalOpen}
          resetToken={transportComplaintResetToken}
          lineOptions={complaintLineOptions}
          location={transportComplaintCoords}
          locationAccuracyMeters={transportComplaintLocationAccuracy}
          onLocationChange={handleSetTransportComplaintLocation}
          onStartPickLocation={handleStartPickComplaintCoords}
          onClose={() => setIsTransportComplaintModalOpen(false)}
        />

        {/* Admin Moderation Modal */}
        {user?.role === 'admin' && (
          <ModerationModal
            isOpen={isModerationOpen}
            onClose={() => setIsModerationOpen(false)}
            onChanged={refreshCommunityData}
            onToast={showToast}
          />
        )}
    </>
  );
}

export function AppShell({ controller }: AppShellProps) {
  const [mapStyle, setMapStyle] = useState<MapStyleKey>('liberty');

  return (
    <div className="app-viewport relative w-screen min-h-0 overflow-hidden flex flex-col bg-slate-950 text-slate-100 font-sans">
      <AppHeader controller={controller} tabsConfig={tabsConfig} />
      <div className="relative min-h-0 flex-1 w-full overflow-hidden">
        <AppMap
          controller={controller}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
        />
        <AppDesktopSidebar controller={controller} tabsConfig={tabsConfig} />
        <AppSidebarRestore controller={controller} />
        <AppMobileDrawer controller={controller} tabsConfig={tabsConfig} />
        <AppOverlays
          controller={controller}
          mapStyle={mapStyle}
          onMapStyleChange={setMapStyle}
        />
      </div>
    </div>
  );
}
