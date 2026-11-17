import type * as maplibregl from 'maplibre-gl';

export function waitForIdle(
  map: maplibregl.Map,
  timeoutMs = 2500
): Promise<boolean> {
  return new Promise((resolve) => {
    let finished = false;
    const finish = (didBecomeIdle: boolean) => {
      if (finished) return;
      finished = true;
      clearTimeout(timer);
      map.off('idle', handleIdle);
      resolve(didBecomeIdle);
    };
    const handleIdle = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);

    map.on('idle', handleIdle);
    map.triggerRepaint();
  });
}
