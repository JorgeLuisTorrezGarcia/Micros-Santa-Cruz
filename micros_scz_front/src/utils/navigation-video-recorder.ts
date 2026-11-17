import { Muxer, ArrayBufferTarget } from 'mp4-muxer';

export interface RecordProgressCallback {
  (currentFrame: number, totalFrames: number, percent: number): void;
}

export interface VideoOverlayData {
  lineLabel: string;
  lineColor: string;
  instruction: string;
  watermarkText?: string;
  bearingDeg?: number;
}

export interface RecordOptions {
  canvas: HTMLCanvasElement;
  durationSeconds: number;
  fps?: number;
  quality?: '1080p' | '720p';
  aspectRatio?: '9:16' | '16:9';
  onProgress?: RecordProgressCallback;
  onFrameStep: (progressFraction: number) => Promise<void>;
  getOverlayData?: () => VideoOverlayData;
}

export interface VideoExportResult {
  blob: Blob;
  filename: string;
  mimeType: string;
  format: 'mp4' | 'webm';
  isWhatsAppReady: boolean;
}

export interface VideoDimensions {
  width: number;
  height: number;
}

export function getVideoDimensions(
  quality: '1080p' | '720p',
  aspectRatio: '9:16' | '16:9'
): VideoDimensions {
  const isPortrait = aspectRatio === '9:16';
  const isFullHd = quality === '1080p';
  return {
    width: isPortrait ? (isFullHd ? 1080 : 720) : (isFullHd ? 1920 : 1280),
    height: isPortrait ? (isFullHd ? 1920 : 1280) : (isFullHd ? 1080 : 720),
  };
}

/**
 * Draws crisp, scalable HUD elements (line name, instruction pill, and watermark)
 * directly into the composite canvas so they are permanently burned into the exported video frames.
 */
function renderHUDOnCanvas(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  data: VideoOverlayData
) {
  ctx.save();

  // Scale elements proportionally to output canvas width (base: 720px)
  const scale = width / 720;

  // --- 1. Top Narrative Navigation Pill ---
  const pillHeight = Math.round(38 * scale);
  const pillPaddingX = Math.round(18 * scale);
  const dotRadius = Math.round(5.5 * scale);

  ctx.font = `bold ${Math.round(14 * scale)}px system-ui, -apple-system, sans-serif`;
  const textWidth = ctx.measureText(data.instruction).width;

  ctx.font = `bold ${Math.round(12 * scale)}px monospace`;
  const badgeText = data.lineLabel.replace('Línea ', 'L-');
  const badgeWidth = ctx.measureText(badgeText).width + Math.round(18 * scale);

  const totalPillWidth = Math.min(
    width * 0.92,
    dotRadius * 2 + Math.round(14 * scale) + textWidth + Math.round(16 * scale) + badgeWidth + pillPaddingX * 2
  );
  const pillX = (width - totalPillWidth) / 2;
  const pillY = Math.round(26 * scale);

  // Background pill with subtle shadow and border
  ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.24)';
  ctx.lineWidth = 1.5 * scale;
  ctx.beginPath();
  ctx.roundRect(pillX, pillY, totalPillWidth, pillHeight, pillHeight / 2);
  ctx.fill();
  ctx.stroke();

  // Glowing pulse dot
  const dotX = pillX + pillPaddingX + dotRadius;
  const dotY = pillY + pillHeight / 2;
  ctx.fillStyle = data.lineColor || '#10b981';
  ctx.beginPath();
  ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
  ctx.fill();

  // Instruction text
  ctx.fillStyle = '#ffffff';
  ctx.font = `bold ${Math.round(13.5 * scale)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  const maxInstTextWidth = totalPillWidth - (dotRadius * 2 + badgeWidth + Math.round(52 * scale));
  ctx.fillText(data.instruction, dotX + dotRadius + Math.round(9 * scale), dotY, Math.max(80 * scale, maxInstTextWidth));

  // Line badge pill
  const badgeH = Math.round(24 * scale);
  const badgeX = pillX + totalPillWidth - pillPaddingX - badgeWidth;
  const badgeY = pillY + (pillHeight - badgeH) / 2;
  ctx.fillStyle = 'rgba(30, 41, 59, 0.98)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 1 * scale;
  ctx.beginPath();
  ctx.roundRect(badgeX, badgeY, badgeWidth, badgeH, badgeH / 2);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = data.lineColor || '#38bdf8';
  ctx.font = `bold ${Math.round(12 * scale)}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(badgeText, badgeX + badgeWidth / 2, badgeY + badgeH / 2);

  // --- 2. Bottom Discrete Brand Watermark ---
  const wmText = data.watermarkText || 'Micros Santa Cruz';
  const wmX = Math.round(24 * scale);
  const wmY = height - Math.round(30 * scale);

  // Green SCZ badge box
  const sczBoxW = Math.round(30 * scale);
  const sczBoxH = Math.round(22 * scale);
  ctx.fillStyle = '#10b981';
  ctx.beginPath();
  ctx.roundRect(wmX, wmY - Math.round(15 * scale), sczBoxW, sczBoxH, Math.round(6 * scale));
  ctx.fill();

  ctx.fillStyle = '#022c22';
  ctx.font = `900 ${Math.round(11 * scale)}px system-ui, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('SCZ', wmX + sczBoxW / 2, wmY - Math.round(4 * scale));

  // Watermark brand text
  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 4 * scale;
  ctx.shadowOffsetX = 1 * scale;
  ctx.shadowOffsetY = 1 * scale;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.94)';
  ctx.font = `600 ${Math.round(12.5 * scale)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(wmText, wmX + sczBoxW + Math.round(10 * scale), wmY - Math.round(4 * scale));

  ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
  ctx.shadowBlur = 3 * scale;
  ctx.fillStyle = 'rgba(255, 255, 255, 0.86)';
  ctx.font = `500 ${Math.round(9 * scale)}px system-ui, -apple-system, sans-serif`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(
    '© OpenStreetMap contributors · OpenFreeMap',
    wmX,
    height - Math.round(48 * scale),
    width * 0.68
  );

  // --- 3. Bottom Right 3D Compass / Orientation Pill ---
  if (data.bearingDeg !== undefined) {
    const bearingText = `3D Nav · ${Math.round(data.bearingDeg)}°`;
    ctx.font = `500 ${Math.round(11 * scale)}px monospace`;
    const bWidth = ctx.measureText(bearingText).width + Math.round(20 * scale);
    const bHeight = Math.round(24 * scale);
    const bX = width - bWidth - Math.round(24 * scale);
    const bY = height - Math.round(40 * scale);

    ctx.shadowColor = 'transparent';
    ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1 * scale;
    ctx.beginPath();
    ctx.roundRect(bX, bY, bWidth, bHeight, bHeight / 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#94a3b8';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(bearingText, bX + bWidth / 2, bY + bHeight / 2);
  }

  ctx.restore();
}

/**
 * Checks if browser has hardware-supported WebCodecs VideoEncoder for H.264 MP4.
 */
async function checkWebCodecsH264Support(width: number, height: number): Promise<boolean> {
  if (typeof window === 'undefined' || !('VideoEncoder' in window)) {
    return false;
  }
  try {
    const support = await VideoEncoder.isConfigSupported({
      codec: 'avc1.4d002a', // H.264 Main Profile @ Level 4.2
      width,
      height,
      bitrate: 12_000_000,
      framerate: 30,
    });
    return !!support.supported;
  } catch {
    return false;
  }
}

/**
 * Encodes frames using native WebCodecs VideoEncoder + mp4-muxer.
 * Produces a genuine, standard H.264 MP4 file with Fast-Start ('in-memory' moov atom)
 * that is 100% compatible with WhatsApp, Telegram, CapCut, TikTok, iOS and Android.
 */
async function recordWithWebCodecs(
  compositeCanvas: HTMLCanvasElement,
  totalFrames: number,
  fps: number,
  bitrate: number,
  onProgress?: RecordProgressCallback,
  onFrameStep?: (fraction: number) => Promise<void>,
  renderFrameBlit?: () => void
): Promise<Blob> {
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: compositeCanvas.width,
      height: compositeCanvas.height,
    },
    fastStart: 'in-memory',
  });

  let encoderError: Error | null = null;
  const videoEncoder = new VideoEncoder({
    output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
    error: (e) => {
      encoderError = e;
      console.error('VideoEncoder error:', e);
    },
  });

  videoEncoder.configure({
    codec: 'avc1.4d002a', // H.264 Main Profile
    width: compositeCanvas.width,
    height: compositeCanvas.height,
    bitrate,
    framerate: fps,
  });

  const frameDurationMicros = Math.round(1_000_000 / fps);

  for (let f = 0; f <= totalFrames; f++) {
    if (encoderError) throw encoderError;

    const fraction = f / totalFrames;
    if (onFrameStep) {
      await onFrameStep(fraction);
    }

    if (renderFrameBlit) {
      renderFrameBlit();
    }

    const timestampMicros = f * frameDurationMicros;
    // Create native VideoFrame from composite canvas
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const videoFrame = new (window as any).VideoFrame(compositeCanvas, {
      timestamp: timestampMicros,
      duration: frameDurationMicros,
    });

    while (videoEncoder.encodeQueueSize > 4) {
      await new Promise((resolve) => setTimeout(resolve, 4));
      if (encoderError) {
        videoFrame.close();
        throw encoderError;
      }
    }

    const isKeyframe = f % 30 === 0;
    videoEncoder.encode(videoFrame, { keyFrame: isKeyframe });
    videoFrame.close();

    if (onProgress && f % 3 === 0) {
      const pct = Math.round((f / totalFrames) * 98);
      onProgress(f, totalFrames, pct);
    }

    // Small yield to keep UI responsive
    await new Promise((r) => setTimeout(r, 8));
  }

  await videoEncoder.flush();
  muxer.finalize();

  if (onProgress) {
    onProgress(totalFrames, totalFrames, 100);
  }

  return new Blob([target.buffer], { type: 'video/mp4' });
}

/**
 * Fallback recorder using standard MediaRecorder API.
 */
async function recordWithMediaRecorder(
  compositeCanvas: HTMLCanvasElement,
  totalFrames: number,
  fps: number,
  bitrate: number,
  onProgress?: RecordProgressCallback,
  onFrameStep?: (fraction: number) => Promise<void>,
  renderFrameBlit?: () => void
): Promise<{ blob: Blob; mimeType: string }> {
  const stream = compositeCanvas.captureStream(fps);
  const chunks: Blob[] = [];

  let mimeType = 'video/webm; codecs=vp9';
  if (MediaRecorder.isTypeSupported('video/mp4; codecs=avc1')) {
    mimeType = 'video/mp4; codecs=avc1';
  } else if (MediaRecorder.isTypeSupported('video/mp4')) {
    mimeType = 'video/mp4';
  } else if (!MediaRecorder.isTypeSupported(mimeType)) {
    mimeType = 'video/webm';
  }

  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: bitrate,
  });

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  const recordingPromise = new Promise<{ blob: Blob; mimeType: string }>((resolve, reject) => {
    recorder.onstop = () => {
      const blob = new Blob(chunks, { type: mimeType });
      resolve({ blob, mimeType });
    };
    recorder.onerror = (err) => reject(err);
  });

  recorder.start();
  const frameIntervalMs = Math.round(1000 / fps);

  for (let f = 0; f <= totalFrames; f++) {
    const fraction = f / totalFrames;
    if (onFrameStep) {
      await onFrameStep(fraction);
    }
    if (renderFrameBlit) {
      renderFrameBlit();
    }

    if (onProgress && f % 3 === 0) {
      const pct = Math.round((f / totalFrames) * 98);
      onProgress(f, totalFrames, pct);
    }

    await new Promise((r) => setTimeout(r, frameIntervalMs));
  }

  if (onProgress) {
    onProgress(totalFrames, totalFrames, 100);
  }

  await new Promise((r) => setTimeout(r, 200));
  recorder.stop();

  return await recordingPromise;
}

/**
 * Main export function:
 * Captures map animation and produces an ultra-crisp video.
 * Uses WebCodecs H.264 MP4 with Fast-Start for 100% WhatsApp compatibility,
 * with automatic MediaRecorder fallback.
 */
export async function recordNavigationCanvasVideo(
  options: RecordOptions
): Promise<VideoExportResult> {
  const {
    canvas,
    durationSeconds,
    fps = 30,
    quality = '1080p',
    aspectRatio = '9:16',
    onProgress,
    onFrameStep,
    getOverlayData,
  } = options;

  // Determine fixed high-resolution target dimensions
  const { width: targetWidth, height: targetHeight } = getVideoDimensions(
    quality,
    aspectRatio
  );

  const bitrate = quality === '1080p' ? 9_000_000 : 5_000_000;
  const totalFrames = Math.round(durationSeconds * fps);

  // Setup composite canvas
  const compositeCanvas = document.createElement('canvas');
  compositeCanvas.width = targetWidth;
  compositeCanvas.height = targetHeight;
  const ctx = compositeCanvas.getContext('2d', { alpha: false });

  const renderFrameBlit = () => {
    if (!ctx) return;
    // Draw map frame scaled to target resolution
    ctx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

    // Burn HUD narrative pill and watermark directly onto frame
    if (getOverlayData) {
      const hudData = getOverlayData();
      renderHUDOnCanvas(ctx, targetWidth, targetHeight, hudData);
    }
  };

  // Check if browser supports WebCodecs H.264
  const hasWebCodecs = await checkWebCodecsH264Support(targetWidth, targetHeight);

  if (hasWebCodecs) {
    try {
      const mp4Blob = await recordWithWebCodecs(
        compositeCanvas,
        totalFrames,
        fps,
        bitrate,
        onProgress,
        onFrameStep,
        renderFrameBlit
      );

      return {
        blob: mp4Blob,
        filename: 'recorrido-scz.mp4',
        mimeType: 'video/mp4',
        format: 'mp4',
        isWhatsAppReady: true,
      };
    } catch (e) {
      console.warn('WebCodecs encoding fallback triggered:', e);
    }
  }

  // Fallback to MediaRecorder
  const result = await recordWithMediaRecorder(
    compositeCanvas,
    totalFrames,
    fps,
    bitrate,
    onProgress,
    onFrameStep,
    renderFrameBlit
  );

  const isMp4 = result.mimeType.includes('mp4');
  return {
    blob: result.blob,
    filename: isMp4 ? 'recorrido-scz.mp4' : 'recorrido-scz.webm',
    mimeType: result.mimeType,
    format: isMp4 ? 'mp4' : 'webm',
    isWhatsAppReady: isMp4,
  };
}

/**
 * Initiates download of the recorded video Blob in the user's browser.
 */
export function downloadVideoBlob(blob: Blob, filename = 'recorrido-scz.mp4') {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
