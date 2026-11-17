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
  section: 'places' | 'categories' | 'feedback';
  errorMsg: string | null;
  onAction: (entity: 'place' | 'category' | 'feedback', id: string, status: string, label: string) => void;
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
  const [section, setSection] = useState<'places' | 'categories' | 'feedback'>(
    'places'
  );
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
    entity: 'place' | 'category' | 'feedback',
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
