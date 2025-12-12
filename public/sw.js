const CACHE = 'constrivia-cache-v1';

// Tu trzymasz tylko rzeczy, które NA PEWNO istnieją w dist/
const PRECACHE_URLS = [
  '/',
  '/index.html',
  '/style.css',
  '/manifest.webmanifest',
  '/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
      .catch((err) => {
        // Nie pozwalamy, żeby install się wywalił i uwalił cały SW
        console.error('SW install error', err);
      })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== CACHE)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
      .catch((err) => {
        console.error('SW activate error', err);
      })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  const url = new URL(event.request.url);
  
  if (url.origin !== self.location.origin) return;

  // Nie ruszamy POST/PUT itd.
  if (req.method !== 'GET') {
    return;
  }

  // 1) NAWIGACJA (czyli F5, wpisanie URL, kliknięcie linku)
  // Strategia: network-first, fallback do cache tylko jak sieć padnie.
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .catch(() => caches.match('/index.html'))
    );
    return;
  }

  // 2) Inne zasoby (JS, CSS, ikony) – cache-first z fallbackiem do sieci
  event.respondWith(
    caches.match(req).then((cached) => {
      if (cached) return cached;
      return fetch(req);
    })
  );
});
