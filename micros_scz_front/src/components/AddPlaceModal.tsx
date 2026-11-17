import React, { useEffect, useState } from 'react';
import {
  Coordinates,
  PlaceCategoryItem,
  UserProfile,
} from '../types.ts';
import { createCommunityPlace } from '../services/communityService.ts';
import { getUserFriendlyError } from '../services/apiClient.ts';
import { Crosshair, Lock, Globe, MapPin, Navigation, X } from 'lucide-react';

interface AddPlaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfile | null;
  categories: PlaceCategoryItem[];
  pickedCoords: Coordinates | null;
  onStartPickFromMap: () => void;
  onOpenAuth: () => void;
  onCreated: () => void;
  onToast: (msg: string) => void;
}

interface PlaceLocationFieldsProps {
  latStr: string;
  lonStr: string;
  addressDir: string;
  onLatitudeChange: (value: string) => void;
  onLongitudeChange: (value: string) => void;
  onAddressChange: (value: string) => void;
  onStartPickFromMap: () => void;
  onUseGps: () => void;
}

function PlaceLocationFields({
  latStr,
  lonStr,
  addressDir,
  onLatitudeChange,
  onLongitudeChange,
  onAddressChange,
  onStartPickFromMap,
  onUseGps,
}: PlaceLocationFieldsProps) {
  return (
    <>
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-[11px] font-medium text-slate-400">
            Ubicación en Santa Cruz
          </label>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onStartPickFromMap}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-emerald-300 flex items-center gap-1 transition"
            >
              <Crosshair className="w-3 h-3" />
              <span>Tocar mapa</span>
            </button>
            <button
              type="button"
              onClick={onUseGps}
              className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] text-sky-300 flex items-center gap-1 transition"
            >
              <Navigation className="w-3 h-3" />
              <span>GPS</span>
            </button>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="text"
            value={latStr}
            onChange={(e) => onLatitudeChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
            aria-label="Latitud"
          />
          <input
            type="text"
            value={lonStr}
            onChange={(e) => onLongitudeChange(e.target.value)}
            className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono tabular-nums text-slate-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
            aria-label="Longitud"
          />
        </div>
      </div>
      <div>
        <label className="block text-[11px] font-medium text-slate-400 mb-1">
          Dirección o referencia (opcional)
        </label>
        <input
          type="text"
          value={addressDir}
          onChange={(e) => onAddressChange(e.target.value)}
          placeholder="Ej. Av. Cristo Redentor entre 3er y 4to anillo"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
        />
      </div>
    </>
  );
}

function PlaceVisibilityOptions({
  visibility,
  onChange,
}: {
  visibility: 'private' | 'public_pending';
  onChange: (value: 'private' | 'public_pending') => void;
}) {
  return (
    <div>
      <label className="block text-[11px] font-medium text-slate-400 mb-1">
        Visibilidad
      </label>
      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => onChange('private')}
          className={`p-2.5 rounded-xl border text-left transition ${
            visibility === 'private'
              ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200'
              : 'bg-slate-800/60 border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Lock className="w-3.5 h-3.5 text-emerald-400" />
            <span>Privado</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Visible solo para tu cuenta
          </p>
        </button>
        <button
          type="button"
          onClick={() => onChange('public_pending')}
          className={`p-2.5 rounded-xl border text-left transition ${
            visibility === 'public_pending'
              ? 'bg-emerald-950/50 border-emerald-500 text-emerald-200'
              : 'bg-slate-800/60 border-slate-700 text-slate-300'
          }`}
        >
          <div className="flex items-center gap-1.5 text-xs font-semibold">
            <Globe className="w-3.5 h-3.5 text-sky-400" />
            <span>Proponer público</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            Pasa a revisión de moderador
          </p>
        </button>
      </div>
    </div>
  );
}

export const AddPlaceModal: React.FC<AddPlaceModalProps> = ({
  isOpen,
  onClose,
  user,
  categories,
  pickedCoords,
  onStartPickFromMap,
  onOpenAuth,
  onCreated,
  onToast,
}) => {
  const [name, setName] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [customCategoryName, setCustomCategoryName] = useState('');
  const [latStr, setLatStr] = useState('-17.78330');
  const [lonStr, setLonStr] = useState('-63.18210');
  const [addressDir, setAddressDir] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState<'private' | 'public_pending'>(
    'private'
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (pickedCoords) {
      setLonStr(pickedCoords[0].toFixed(6));
      setLatStr(pickedCoords[1].toFixed(6));
    }
  }, [pickedCoords]);

  useEffect(() => {
    if (isOpen && !selectedCategory && categories.length > 0) {
      setSelectedCategory(categories[0].name);
    }
  }, [isOpen, categories, selectedCategory]);

  if (!isOpen) return null;

  const handleUseGps = () => {
    if (!navigator.geolocation) {
      setErrorMsg('Este dispositivo no permite compartir tu ubicación. Puedes fijar el punto en el mapa.');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLatStr(pos.coords.latitude.toFixed(6));
        setLonStr(pos.coords.longitude.toFixed(6));
        setErrorMsg(null);
      },
      () => {
        setErrorMsg('No pudimos obtener tu ubicación. Revisa los permisos o fija el punto en el mapa.');
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      onOpenAuth();
      return;
    }

    const lat = Number(latStr);
    const lon = Number(lonStr);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
      setErrorMsg('Ingresa una ubicación válida.');
      return;
    }

    const isCustomCat = selectedCategory === '__new__';
    const chosenCategoryName = isCustomCat
      ? customCategoryName.trim()
      : selectedCategory;

    if (!chosenCategoryName) {
      setErrorMsg('Elige o escribe una categoría.');
      return;
    }

    const matchedDbCategory = !isCustomCat
      ? categories.find(
          (c) => c.name === chosenCategoryName && c.source === 'community'
        )
      : undefined;

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await createCommunityPlace({
        name: name.trim(),
        categoryId: matchedDbCategory ? matchedDbCategory.id : undefined,
        categoryName: matchedDbCategory ? undefined : chosenCategoryName,
        lat,
        lon,
        addressDir: addressDir.trim() || null,
        description: description.trim() || null,
        visibility,
      });

      onToast(
        visibility === 'private'
          ? `Lugar privado "${name.trim()}" guardado`
          : `Propuesta "${name.trim()}" enviada a moderación`
      );
      setName('');
      setAddressDir('');
      setDescription('');
      setCustomCategoryName('');
      onCreated();
      onClose();
    } catch (err: unknown) {
      console.error('Error al guardar el lugar:', err);
      setErrorMsg(
        getUserFriendlyError(
          err,
          'No pudimos guardar el lugar. Inténtalo nuevamente.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-100">
              Agregar Nuevo Lugar
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Cerrar formulario"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3 overflow-y-auto">
          {!user && (
            <div className="p-3 rounded-xl bg-amber-950/40 border border-amber-700/50 flex items-center justify-between gap-2">
              <p className="text-xs text-amber-200">
                Inicia sesión con Google para guardar lugares en tu cuenta.
              </p>
              <button
                type="button"
                onClick={onOpenAuth}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shrink-0"
              >
                Ingresar
              </button>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Nombre del lugar *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mi Trabajo, Parada 3er Anillo, Clínica..."
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
            />
          </div>

          <div>
            <label className="block text-[11px] font-medium text-slate-400 mb-1">
              Categoría *
            </label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
            >
              {categories.map((c) => (
                <option key={c.slug} value={c.name}>
                  {c.name}
                  {c.status === 'pending' ? ' (En revisión)' : ''}
                </option>
              ))}
              <option value="__new__">+ Proponer nueva categoría...</option>
            </select>
          </div>

          {selectedCategory === '__new__' && (
            <div>
              <label className="block text-[11px] font-medium text-emerald-300 mb-1">
                Nombre de la nueva categoría
              </label>
              <input
                type="text"
                required
                value={customCategoryName}
                onChange={(e) => setCustomCategoryName(e.target.value)}
                placeholder="Ej. Coworkings, Farmacias 24h..."
                className="w-full bg-slate-800 border border-emerald-600/60 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
              />
            </div>
          )}

          <PlaceLocationFields
            latStr={latStr}
            lonStr={lonStr}
            addressDir={addressDir}
            onLatitudeChange={setLatStr}
            onLongitudeChange={setLonStr}
            onAddressChange={setAddressDir}
            onStartPickFromMap={onStartPickFromMap}
            onUseGps={handleUseGps}
          />

          <PlaceVisibilityOptions
            visibility={visibility}
            onChange={setVisibility}
          />

          {errorMsg && (
            <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-2">
              {errorMsg}
            </p>
          )}

          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition min-h-[40px]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-semibold text-white transition min-h-[40px]"
            >
              {isSubmitting
                ? 'Guardando...'
                : visibility === 'private'
                ? 'Guardar lugar privado'
                : 'Enviar propuesta'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
