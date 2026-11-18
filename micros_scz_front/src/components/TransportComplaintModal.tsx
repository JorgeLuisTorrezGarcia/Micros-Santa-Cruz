import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  LocateFixed,
  MapPin,
  TriangleAlert,
  X,
} from 'lucide-react';
import type {
  Coordinates,
  CreateTransportComplaintPayload,
  TransportComplaintCategory,
  TransportComplaintDirection,
} from '../types.ts';
import { getUserFriendlyError } from '../services/apiClient.ts';
import { submitTransportComplaint } from '../services/communityService.ts';

interface TransportComplaintModalProps {
  isOpen: boolean;
  resetToken: number;
  lineOptions: Array<{ id: string; label: string }>;
  location: Coordinates | null;
  locationAccuracyMeters: number | null;
  onLocationChange: (
    coordinates: Coordinates | null,
    accuracyMeters?: number | null
  ) => void;
  onStartPickLocation: () => void;
  onClose: () => void;
}

const CATEGORY_OPTIONS: Array<{
  value: TransportComplaintCategory;
  label: string;
}> = [
  { value: 'trato_irrespetuoso', label: 'Trato irrespetuoso o discriminatorio' },
  { value: 'negativa_servicio', label: 'No quiso recoger a un pasajero' },
  { value: 'riesgo_peatonal', label: 'Riesgo para peatones o paso peatonal' },
  { value: 'conduccion_peligrosa', label: 'Exceso de velocidad o conducción peligrosa' },
  { value: 'cobro_excesivo', label: 'Cobro de pasaje excesivo' },
  { value: 'posible_ebriedad', label: 'Posible conducción bajo efectos del alcohol' },
  { value: 'otro', label: 'Otro incidente' },
];

function getLocalDateTimeValue(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16);
}

export function TransportComplaintModal({
  isOpen,
  resetToken,
  lineOptions,
  location,
  locationAccuracyMeters,
  onLocationChange,
  onStartPickLocation,
  onClose,
}: TransportComplaintModalProps) {
  const [lineLabel, setLineLabel] = useState('');
  const [internalNumber, setInternalNumber] = useState('');
  const [category, setCategory] =
    useState<TransportComplaintCategory>('trato_irrespetuoso');
  const [direction, setDirection] =
    useState<TransportComplaintDirection>('no_sabe');
  const [occurredAtLocal, setOccurredAtLocal] = useState(getLocalDateTimeValue);
  const [stopReference, setStopReference] = useState('');
  const [fareAmount, setFareAmount] = useState('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const locationRequestId = useRef(0);

  useEffect(() => {
    locationRequestId.current += 1;
    setLineLabel('');
    setInternalNumber('');
    setCategory('trato_irrespetuoso');
    setDirection('no_sabe');
    setOccurredAtLocal(getLocalDateTimeValue());
    setStopReference('');
    setFareAmount('');
    setDescription('');
    setIsLocating(false);
    setErrorMessage(null);
    setSubmitted(false);
    onLocationChange(null, null);
  }, [resetToken, onLocationChange]);

  if (!isOpen) return null;

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      setErrorMessage(
        'Tu navegador no ofrece ubicación. Puedes marcar el punto en el mapa o continuar sin coordenadas.'
      );
      return;
    }

    const requestId = locationRequestId.current + 1;
    locationRequestId.current = requestId;
    setIsLocating(true);
    setErrorMessage(null);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        if (requestId !== locationRequestId.current) return;
        onLocationChange([coords.longitude, coords.latitude], coords.accuracy);
        setIsLocating(false);
      },
      (error: GeolocationPositionError) => {
        if (requestId !== locationRequestId.current) return;
        setErrorMessage(
          error.code === error.PERMISSION_DENIED
            ? 'No se concedió el permiso de ubicación. Puedes marcar el punto en el mapa o continuar sin coordenadas.'
            : 'No pudimos obtener tu ubicación. Puedes marcar el punto en el mapa o continuar sin coordenadas.'
        );
        setIsLocating(false);
      },
      { enableHighAccuracy: true, maximumAge: 60_000, timeout: 10_000 }
    );
  };

  const handleStartPickLocation = () => {
    locationRequestId.current += 1;
    setIsLocating(false);
    onStartPickLocation();
  };

  const handleClose = () => {
    locationRequestId.current += 1;
    setIsLocating(false);
    onClose();
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const parsedIncidentDate = new Date(occurredAtLocal);
    if (Number.isNaN(parsedIncidentDate.getTime())) {
      setErrorMessage('Revisa la fecha y hora del incidente.');
      return;
    }

    const selectedLine = lineOptions.find(
      (line) => line.label.toLocaleLowerCase() === lineLabel.trim().toLocaleLowerCase()
    );
    const numericFare = fareAmount.trim() ? Number(fareAmount) : null;
    if (
      numericFare !== null &&
      (!Number.isFinite(numericFare) || numericFare <= 0 || numericFare > 1000)
    ) {
      setErrorMessage('Ingresa un monto válido o deja el campo vacío.');
      return;
    }

    const payload: CreateTransportComplaintPayload = {
      lineLabel: lineLabel.trim(),
      lineId: selectedLine?.id ?? null,
      internalNumber: internalNumber.trim() || null,
      category,
      direction,
      occurredAt: parsedIncidentDate.toISOString(),
      occurredTimezone:
        Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/La_Paz',
      latitude: location?.[1] ?? null,
      longitude: location?.[0] ?? null,
      locationAccuracyMeters:
        location &&
        locationAccuracyMeters !== null &&
        locationAccuracyMeters <= 10000
          ? Math.max(1, Math.round(locationAccuracyMeters))
          : null,
      stopReference: stopReference.trim() || null,
      fareAmount: category === 'cobro_excesivo' ? numericFare : null,
      description: description.trim(),
    };

    setIsSubmitting(true);
    try {
      await submitTransportComplaint(payload);
      setSubmitted(true);
    } catch (error: unknown) {
      console.error('No se pudo enviar la denuncia de transporte:', error);
      setErrorMessage(
        getUserFriendlyError(
          error,
          'No pudimos enviar tu reporte. Inténtalo nuevamente.'
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-3 sm:p-4"
      onClick={handleClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="transport-complaint-title"
        className="w-full max-w-xl max-h-[80vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <TriangleAlert className="w-4 h-4 text-amber-400" />
            <h2
              id="transport-complaint-title"
              className="text-sm font-bold text-slate-100"
            >
              Denunciar un incidente
            </h2>
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Cerrar formulario de denuncia"
          >
            <X className="w-4 h-4" />
          </button>
        </header>

        {submitted ? (
          <div className="p-8 text-center space-y-3">
            <CheckCircle2 className="w-11 h-11 text-emerald-400 mx-auto" />
            <p className="text-sm font-semibold text-slate-100">
              Recibimos tu reporte
            </p>
            <p className="text-xs text-slate-400">
              Se guardó de forma privada para revisión. El envío no significa
              que el incidente ya haya sido verificado.
            </p>
            <button
              type="button"
              onClick={handleClose}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-semibold text-white transition"
            >
              Listo
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleSubmit}
            className="overflow-y-auto p-4 space-y-3.5"
          >
            <p className="text-xs text-slate-400">
              No necesitas iniciar sesión. No incluyas nombres, teléfonos ni
              otros datos personales.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="complaint-line"
                  className="block text-[11px] font-medium text-slate-300 mb-1"
                >
                  Línea del micro
                </label>
                <input
                  id="complaint-line"
                  list="complaint-line-options"
                  value={lineLabel}
                  onChange={(event) => setLineLabel(event.target.value)}
                  placeholder="Ej. Línea 72 o No identificada"
                  required
                  maxLength={100}
                  autoComplete="off"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                />
                <datalist id="complaint-line-options">
                  {lineOptions.map((line) => (
                    <option key={line.id} value={line.label} />
                  ))}
                </datalist>
              </div>

              <div>
                <label
                  htmlFor="complaint-category"
                  className="block text-[11px] font-medium text-slate-300 mb-1"
                >
                  ¿Qué ocurrió?
                </label>
                <select
                  id="complaint-category"
                  value={category}
                  onChange={(event) =>
                    setCategory(event.target.value as TransportComplaintCategory)
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                >
                  {CATEGORY_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="complaint-internal-number"
                  className="block text-[11px] font-medium text-slate-300 mb-1"
                >
                  Número de interno (opcional)
                </label>
                <input
                  id="complaint-internal-number"
                  value={internalNumber}
                  onChange={(event) => setInternalNumber(event.target.value)}
                  placeholder="Si alcanzaste a verlo"
                  maxLength={30}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                />
              </div>
              <div>
                <label
                  htmlFor="complaint-direction"
                  className="block text-[11px] font-medium text-slate-300 mb-1"
                >
                  Sentido (opcional)
                </label>
                <select
                  id="complaint-direction"
                  value={direction}
                  onChange={(event) =>
                    setDirection(event.target.value as TransportComplaintDirection)
                  }
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                >
                  <option value="no_sabe">No sé</option>
                  <option value="ida">Ida</option>
                  <option value="vuelta">Vuelta</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="complaint-occurred-at"
                  className="block text-[11px] font-medium text-slate-300 mb-1"
                >
                  Fecha y hora del incidente
                </label>
                <input
                  id="complaint-occurred-at"
                  type="datetime-local"
                  value={occurredAtLocal}
                  onChange={(event) => setOccurredAtLocal(event.target.value)}
                  required
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                />
              </div>
              <div>
                <label
                  htmlFor="complaint-stop-reference"
                  className="block text-[11px] font-medium text-slate-300 mb-1"
                >
                  Parada o cruce cercano (opcional)
                </label>
                <input
                  id="complaint-stop-reference"
                  value={stopReference}
                  onChange={(event) => setStopReference(event.target.value)}
                  placeholder="Ej. 2.º anillo y Av. Brasil"
                  maxLength={160}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                />
              </div>
            </div>

            {category === 'cobro_excesivo' && (
              <div>
                <label
                  htmlFor="complaint-fare-amount"
                  className="block text-[11px] font-medium text-slate-300 mb-1"
                >
                  ¿Cuánto te cobraron? (Bs, opcional)
                </label>
                <input
                  id="complaint-fare-amount"
                  type="number"
                  min="0.01"
                  max="1000"
                  step="0.01"
                  inputMode="decimal"
                  value={fareAmount}
                  onChange={(event) => setFareAmount(event.target.value)}
                  placeholder="Ej. 3.00"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                />
              </div>
            )}

            <div>
              <span className="block text-[11px] font-medium text-slate-300 mb-1">
                Ubicación del incidente (opcional)
              </span>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={handleUseCurrentLocation}
                  disabled={isLocating}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-60 border border-slate-700 text-xs text-slate-200 inline-flex items-center gap-1.5"
                >
                  <LocateFixed className="w-3.5 h-3.5" />
                  {isLocating ? 'Buscando…' : 'Usar mi ubicación'}
                </button>
                <button
                  type="button"
                  onClick={handleStartPickLocation}
                  className="px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs text-slate-200 inline-flex items-center gap-1.5"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  Marcar en el mapa
                </button>
                {location && (
                  <button
                    type="button"
                    onClick={() => onLocationChange(null, null)}
                    className="px-3 py-2 rounded-lg text-xs text-slate-400 hover:text-white"
                  >
                    Quitar ubicación
                  </button>
                )}
              </div>
              {location && (
                <p className="mt-1.5 text-[11px] text-emerald-300">
                  Ubicación añadida
                  {locationAccuracyMeters !== null
                    ? ` · precisión aproximada ${Math.round(locationAccuracyMeters)} m`
                    : ''}
                </p>
              )}
              <p className="mt-1 text-[10px] text-slate-500">
                Solo se comparte si la agregas. No se registra tu ubicación en
                segundo plano.
              </p>
            </div>

            <div>
              <label
                htmlFor="complaint-description"
                className="block text-[11px] font-medium text-slate-300 mb-1"
              >
                Describe brevemente lo ocurrido
              </label>
              <textarea
                id="complaint-description"
                rows={3}
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                placeholder="Cuéntanos qué pasó. Evita incluir nombres u otros datos personales."
                required
                minLength={5}
                maxLength={2000}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              <p className="mt-1 text-right text-[10px] text-slate-500">
                {description.length}/2000
              </p>
            </div>

            {errorMessage && (
              <p
                role="alert"
                className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-2"
              >
                {errorMessage}
              </p>
            )}

            <p className="text-[10px] leading-relaxed text-slate-500">
              Tu reporte será privado y solo podrá revisarlo personal autorizado.
              Enviarlo no confirma que la situación haya sido verificada.
            </p>

            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={handleClose}
                className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-medium text-slate-300 transition min-h-[40px]"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-xs font-semibold text-white transition min-h-[40px]"
              >
                {isSubmitting ? 'Enviando…' : 'Enviar denuncia'}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}
