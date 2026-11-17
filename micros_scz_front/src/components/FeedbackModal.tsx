import React, { useEffect, useState } from 'react';
import { FeedbackCategory, FeedbackTargetType } from '../types.ts';
import { submitFeedback } from '../services/communityService.ts';
import { getUserFriendlyError } from '../services/apiClient.ts';
import { X, Star, MessageSquarePlus, CheckCircle2 } from 'lucide-react';

interface FeedbackModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultTargetType?: FeedbackTargetType;
  defaultTargetRef?: string;
  onToast: (msg: string) => void;
}

const CATEGORY_OPTIONS: Array<{ value: FeedbackCategory; label: string }> = [
  { value: 'ruta_desactualizada', label: 'Ruta desactualizada' },
  { value: 'parada', label: 'Parada o desvío' },
  { value: 'lugar_erroneo', label: 'Lugar o dirección errónea' },
  { value: 'sugerencia', label: 'Sugerencia de mejora' },
  { value: 'bug', label: 'Problema con la aplicación' },
];

export const FeedbackModal: React.FC<FeedbackModalProps> = ({
  isOpen,
  onClose,
  defaultTargetType = 'app',
  defaultTargetRef = '',
  onToast,
}) => {
  const [targetType, setTargetType] = useState<FeedbackTargetType>(defaultTargetType);
  const [targetRef, setTargetRef] = useState<string>(defaultTargetRef);
  const [category, setCategory] = useState<FeedbackCategory>('sugerencia');
  const [rating, setRating] = useState<number>(5);
  const [comment, setComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setTargetType(defaultTargetType);
      setTargetRef(defaultTargetRef);
      setErrorMsg(null);
      setSubmitted(false);
    }
  }, [isOpen, defaultTargetType, defaultTargetRef]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (comment.trim().length < 4) {
      setErrorMsg('Por favor escribe al menos 4 caracteres.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);

    try {
      await submitFeedback({
        targetType,
        targetRef: targetRef.trim() || null,
        rating,
        category,
        comment: comment.trim(),
      });
      setSubmitted(true);
      setComment('');
      onToast('¡Gracias! Tu feedback fue registrado en la comunidad.');
      setTimeout(() => {
        onClose();
      }, 900);
    } catch (err: unknown) {
      console.error('Error al enviar el reporte:', err);
      setErrorMsg(
        getUserFriendlyError(
          err,
          'No pudimos enviar tu reporte. Inténtalo nuevamente.'
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
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <MessageSquarePlus className="w-4 h-4 text-emerald-400" />
            <h2 className="text-sm font-bold text-slate-100">
              Reportar o Enviar Feedback
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            aria-label="Cerrar feedback"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
          {submitted ? (
            <div className="py-8 text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
              <p className="text-sm font-semibold text-slate-100">
                Feedback enviado correctamente
              </p>
              <p className="text-xs text-slate-400">
                Nuestro equipo revisará tu aporte para mejorar las rutas en
                Santa Cruz.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Sobre qué opinas
                  </label>
                  <select
                    value={targetType}
                    onChange={(e) =>
                      setTargetType(e.target.value as FeedbackTargetType)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                  >
                    <option value="app">Aplicación general</option>
                    <option value="line">Línea de micro</option>
                    <option value="trip">Navegación</option>
                    <option value="place">Lugar / Parada</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-medium text-slate-400 mb-1">
                    Categoría
                  </label>
                  <select
                    value={category}
                    onChange={(e) =>
                      setCategory(e.target.value as FeedbackCategory)
                    }
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-xs text-slate-100 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                  >
                    {CATEGORY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Referencia (opcional: ej. Línea 72, UAGRM)
                </label>
                <input
                  type="text"
                  value={targetRef}
                  onChange={(e) => setTargetRef(e.target.value)}
                  placeholder="Ej. Línea 72 Ida o Mercado La Ramada"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 min-h-[40px]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Calificación de precisión
                </label>
                <div className="flex items-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setRating(star)}
                      className="p-1.5 rounded-lg hover:bg-slate-800 transition"
                      aria-label={`${star} estrellas`}
                    >
                      <Star
                        className={`w-5 h-5 ${
                          star <= rating
                            ? 'text-amber-400 fill-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs text-slate-400 tabular-nums">
                    {rating}/5
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-400 mb-1">
                  Detalle o sugerencia
                </label>
                <textarea
                  rows={3}
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Cuéntanos si cambió el desvío, falta un lugar o cómo mejorar..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

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
                  {isSubmitting ? 'Enviando...' : 'Enviar reporte'}
                </button>
              </div>
            </>
          )}
        </form>
      </div>
    </div>
  );
};
