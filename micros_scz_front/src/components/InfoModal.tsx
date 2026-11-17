import React from 'react';
import { Bus, Map, CheckCircle2, X } from 'lucide-react';

interface InfoModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InfoModal: React.FC<InfoModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fade-in select-none">
      <div className="bg-slate-900 border border-slate-700/80 rounded-2xl max-w-lg w-full max-h-[85vh] overflow-y-auto shadow-2xl p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 flex items-center justify-center">
              <Bus className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-base text-slate-100">
                Micros Santa Cruz – Guía de Uso
              </h2>
              <p className="text-xs text-slate-400">
                Santa Cruz de la Sierra, Bolivia
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Santa Cruz Transit guide */}
        <div className="space-y-3 text-xs text-slate-300 leading-relaxed">
          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-800/40 space-y-1">
            <h3 className="font-semibold text-emerald-300 flex items-center gap-1.5">
              <Map className="w-3.5 h-3.5" />
              Estructura de la Ciudad y Rutas
            </h3>
            <p>
              Santa Cruz está trazada en anillos concéntricos (1er al 8vo anillo) y avenidas radiales.
              Los micros recorren la ciudad en dos sentidos: <strong>S1 (Ida)</strong> y <strong>S2 (Vuelta)</strong>. En el mapa verás pequeñas flechas que indican el sentido exacto de circulación.
            </p>
          </div>

          <div className="space-y-2">
            <h4 className="font-semibold text-slate-200">
              ¿Cómo usar las funciones de la app?
            </h4>
            <div className="grid gap-2">
              <div className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                <span className="w-5 h-5 rounded-md bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold text-xs flex-none mt-0.5">
                  1
                </span>
                <div>
                  <strong className="text-slate-100">Pestaña Líneas:</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Busca tu micro por número (ej. Línea 72, 11, 101). Activa o desactiva con la casilla para visualizar su recorrido completo con colores distintivos.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                <span className="w-5 h-5 rounded-md bg-sky-500/20 text-sky-400 flex items-center justify-center font-bold text-xs flex-none mt-0.5">
                  2
                </span>
                <div>
                  <strong className="text-slate-100">Pestaña Cerca:</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Toca cualquier punto del mapa o pulsa <strong>Mi GPS</strong>. Te listará en tiempo real todos los micros que pasan a menos de 500 metros (o el radio que elijas).
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                <span className="w-5 h-5 rounded-md bg-rose-500/20 text-rose-400 flex items-center justify-center font-bold text-xs flex-none mt-0.5">
                  3
                </span>
                <div>
                  <strong className="text-slate-100">Navegación:</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    Fija un Origen A y Destino B. El motor calculará rutas directas y opciones con 1 transbordo, tiempos estimados y tramos a pie.
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-2 bg-slate-800/40 p-2.5 rounded-xl border border-slate-800">
                <span className="w-5 h-5 rounded-md bg-indigo-500/20 text-indigo-400 flex items-center justify-center font-bold text-xs flex-none mt-0.5">
                  4
                </span>
                <div>
                  <strong className="text-slate-100">Agregar datos al mapa:</strong>
                  <p className="text-slate-400 text-[11px] mt-0.5">
                    En la pestaña <strong>Datos</strong> puedes añadir archivos GeoJSON o JSON con líneas, puntos o zonas. Las rutas oficiales no se modifican.
                  </p>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-2 border-t border-slate-800 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-md"
          >
            Entendido, volver al mapa
          </button>
        </div>
      </div>
    </div>
  );
};
