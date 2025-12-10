const CACHE = 'geometry-cache-v25121013';

const PRECACHE_URLS = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './icon.svg',
  './dist/main.js'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(PRECACHE_URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Allow the page to trigger immediate activation
self.addEventListener('message', (event) => {
  if (!event.data) return;
  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', (event) => {
  event.respondWith(handleRequest(event.request));
});

async function handleRequest(request) {
  const url = new URL(request.url);

  // Navigation fallback to index.html for SPA behavior
  if (request.mode === 'navigate') {
    const cachedIndex = await caches.match('./index.html');
    if (cachedIndex) return cachedIndex;
    return fetch(request);
  }

  if (url.pathname === '/favicon.ico' || url.pathname.endsWith('/favicon.ico')) {
    const icon = await caches.match('./icon.svg');
    if (icon) return icon;
  }

  const cached = await caches.match(request);
  if (cached) return cached;
  try {
    const response = await fetch(request);
    return response;
  } catch (e) {
    return new Response('Network error', { status: 408 });
  }
}
