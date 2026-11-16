import React, { useRef, useState } from 'react';
import { CustomDatasetConfig, DatasetStats } from '../types.ts';
import {
  UploadCloud,
  FileCode,
  Zap,
  RotateCcw,
  Layers,
  Cpu,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle,
  AlertTriangle,
  Info,
} from 'lucide-react';

interface DatasetTabProps {
  stats: DatasetStats | null;
  isLoading: boolean;
  onLoadCustomFile: (file: File) => void;
  onResetDefaultDataset: () => void;
  customDataset?: CustomDatasetConfig;
  onToggleCustomDatasetVisibility?: () => void;
  onChangeCustomDatasetColor?: (color: string) => void;
  onClearCustomDataset?: () => void;
}

export const DatasetTab: React.FC<DatasetTabProps> = ({
  stats,
  isLoading,
  onLoadCustomFile,
  onResetDefaultDataset,
  customDataset,
  onToggleCustomDatasetVisibility,
  onChangeCustomDatasetColor,
  onClearCustomDataset,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const processFile = (file: File) => {
    setLoadError(null);
    if (!file.name.endsWith('.geojson') && !file.name.endsWith('.json')) {
      setLoadError('Por favor selecciona un archivo con formato .geojson o .json');
      return;
    }
    onLoadCustomFile(file);
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Upload Box */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`p-5 rounded-2xl border-2 border-dashed transition text-center cursor-pointer select-none ${
          dragOver
            ? 'border-emerald-400 bg-emerald-950/30'
            : 'border-slate-700 hover:border-slate-500 bg-slate-800/40 hover:bg-slate-800/70'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".geojson,.json"
          onChange={handleFileChange}
          className="hidden"
        />

        <div className="w-12 h-12 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/30 flex items-center justify-center mx-auto mb-2">
          {isLoading ? (
            <div className="w-6 h-6 border-2 border-indigo-400 border-t-transparent rounded-full animate-spin" />
          ) : (
            <UploadCloud className="w-6 h-6" />
          )}
        </div>

        <p className="font-semibold text-sm text-slate-100">
          {isLoading
            ? 'Cargando capa GeoJSON aislada...'
            : 'Superponer GeoJSON técnico en el mapa'}
        </p>
        <p className="text-xs text-slate-400 mt-1 max-w-xs mx-auto">
          Carga archivos de polígonos, líneas o puntos para inspección visual sin modificar las rutas oficiales de micro.
        </p>

        <div className="inline-flex items-center gap-1.5 mt-3 px-2.5 py-1 rounded-full bg-slate-900/80 border border-slate-700 text-[11px] text-slate-300">
          <Info className="w-3.5 h-3.5 text-sky-400" />
          <span>rutas_micro_scz.geojson se mantiene como fuente de la verdad</span>
        </div>
      </div>

      {loadError && (
        <div className="p-2.5 rounded-xl bg-rose-950/40 border border-rose-800/60 text-xs text-rose-300 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400 flex-none" />
          <span>{loadError}</span>
        </div>
      )}

      {/* Active Custom Dataset Card (if loaded) */}
      {customDataset && customDataset.geoJson && (
        <div className="p-3.5 rounded-xl bg-indigo-950/30 border border-indigo-800/50 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-indigo-400" />
              <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                Capa Personalizada Activa
              </h3>
            </div>
            <span className="text-[11px] text-indigo-300 bg-indigo-900/60 px-2 py-0.5 rounded-md border border-indigo-700/50">
              {customDataset.featureCount} geometrías
            </span>
          </div>

          <p className="text-xs text-slate-300 truncate">
            Archivo: <strong className="text-white">{customDataset.fileName}</strong>
          </p>

          <div className="flex items-center justify-between pt-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Color:</span>
              <input
                type="color"
                value={customDataset.color}
                onChange={(e) => onChangeCustomDatasetColor?.(e.target.value)}
                className="w-7 h-7 rounded border border-slate-700 bg-transparent cursor-pointer"
                title="Cambiar color de capa"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onToggleCustomDatasetVisibility}
                className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 transition border border-slate-700"
              >
                {customDataset.isVisible ? (
                  <>
                    <Eye className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Visible</span>
                  </>
                ) : (
                  <>
                    <EyeOff className="w-3.5 h-3.5 text-slate-400" />
                    <span>Oculta</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onClearCustomDataset}
                className="px-2.5 py-1.5 rounded-lg bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 text-xs font-medium flex items-center gap-1.5 transition border border-rose-800/60"
                title="Remover capa técnica"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Quitar</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Routes & Engine Stats */}
      <div className="p-3.5 rounded-xl bg-slate-800/60 border border-slate-700/80 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h3 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
              Rutas Oficiales de Santa Cruz
            </h3>
          </div>
          <span className="flex items-center gap-1 text-[11px] text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded-md border border-emerald-800/50">
            <CheckCircle className="w-3 h-3" />
            Fuente Oficial Activa
          </span>
        </div>

        {stats ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Archivo cargado:</span>
              <span className="font-semibold text-slate-100 truncate block mt-0.5">
                {stats.fileName}
              </span>
              <span className="text-[10px] text-slate-400">
                {formatFileSize(stats.fileSizeBytes)}
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Tiempo de indexación:</span>
              <span className="font-bold text-emerald-400 text-sm block mt-0.5">
                {stats.loadTimeMs} ms
              </span>
              <span className="text-[10px] text-slate-400">Sin congelar la UI</span>
            </div>

            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Líneas y ramales:</span>
              <span className="font-semibold text-slate-200 text-sm block mt-0.5">
                {stats.routeCount} rutas
              </span>
              <span className="text-[10px] text-slate-400">
                {stats.totalDistanceKm.toLocaleString()} km de red
              </span>
            </div>

            <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800">
              <span className="text-slate-400 text-[11px] block">Segmentos RBush:</span>
              <span className="font-semibold text-sky-400 text-sm block mt-0.5">
                {stats.segmentCount.toLocaleString()}
              </span>
              <span className="text-[10px] text-slate-400">Consultas en &lt; 2 ms</span>
            </div>
          </div>
        ) : (
          <p className="text-xs text-slate-400">Cargando estadísticas del dataset...</p>
        )}

        {/* Tech Stack Components Details */}
        <div className="pt-2 border-t border-slate-700/60 space-y-2 text-xs">
          <div className="flex items-center gap-2 text-slate-300">
            <Cpu className="w-3.5 h-3.5 text-indigo-400 flex-none" />
            <div>
              <strong className="text-white">geojson-vt:</strong> Slicing dinámico en tiles vectoriales en segundo plano.
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <Layers className="w-3.5 h-3.5 text-sky-400 flex-none" />
            <div>
              <strong className="text-white">RBush:</strong> Árbol espacial R-tree en memoria para calcular líneas cercanas y transbordos instantáneos.
            </div>
          </div>
          <div className="flex items-center gap-2 text-slate-300">
            <FileCode className="w-3.5 h-3.5 text-emerald-400 flex-none" />
            <div>
              <strong className="text-white">MapLibre GL JS:</strong> Renderizado acelerado por GPU a 60 fps.
            </div>
          </div>
        </div>

        <button
          onClick={onResetDefaultDataset}
          className="w-full mt-2 py-2 px-3 rounded-xl bg-slate-700/60 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center justify-center gap-2 transition border border-slate-600"
        >
          <RotateCcw className="w-3.5 h-3.5 text-amber-400" />
          <span>Restablecer rutas base de Santa Cruz</span>
        </button>
      </div>
    </div>
  );
};
