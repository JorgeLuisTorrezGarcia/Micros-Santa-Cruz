import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import {
  X,
  Play,
  Pause,
  RotateCcw,
  Download,
  Film,
  Smartphone,
  Monitor,
  CheckCircle2,
  Sparkles,
  Layers,
} from 'lucide-react';
import type { TripOption } from '../types.ts';
import {
  RouteAnimationTrajectory,
  type AnimationSample,
} from '../utils/animation-trajectory.ts';
import {
  NavigationMapCanvas,
  type NavigationMapCanvasHandle,
} from './NavigationMapCanvas.tsx';
import {
  recordNavigationCanvasVideo,
  downloadVideoBlob,
} from '../utils/navigation-video-recorder.ts';

interface NavigationAnimationModalProps {
  isOpen: boolean;
  onClose: () => void;
  trip: TripOption | null;
}

interface AnimationHeaderProps {
  trip: TripOption;
  aspectRatio: '9:16' | '16:9';
  setAspectRatio: React.Dispatch<React.SetStateAction<'9:16' | '16:9'>>;
  videoQuality: '1080p' | '720p';
  setVideoQuality: React.Dispatch<React.SetStateAction<'1080p' | '720p'>>;
  mapStyleKey: 'liberty' | 'dark' | 'bright';
  setMapStyleKey: React.Dispatch<React.SetStateAction<'liberty' | 'dark' | 'bright'>>;
  isRecording: boolean;
  onExportVideo: () => void;
  onClose: () => void;
}

function AnimationHeader(props: AnimationHeaderProps) {
  const { trip, aspectRatio, setAspectRatio, videoQuality, setVideoQuality, mapStyleKey, setMapStyleKey, isRecording, onExportVideo, onClose } = props;
  return (
    <>
      {/* Top Header */}
        <div className="flex-none px-4 py-3 border-b border-slate-800 flex items-center justify-between gap-3 bg-slate-900/90">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center text-slate-950 shadow-md shadow-emerald-500/20 shrink-0">
              <Film className="w-4 h-4 text-slate-950" />
            </div>
            <div className="min-w-0">
              <h3 className="font-bold text-sm text-slate-100 flex items-center gap-2 truncate">
                <span>Animación 3D de Navegación</span>
                <span className="hidden sm:inline-block px-2 py-0.2 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-700/60">
                  Listo para CapCut
                </span>
              </h3>
              <p className="text-xs text-slate-400 truncate">
                {trip.summary} · {trip.steps.length} etapas
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* Aspect Ratio Switcher */}
            <div className="flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700/80 text-xs">
              <button
                type="button"
                onClick={() => setAspectRatio('9:16')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition ${
                  aspectRatio === '9:16'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Formato vertical para TikTok, Reels y CapCut"
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">9:16 Vertical</span>
              </button>
              <button
                type="button"
                onClick={() => setAspectRatio('16:9')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md font-semibold transition ${
                  aspectRatio === '16:9'
                    ? 'bg-emerald-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white'
                }`}
                title="Formato horizontal panorámico"
              >
                <Monitor className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">16:9</span>
              </button>
            </div>

            {/* Resolution Quality Selector */}
            <div className="hidden sm:flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700/80 text-xs">
              <button
                type="button"
                onClick={() => setVideoQuality('1080p')}
                className={`px-2 py-1 rounded-md transition font-semibold ${
                  videoQuality === '1080p'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Resolución Full HD (1080p) - Máxima nitidez"
              >
                1080p
              </button>
              <button
                type="button"
                onClick={() => setVideoQuality('720p')}
                className={`px-2 py-1 rounded-md transition font-semibold ${
                  videoQuality === '720p'
                    ? 'bg-slate-700 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
                title="Resolución HD estándar (720p) - Exportación más rápida"
              >
                720p
              </button>
            </div>

            {/* Map Style Selector */}
            <div className="hidden md:flex items-center p-0.5 rounded-lg bg-slate-800 border border-slate-700/80 text-xs">
              <button
                type="button"
                onClick={() => setMapStyleKey('liberty')}
                className={`px-2 py-1 rounded-md transition ${
                  mapStyleKey === 'liberty'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Clásico
              </button>
              <button
                type="button"
                onClick={() => setMapStyleKey('dark')}
                className={`px-2 py-1 rounded-md transition ${
                  mapStyleKey === 'dark'
                    ? 'bg-slate-700 text-white font-bold'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Noche
              </button>
            </div>

            {/* Download Video Button */}
            <button
              type="button"
              disabled={isRecording}
              onClick={onExportVideo}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 shadow-md shadow-emerald-500/20 transition cursor-pointer disabled:opacity-50"
              title="Descargar video MP4 compatible con WhatsApp y CapCut"
            >
              <Download className="w-3.5 h-3.5 text-slate-950" />
              <span className="hidden sm:inline">Descargar MP4</span>
              <span className="sm:hidden">MP4</span>
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
              title="Cerrar modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
    </>
  );
}

interface PlaybackHudProps {
  isPlaying: boolean;
  onTogglePlay: () => void;
  onRestart: () => void;
  currentSeconds: number;
  totalSeconds: number;
  formatTime: (seconds: number) => string;
  progress: number;
  onSeek: (value: number) => void;
  playbackSpeed: number;
  setPlaybackSpeed: React.Dispatch<React.SetStateAction<number>>;
}

function PlaybackHud(props: PlaybackHudProps) {
  const { isPlaying, onTogglePlay, onRestart, currentSeconds, totalSeconds, formatTime, progress, onSeek, playbackSpeed, setPlaybackSpeed } = props;
  return (
    <>
      {/* Bottom Playback HUD Bar */}
        <div className="flex-none p-3 border-t border-slate-800 bg-slate-900/95 flex flex-col sm:flex-row items-center gap-3">
          {/* Controls: Play, Restart */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onTogglePlay}
              className="w-9 h-9 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold flex items-center justify-center shadow-md transition active:scale-95"
              title={isPlaying ? 'Pausar' : 'Reproducir'}
            >
              {isPlaying ? <Pause className="w-4 h-4 fill-current" /> : <Play className="w-4 h-4 fill-current ml-0.5" />}
            </button>
            <button
              type="button"
              onClick={onRestart}
              className="p-2 rounded-xl text-slate-300 hover:text-white hover:bg-slate-800 transition"
              title="Reiniciar animación"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          </div>

          {/* Timeline Scrubber Slider */}
          <div className="flex-1 flex items-center gap-3 w-full">
            <span className="text-xs font-mono text-slate-400 flex-none">
              {formatTime(currentSeconds)}
            </span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.002}
              value={progress}
              onChange={(e) => onSeek(parseFloat(e.target.value))}
              className="flex-1 h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-emerald-500"
            />
            <span className="text-xs font-mono text-slate-400 flex-none">
              {formatTime(totalSeconds)}
            </span>
          </div>

          {/* Speed Selector */}
          <div className="flex items-center gap-1 flex-none">
            {[1.0, 1.5, 2.0].map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlaybackSpeed(s)}
                className={`px-2 py-1 rounded-md text-[11px] font-semibold border transition ${
                  playbackSpeed === s
                    ? 'bg-slate-700 text-emerald-400 border-emerald-500/50'
                    : 'bg-slate-800 text-slate-400 border-slate-700/60 hover:text-white'
                }`}
              >
                {s}x
              </button>
            ))}
          </div>
        </div>
    </>
  );
}

export const NavigationAnimationModal: React.FC<NavigationAnimationModalProps> = ({
  isOpen,
  onClose,
  trip,
}) => {
  // Config
  const [aspectRatio, setAspectRatio] = useState<'9:16' | '16:9'>('9:16');
  const [mapStyleKey, setMapStyleKey] = useState<'liberty' | 'dark' | 'bright'>('liberty');
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1.0);
  const [videoQuality, setVideoQuality] = useState<'1080p' | '720p'>('1080p');
  const [exportFps, setExportFps] = useState<30 | 60>(30);
  const [toastNotification, setToastNotification] = useState<string | null>(null);

  // Playback state
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [progress, setProgress] = useState<number>(0); // 0 to 1

  // Export recording state
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordProgress, setRecordProgress] = useState<number>(0);
  const [recordFrameInfo, setRecordFrameInfo] = useState<{ curr: number; total: number }>({
    curr: 0,
    total: 420,
  });

  const canvasHandleRef = useRef<NavigationMapCanvasHandle | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);
  const currentFractionRef = useRef<number>(0);

  const mapStyleUrl = useMemo(() => {
    switch (mapStyleKey) {
      case 'dark':
        return 'https://tiles.openfreemap.org/styles/dark';
      case 'bright':
        return 'https://tiles.openfreemap.org/styles/bright';
      case 'liberty':
      default:
        return 'https://tiles.openfreemap.org/styles/liberty';
    }
  }, [mapStyleKey]);

  // Trajectory generator
  const trajectory = useMemo(() => {
    if (!trip) return null;
    return new RouteAnimationTrajectory(trip, 14); // 14 seconds ideal duration
  }, [trip]);

  // Current sample based on progress
  const currentSample = useMemo<AnimationSample>(() => {
    if (!trajectory) {
      return {
        coords: [-63.18, -17.78],
        bearing: 0,
        cameraBearing: 0,
        cameraPitch: 55,
        cameraZoom: 16.5,
        phase: 'walk_start',
        lineLabel: 'Santa Cruz',
        lineColor: '#10b981',
        isBus: false,
        instruction: 'Preparando ruta',
        progressFraction: 0,
        elapsedSeconds: 0,
        totalDurationSeconds: 14,
      };
    }
    return trajectory.sampleAtProgress(progress);
  }, [trajectory, progress]);

  // Reset progress when modal opens or trip changes
  useEffect(() => {
    if (isOpen) {
      setProgress(0);
      setIsPlaying(true);
      lastTimeRef.current = null;
    } else {
      setIsPlaying(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    }
  }, [isOpen, trip]);

  // Smooth playback loop
  useEffect(() => {
    if (!isPlaying || isRecording || !trajectory) {
      lastTimeRef.current = null;
      return;
    }

    const durationSec = trajectory.totalDurationSeconds;

    const tick = (now: number) => {
      if (lastTimeRef.current !== null) {
        const deltaMs = now - lastTimeRef.current;
        const deltaProgress = (deltaMs / 1000 / durationSec) * playbackSpeed;

        setProgress((prev) => {
          const next = prev + deltaProgress;
          if (next >= 1) {
            setIsPlaying(false);
            return 1;
          }
          return next;
        });
      }
      lastTimeRef.current = now;
      animationFrameRef.current = requestAnimationFrame(tick);
    };

    animationFrameRef.current = requestAnimationFrame(tick);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [isPlaying, isRecording, trajectory, playbackSpeed]);

  const handleTogglePlay = () => {
    if (progress >= 1) {
      setProgress(0);
      setIsPlaying(true);
    } else {
      setIsPlaying((prev) => !prev);
    }
  };

  const handleRestart = () => {
    setProgress(0);
    setIsPlaying(true);
  };

  const handleSeek = (val: number) => {
    setProgress(val);
  };

  // Export video
  const handleExportVideo = async () => {
    if (!canvasHandleRef.current || !trajectory) return;
    const canvas = canvasHandleRef.current.getCanvas();
    if (!canvas) return;

    setIsPlaying(false);
    setIsRecording(true);
    setRecordProgress(0);

    try {
      const lineName = trip?.legs[0]?.routeLabel?.replace(/\s+/g, '-').toLowerCase() || 'micro';

      const result = await recordNavigationCanvasVideo({
        canvas,
        durationSeconds: trajectory.totalDurationSeconds,
        fps: exportFps,
        quality: videoQuality,
        aspectRatio,
        onProgress: (curr, total, pct) => {
          setRecordFrameInfo({ curr, total });
          setRecordProgress(pct);
        },
        onFrameStep: async (fraction) => {
          currentFractionRef.current = fraction;
          setProgress(fraction);
          canvasHandleRef.current?.triggerRepaint();
          await new Promise((r) => requestAnimationFrame(r));
        },
        getOverlayData: () => {
          const sample = trajectory.sampleAtProgress(currentFractionRef.current);
          return {
            lineLabel: sample.lineLabel,
            lineColor: sample.lineColor,
            instruction: sample.instruction,
            watermarkText: 'Micros Santa Cruz · Recorrido Oficial',
            bearingDeg: sample.bearing,
          };
        },
      });

      const finalFilename = `recorrido-scz-${lineName}.${result.format}`;
      downloadVideoBlob(result.blob, finalFilename);

      setToastNotification(
        result.isWhatsAppReady
          ? '¡Tu video está listo para compartir por WhatsApp, CapCut, TikTok e Instagram!'
          : '¡Tu video se descargó y está listo para compartir!'
      );
      setTimeout(() => setToastNotification(null), 5000);
    } catch (err) {
      console.error('Error al exportar video:', err);
      setToastNotification('No pudimos crear el video. Inténtalo nuevamente.');
      setTimeout(() => setToastNotification(null), 5000);
    } finally {
      setIsRecording(false);
    }
  };

  if (!isOpen || !trip) return null;

  const currentSeconds = Math.round(progress * (trajectory?.totalDurationSeconds || 14));
  const totalSeconds = trajectory?.totalDurationSeconds || 14;
  const formatTime = (s: number) =>
    `00:${s.toString().padStart(2, '0')}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-950/85 backdrop-blur-md animate-fade-in">
      <div className="relative w-full max-w-5xl h-[92vh] max-h-[880px] bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        <AnimationHeader
        trip={trip}
        aspectRatio={aspectRatio}
        setAspectRatio={setAspectRatio}
        videoQuality={videoQuality}
        setVideoQuality={setVideoQuality}
        mapStyleKey={mapStyleKey}
        setMapStyleKey={setMapStyleKey}
        isRecording={isRecording}
        onExportVideo={handleExportVideo}
        onClose={onClose}
      />

      {/* Center Canvas Stage Area */}
        <div className="relative flex-1 w-full bg-slate-950/80 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          {/* Toast Notification Banner */}
          {toastNotification && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-xl bg-emerald-950/95 border border-emerald-500/80 text-emerald-200 text-xs font-semibold shadow-2xl flex items-center gap-2 max-w-[90%] text-center animate-fade-in">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-none" />
              <span>{toastNotification}</span>
            </div>
          )}

          {/* Framed Viewport (9:16 or 16:9) */}
          <div
            className={`relative rounded-2xl overflow-hidden border border-slate-700/80 shadow-2xl transition-all duration-300 ${
              aspectRatio === '9:16'
                ? 'w-auto h-full max-h-[640px] aspect-[9/16]'
                : 'w-full max-w-[840px] aspect-[16/9]'
            }`}
          >
            <NavigationMapCanvas
              ref={canvasHandleRef}
              trip={trip}
              sample={currentSample}
              mapStyleUrl={mapStyleUrl}
              aspectRatio={aspectRatio}
              watermarkText="Micros Santa Cruz · Recorrido Oficial"
            />
          </div>

          {/* Exporting Progress Overlay */}
          {isRecording && (
            <div className="absolute inset-0 z-40 bg-slate-950/92 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center animate-fade-in">
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center mb-4">
                <Film className="w-8 h-8 text-emerald-400 animate-pulse" />
              </div>
              <h4 className="text-lg font-bold text-slate-100 mb-1">
                Generando Video MP4 ({videoQuality})
              </h4>
              <p className="text-xs text-slate-400 max-w-sm mb-4">
                Estamos preparando tu recorrido para compartir. Esto puede tardar un momento.
              </p>

              <div className="w-full max-w-xs bg-slate-800 rounded-full h-2.5 overflow-hidden border border-slate-700 mb-2">
                <div
                  className="bg-emerald-500 h-2.5 transition-all duration-150 rounded-full"
                  style={{ width: `${recordProgress}%` }}
                />
              </div>
              <div className="flex items-center justify-between w-full max-w-xs text-[11px] text-slate-400 font-mono">
                <span>Preparando video...</span>
                <span>{recordProgress}%</span>
              </div>
            </div>
          )}
        </div>

        <PlaybackHud
        isPlaying={isPlaying}
        onTogglePlay={handleTogglePlay}
        onRestart={handleRestart}
        currentSeconds={currentSeconds}
        totalSeconds={totalSeconds}
        formatTime={formatTime}
        progress={progress}
        onSeek={handleSeek}
        playbackSpeed={playbackSpeed}
        setPlaybackSpeed={setPlaybackSpeed}
      />
      </div>
    </div>
  );
};
