// Service Worker for Offline Route and Transit Data
const CACHE_NAME = 'scz-micros-v2';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/favicon.ico',
  '/data/rutas_micro_scz.geojson',
  '/data/calles_scz.geojson',
  '/data/lugares_scz.json',
  '/data/categoria_lugares.json',
  '/maplibre-gl-worker.mjs'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[ServiceWorker] Pre-caching static assets & offline transit data');
      return cache.addAll(STATIC_ASSETS).catch((err) => {
        console.warn('[ServiceWorker] Could not pre-cache some assets:', err);
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[ServiceWorker] Removing old cache', key);
            return caches.delete(key);
          }
        })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Don't intercept cross-origin requests (external API, Google OAuth, tiles), API calls, or non-GET requests
  if (
    requestUrl.origin !== self.location.origin ||
    event.request.method !== 'GET' ||
    requestUrl.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Cache-first strategy for transit data files and local worker
  if (
    requestUrl.pathname.startsWith('/data/') ||
    requestUrl.pathname.endsWith('.geojson') ||
    requestUrl.pathname.endsWith('.json') ||
    requestUrl.pathname === '/maplibre-gl-worker.mjs'
  ) {
    event.respondWith(
      caches.match(event.request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(event.request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Stale-while-revalidate for application bundle and assets
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      const fetchPromise = fetch(event.request)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const clone = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});
