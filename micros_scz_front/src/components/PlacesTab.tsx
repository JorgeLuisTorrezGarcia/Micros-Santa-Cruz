import React, { useMemo, useState, useRef } from 'react';
import { CommunityPOIItem, Coordinates, UserProfile } from '../types.ts';
import {
  Search,
  MapPin,
  Building,
  GraduationCap,
  ShoppingBag,
  Hospital,
  Store,
  Bus,
  X,
  ChevronLeft,
  ChevronRight,
  BellRing,
  Plus,
  Trash2,
  MessageSquarePlus,
} from 'lucide-react';

interface PlacesTabProps {
  pois: CommunityPOIItem[];
  selectedPOI: CommunityPOIItem | null;
  user: UserProfile | null;
  dbConfigured: boolean;
  onSelectPOI: (poi: CommunityPOIItem) => void;
  onSetPointAs: (type: 'A' | 'B', coords: Coordinates, name: string) => void;
  onFlyToPOI: (poi: CommunityPOIItem) => void;
  onSetGeofenceAlarm?: (coords: Coordinates, name: string) => void;
  onOpenAddPlace: () => void;
  onDeletePlace?: (id: string) => void;
  onOpenFeedbackForPlace?: (name: string) => void;
}

type PlaceScopeFilter = 'all' | 'base' | 'mine' | 'pending';

interface PlaceCardProps {
  poi: CommunityPOIItem;
  selected: boolean;
  owner: boolean;
  getCategoryIcon: (category: string) => React.ReactNode;
  getVisibilityLabel: (poi: CommunityPOIItem) => string;
  onSelect: PlacesTabProps['onSelectPOI'];
  onFlyTo: PlacesTabProps['onFlyToPOI'];
  onSetPointAs: PlacesTabProps['onSetPointAs'];
  onSetGeofenceAlarm?: PlacesTabProps['onSetGeofenceAlarm'];
  onDeletePlace?: PlacesTabProps['onDeletePlace'];
  onOpenFeedbackForPlace?: PlacesTabProps['onOpenFeedbackForPlace'];
}

function PlaceCard({
  poi,
  selected,
  owner,
  getCategoryIcon,
  getVisibilityLabel,
  onSelect,
  onFlyTo,
  onSetPointAs,
  onSetGeofenceAlarm,
  onDeletePlace,
  onOpenFeedbackForPlace,
}: PlaceCardProps) {
  return (
    <div
      onClick={() => {
        onSelect(poi);
        onFlyTo(poi);
      }}
      className={`p-2.5 rounded-xl border transition cursor-pointer select-none space-y-2 ${
        selected
          ? 'bg-slate-800 border-emerald-500/80'
          : 'bg-slate-800/40 hover:bg-slate-800/70 border-slate-700/70'
      }`}
    >
      <div className="min-w-0">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            {getCategoryIcon(poi.category)}
            <span className="font-semibold text-sm text-slate-100 truncate">
              {poi.name}
            </span>
          </div>
          {owner && onDeletePlace && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onDeletePlace(String(poi.id));
              }}
              className="p-1 rounded text-slate-500 hover:text-rose-400 hover:bg-slate-900/60 transition shrink-0"
              title="Eliminar mi lugar"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-0.5 truncate">
          {poi.category} · {getVisibilityLabel(poi)}
        </p>
        {poi.dir && <p className="text-[11px] text-slate-400 truncate mt-0.5">{poi.dir}</p>}
        {poi.desc && (
          <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5">{poi.desc}</p>
        )}
      </div>
      <div className="flex items-center justify-between pt-1.5 border-t border-slate-700/50 text-xs flex-wrap gap-1.5">
        <div className="flex items-center gap-2">
          <button
            onClick={(event) => {
              event.stopPropagation();
              onFlyTo(poi);
            }}
            className="flex items-center gap-1 text-[11px] text-indigo-300 hover:text-white"
          >
            <MapPin className="w-3 h-3" />
            <span>Ver</span>
          </button>
          {onOpenFeedbackForPlace && (
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation();
                onOpenFeedbackForPlace(poi.name);
              }}
              className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-slate-200"
              title="Reportar error en este lugar"
            >
              <MessageSquarePlus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {onSetGeofenceAlarm && (
            <button
              onClick={(event) => {
                event.stopPropagation();
                onSetGeofenceAlarm([poi.lon, poi.lat], poi.name);
              }}
              className="px-2 py-0.5 rounded bg-amber-950 hover:bg-amber-900 border border-amber-800 text-amber-300 text-[11px] font-medium transition flex items-center gap-1"
              title="Activar alarma de bajada para este lugar"
            >
              <BellRing className="w-3 h-3 text-amber-400" />
              <span>Avisar</span>
            </button>
          )}
          <button
            onClick={(event) => {
              event.stopPropagation();
              onSetPointAs('A', [poi.lon, poi.lat], poi.name);
            }}
            className="px-2 py-0.5 rounded bg-emerald-950 hover:bg-emerald-900 border border-emerald-800 text-emerald-300 text-[11px] font-medium transition"
          >
            Como A
          </button>
          <button
            onClick={(event) => {
              event.stopPropagation();
              onSetPointAs('B', [poi.lon, poi.lat], poi.name);
            }}
            className="px-2 py-0.5 rounded bg-rose-950 hover:bg-rose-900 border border-rose-800 text-rose-300 text-[11px] font-medium transition"
          >
            Como B
          </button>
        </div>
      </div>
    </div>
  );
}

export const PlacesTab: React.FC<PlacesTabProps> = ({
  pois,
  selectedPOI,
  user,
  dbConfigured,
  onSelectPOI,
  onSetPointAs,
  onFlyToPOI,
  onSetGeofenceAlarm,
  onOpenAddPlace,
  onDeletePlace,
  onOpenFeedbackForPlace,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('Todos');
  const [scopeFilter, setScopeFilter] = useState<PlaceScopeFilter>('all');
  const categoriesScrollRef = useRef<HTMLDivElement>(null);

  const isDraggingRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  const scopeFilteredPOIs = useMemo(() => {
    return pois.filter((poi) => {
      if (scopeFilter === 'base') return poi.source !== 'community';
      if (scopeFilter === 'mine') {
        return Boolean(user && poi.ownerUserId === user.id);
      }
      if (scopeFilter === 'pending') {
        return poi.visibility === 'public_pending';
      }
      return true;
    });
  }, [pois, scopeFilter, user]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    scopeFilteredPOIs.forEach((p) => {
      if (p.category) set.add(p.category);
    });
    return ['Todos', ...Array.from(set)];
  }, [scopeFilteredPOIs]);

  const filteredPOIs = useMemo(() => {
    return scopeFilteredPOIs.filter((poi) => {
      const matchesCat =
        selectedCategory === 'Todos' || poi.category === selectedCategory;
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !q ||
        poi.name.toLowerCase().includes(q) ||
        (poi.dir && poi.dir.toLowerCase().includes(q)) ||
        (poi.desc && poi.desc.toLowerCase().includes(q));
      return matchesCat && matchesSearch;
    });
  }, [scopeFilteredPOIs, selectedCategory, searchQuery]);

  const getCategoryIcon = (category: string) => {
    if (category.includes('Universidad'))
      return <GraduationCap className="w-3.5 h-3.5 text-blue-400 shrink-0" />;
    if (category.includes('Comercial'))
      return <ShoppingBag className="w-3.5 h-3.5 text-pink-400 shrink-0" />;
    if (category.includes('Salud') || category.includes('Hospital'))
      return <Hospital className="w-3.5 h-3.5 text-rose-400 shrink-0" />;
    if (category.includes('Mercado'))
      return <Store className="w-3.5 h-3.5 text-amber-400 shrink-0" />;
    if (category.includes('Transporte'))
      return <Bus className="w-3.5 h-3.5 text-emerald-400 shrink-0" />;
    return <Building className="w-3.5 h-3.5 text-indigo-400 shrink-0" />;
  };

  const getVisibilityLabel = (poi: CommunityPOIItem): string => {
    if (poi.source !== 'community') return 'Base offline';
    if (poi.visibility === 'private') return 'Privado';
    if (poi.visibility === 'public_pending') return 'En revisión';
    if (poi.visibility === 'rejected') return 'Rechazado';
    return 'Comunitario';
  };

  const scrollCategories = (direction: 'left' | 'right') => {
    if (categoriesScrollRef.current) {
      const offset = direction === 'left' ? -180 : 180;
      categoriesScrollRef.current.scrollBy({ left: offset, behavior: 'smooth' });
    }
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!categoriesScrollRef.current) return;
    isDraggingRef.current = true;
    startXRef.current = e.pageX - categoriesScrollRef.current.offsetLeft;
    scrollLeftRef.current = categoriesScrollRef.current.scrollLeft;
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current || !categoriesScrollRef.current) return;
    e.preventDefault();
    const x = e.pageX - categoriesScrollRef.current.offsetLeft;
    const walk = (x - startXRef.current) * 1.5;
    categoriesScrollRef.current.scrollLeft = scrollLeftRef.current - walk;
  };

  const handleMouseUpOrLeave = () => {
    isDraggingRef.current = false;
  };

  return (
    <div className="flex flex-col h-full space-y-2.5">
      {/* Header action + Search Input */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar lugar (ej. UAGRM, Ventura)..."
            className="w-full bg-slate-800/80 border border-slate-700/80 rounded-xl pl-9 pr-8 py-2 text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-2.5 p-0.5 text-slate-400 hover:text-white transition"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenAddPlace}
          data-testid="add-place-button"
          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 shrink-0 transition min-h-[38px]"
          title={
            dbConfigured
              ? 'Agregar lugar privado o propuesta pública'
              : 'Agregar lugar (requiere PostgreSQL configurado)'
          }
        >
          <Plus className="w-3.5 h-3.5" />
          <span>Nuevo</span>
        </button>
      </div>

      {/* Scope segmented bar */}
      <div className="grid grid-cols-4 gap-1 bg-slate-900/70 p-1 rounded-xl border border-slate-800 text-[11px]">
        {(
          [
            { id: 'all', label: 'Todos' },
            { id: 'base', label: 'Base' },
            { id: 'mine', label: 'Míos' },
            { id: 'pending', label: 'Revisión' },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setScopeFilter(tab.id);
              setSelectedCategory('Todos');
            }}
            className={`py-1 rounded-lg font-medium transition ${
              scopeFilter === tab.id
                ? 'bg-slate-800 text-emerald-300 border border-slate-700'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Category Carousel */}
      <div className="relative flex items-center gap-1 bg-slate-900/60 p-1 rounded-xl border border-slate-800">
        <button
          type="button"
          onClick={() => scrollCategories('left')}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition shrink-0"
          aria-label="Desplazar categorías hacia la izquierda"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>

        <div
          ref={categoriesScrollRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpOrLeave}
          onMouseLeave={handleMouseUpOrLeave}
          className="flex items-center gap-1.5 overflow-x-auto py-0.5 scroll-smooth no-scrollbar touch-pan-x flex-1 min-w-0 select-none cursor-grab active:cursor-grabbing"
        >
          {categories.map((cat) => {
            const count =
              cat === 'Todos'
                ? scopeFilteredPOIs.length
                : scopeFilteredPOIs.filter((p) => p.category === cat).length;
            const isSelected = selectedCategory === cat;

            return (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded-lg whitespace-nowrap shrink-0 transition border text-xs font-medium flex items-center gap-1.5 ${
                  isSelected
                    ? 'bg-emerald-600 text-white border-emerald-500'
                    : 'bg-slate-800/80 hover:bg-slate-800 text-slate-300 border-slate-700'
                }`}
              >
                {cat !== 'Todos' && getCategoryIcon(cat)}
                <span>{cat}</span>
                <span className="text-[10px] opacity-75 tabular-nums">
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => scrollCategories('right')}
          className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 transition shrink-0"
          aria-label="Desplazar categorías hacia la derecha"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* POI List */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 -mr-1">
        {filteredPOIs.length === 0 ? (
          <div className="text-center py-10 px-4 text-slate-400">
            <Building className="w-10 h-10 mx-auto text-slate-600 mb-2 stroke-1" />
            <p className="font-medium text-slate-300">
              No se encontraron lugares
            </p>
            <p className="text-xs mt-1">
              {scopeFilter === 'mine' && !user
                ? 'Inicia sesión con Google para ver o crear tus lugares personales.'
                : 'Prueba con otro filtro o agrega un nuevo lugar.'}
            </p>
          </div>
        ) : (
          filteredPOIs.map((poi) => (
            <PlaceCard
              key={poi.id}
              poi={poi}
              selected={selectedPOI?.id === poi.id}
              owner={Boolean(
                user && poi.source === 'community' && poi.ownerUserId === user.id
              )}
              getCategoryIcon={getCategoryIcon}
              getVisibilityLabel={getVisibilityLabel}
              onSelect={onSelectPOI}
              onFlyTo={onFlyToPOI}
              onSetPointAs={onSetPointAs}
              onSetGeofenceAlarm={onSetGeofenceAlarm}
              onDeletePlace={onDeletePlace}
              onOpenFeedbackForPlace={onOpenFeedbackForPlace}
            />
          ))
        )}
      </div>
    </div>
  );
};
