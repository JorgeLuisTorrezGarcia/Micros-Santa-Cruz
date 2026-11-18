import React, { useCallback, useEffect, useState } from 'react';
import { ModerationQueue } from '../types.ts';
import {
  fetchModerationQueue,
  moderateEntity,
} from '../services/communityService.ts';
import { getUserFriendlyError } from '../services/apiClient.ts';
import { Check, ShieldCheck, X, RefreshCw } from 'lucide-react';

interface ModerationModalProps {
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
  onToast: (msg: string) => void;
}

interface ModerationQueueContentProps {
  queue: ModerationQueue | null;
  section: 'places' | 'categories' | 'feedback' | 'complaints';
  errorMsg: string | null;
  onAction: (entity: 'place' | 'category' | 'feedback' | 'complaint', id: string, status: string, label: string) => void;
}

function ModerationQueueContent({
  queue,
  section,
  errorMsg,
  onAction: handleAction,
}: ModerationQueueContentProps) {
  return (
        <div className="flex-1 overflow-y-auto p-4">
          {errorMsg && (
            <p className="text-xs text-rose-300 bg-rose-950/50 border border-rose-800/60 rounded-lg px-3 py-2 mb-3">
              {errorMsg}
            </p>
          )}

          {section === 'places' && (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              {!queue || queue.pendingPlaces.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  No hay propuestas de lugares pendientes.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/70 text-slate-400 text-[11px]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Lugar</th>
                      <th className="px-3 py-2 font-medium">Categoría</th>
                      <th className="px-3 py-2 font-medium">Coordenadas</th>
                      <th className="px-3 py-2 font-medium">Autor</th>
                      <th className="px-3 py-2 text-right font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {queue.pendingPlaces.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-800/40 h-11">
                        <td className="px-3 py-2 font-medium text-slate-100">
                          {p.name}
                        </td>
                        <td className="px-3 py-2 text-slate-300">
                          {p.categoryName}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-400 tabular-nums">
                          {p.lat.toFixed(4)}, {p.lon.toFixed(4)}
                        </td>
                        <td className="px-3 py-2 text-slate-400 truncate max-w-[140px]">
                          {p.ownerName}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleAction(
                                  'place',
                                  p.id,
                                  'public_approved',
                                  `Lugar "${p.name}" aprobado`
                                )
                              }
                              className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/40 transition"
                              title="Aprobar al mapa público"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAction(
                                  'place',
                                  p.id,
                                  'rejected',
                                  `Lugar "${p.name}" rechazado`
                                )
                              }
                              className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/40 transition"
                              title="Rechazar propuesta"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {section === 'categories' && (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              {!queue || queue.pendingCategories.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  No hay categorías pendientes de revisión.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/70 text-slate-400 text-[11px]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Categoría</th>
                      <th className="px-3 py-2 font-medium">Slug</th>
                      <th className="px-3 py-2 text-right font-medium">Acción</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {queue.pendingCategories.map((c) => (
                      <tr key={c.id} className="hover:bg-slate-800/40 h-11">
                        <td className="px-3 py-2 font-medium text-slate-100">
                          {c.name}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-slate-400">
                          {c.slug}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() =>
                                handleAction(
                                  'category',
                                  c.id,
                                  'approved',
                                  `Categoría "${c.name}" aprobada`
                                )
                              }
                              className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/40 transition"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                handleAction(
                                  'category',
                                  c.id,
                                  'rejected',
                                  `Categoría "${c.name}" rechazada`
                                )
                              }
                              className="px-2 py-1 rounded bg-rose-600/20 hover:bg-rose-600 text-rose-300 hover:text-white border border-rose-600/40 transition"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {section === 'feedback' && (
            <div className="border border-slate-800 rounded-xl overflow-hidden">
              {!queue || queue.openFeedback.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-8">
                  No hay reportes abiertos.
                </p>
              ) : (
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800/70 text-slate-400 text-[11px]">
                    <tr>
                      <th className="px-3 py-2 font-medium">Tipo</th>
                      <th className="px-3 py-2 font-medium">Rating</th>
                      <th className="px-3 py-2 font-medium">Comentario</th>
                      <th className="px-3 py-2 text-right font-medium">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800">
                    {queue.openFeedback.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-800/40 h-11">
                        <td className="px-3 py-2 text-slate-300">
                          {f.targetType}
                          {f.targetRef ? ` · ${f.targetRef}` : ''}
                        </td>
                        <td className="px-3 py-2 tabular-nums text-amber-300">
                          {f.rating}/5
                        </td>
                        <td className="px-3 py-2 text-slate-200 max-w-xs truncate">
                          {f.comment}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() =>
                              handleAction(
                                'feedback',
                                f.id,
                                'resolved',
                                'Reporte marcado como resuelto'
                              )
                            }
                            className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/40 transition text-[11px]"
                          >
                            Resolver
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {section === 'complaints' && (
                <div className="border border-slate-800 rounded-xl overflow-x-auto">
                  {!queue || queue.openComplaints.length === 0 ? (
                    <p className="text-xs text-slate-400 text-center py-8">
                      No hay denuncias pendientes de revisión.
                    </p>
                  ) : (
                    <table className="w-full min-w-[880px] text-left text-xs">
                      <thead className="bg-slate-800/70 text-slate-400 text-[11px]">
                        <tr>
                          <th className="px-3 py-2 font-medium">Línea / interno</th>
                          <th className="px-3 py-2 font-medium">Categoría / fecha</th>
                          <th className="px-3 py-2 font-medium">Detalle / ubicación</th>
                          <th className="px-3 py-2 font-medium">Estado</th>
                          <th className="px-3 py-2 text-right font-medium">Acción</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800">
                        {queue.openComplaints.map((complaint) => (
                          <tr key={complaint.id} className="align-top hover:bg-slate-800/40">
                            <td className="px-3 py-2 text-slate-100">
                              <p className="font-semibold">{complaint.lineLabel}</p>
                              {complaint.internalNumber && (
                                <p className="mt-1 text-slate-400">
                                  Interno {complaint.internalNumber}
                                </p>
                              )}
                              <p className="mt-1 text-slate-400">
                                {complaint.direction === 'no_sabe'
                                  ? 'Sentido no indicado'
                                  : complaint.direction === 'ida'
                                    ? 'Ida'
                                    : 'Vuelta'}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-slate-300">
                              <p>{complaint.category.replaceAll('_', ' ')}</p>
                              <p className="mt-1 text-slate-400">
                                Hecho:{' '}
                                {new Date(complaint.occurredAt).toLocaleString(
                                  'es-BO',
                                  { timeZone: complaint.occurredTimezone }
                                )}
                              </p>
                              <p className="mt-1 text-slate-500">
                                Recibido:{' '}
                                {new Date(complaint.createdAt).toLocaleString(
                                  'es-BO',
                                  { timeZone: 'America/La_Paz' }
                                )}
                              </p>
                            </td>
                            <td className="px-3 py-2 text-slate-200 max-w-md">
                              <p className="whitespace-pre-wrap break-words">
                                {complaint.description}
                              </p>
                              {complaint.stopReference && (
                                <p className="mt-1 text-slate-400">
                                  Referencia: {complaint.stopReference}
                                </p>
                              )}
                              {complaint.fareAmount !== null && (
                                <p className="mt-1 text-slate-400">
                                  Monto: Bs {complaint.fareAmount.toFixed(2)}
                                </p>
                              )}
                              {complaint.latitude !== null &&
                                complaint.longitude !== null && (
                                  <p className="mt-1 font-mono text-[10px] text-slate-500">
                                    {complaint.latitude.toFixed(5)},{' '}
                                    {complaint.longitude.toFixed(5)}
                                    {complaint.locationAccuracyMeters !== null
                                      ? ` · ±${Math.round(complaint.locationAccuracyMeters)} m`
                                      : ''}
                                  </p>
                                )}
                            </td>
                            <td className="px-3 py-2 text-slate-300">
                              {complaint.status === 'open' ? 'Nueva' : 'En revisión'}
                            </td>
                            <td className="px-3 py-2 text-right">
                              <div className="inline-flex items-center gap-1.5">
                                {complaint.status === 'open' && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleAction(
                                        'complaint',
                                        complaint.id,
                                        'reviewed',
                                        'Denuncia marcada en revisión'
                                      )
                                    }
                                    className="px-2 py-1 rounded bg-amber-600/20 hover:bg-amber-600 text-amber-200 hover:text-white border border-amber-600/40 transition"
                                  >
                                    Revisar
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleAction(
                                      'complaint',
                                      complaint.id,
                                      'resolved',
                                      'Denuncia cerrada en la revisión'
                                    )
                                  }
                                  className="px-2 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600 text-emerald-300 hover:text-white border border-emerald-600/40 transition"
                                >
                                  Cerrar
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}
        </div>
  );
}

export const ModerationModal: React.FC<ModerationModalProps> = ({
  isOpen,
  onClose,
  onChanged,
  onToast,
}) => {
  const [queue, setQueue] = useState<ModerationQueue | null>(null);
  const [section, setSection] = useState<
    'places' | 'categories' | 'feedback' | 'complaints'
  >('places');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadQueue = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const data = await fetchModerationQueue();
      setQueue(data);
    } catch (err: unknown) {
      console.error('Error al cargar las solicitudes de moderación:', err);
      setErrorMsg(
        getUserFriendlyError(
          err,
          'No pudimos cargar las solicitudes. Inténtalo nuevamente.'
        )
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isOpen) {
      loadQueue();
    }
  }, [isOpen, loadQueue]);

  if (!isOpen) return null;

  const handleAction = async (
    entity: 'place' | 'category' | 'feedback' | 'complaint',
    id: string,
    status: string,
    label: string
  ) => {
    try {
      await moderateEntity(entity, id, status);
      onToast(label);
      await loadQueue();
      onChanged();
    } catch (err: unknown) {
      console.error('Error al actualizar una solicitud de moderación:', err);
      onToast(
        getUserFriendlyError(
          err,
          'No pudimos guardar los cambios. Inténtalo nuevamente.'
        )
      );
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-3xl max-h-[85vh] flex flex-col bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-100">
              Moderación Comunitaria (Admin)
            </h2>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={loadQueue}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Actualizar cola"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              aria-label="Cerrar moderación"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Section Tabs */}
        <div className="px-4 pt-3 flex items-center gap-2 border-b border-slate-800 pb-2.5 text-xs">
          <button
            type="button"
            onClick={() => setSection('places')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition tabular-nums ${
              section === 'places'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Lugares ({queue?.pendingPlaces.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setSection('categories')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition tabular-nums ${
              section === 'categories'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Categorías ({queue?.pendingCategories.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setSection('feedback')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition tabular-nums ${
              section === 'feedback'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Feedback ({queue?.openFeedback.length ?? 0})
          </button>
          <button
            type="button"
            onClick={() => setSection('complaints')}
            className={`px-3 py-1.5 rounded-lg font-semibold transition tabular-nums ${
              section === 'complaints'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:text-white'
            }`}
          >
            Denuncias ({queue?.openComplaints.length ?? 0})
          </button>
        </div>

        <ModerationQueueContent
          queue={queue}
          section={section}
          errorMsg={errorMsg}
          onAction={handleAction}
        />
      </div>
    </div>
  );
};
