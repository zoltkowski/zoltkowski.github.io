/* sw.js */
const CACHE_VERSION = "v4"; // podbij przy zmianach SW
const CACHE_STATIC = `constrivia-static-${CACHE_VERSION}`;
const CACHE_HTML = `constrivia-html-${CACHE_VERSION}`;

const PRECACHE_URLS = [
  "/",                 // opcjonalnie
  "/index.html",
  "/manifest.webmanifest",
  "/icon.svg",
  "/style.css",        // jeśli faktycznie istnieje jako stały plik
];

// Helper: best-effort precache (żeby 1 brakujący plik nie psuł instalacji)
async function precacheBestEffort(cache, urls) {
  await Promise.allSettled(
    urls.map(async (u) => {
      try {
        const req = new Request(u, { cache: "reload" });
        const res = await fetch(req);
        if (res.ok) await cache.put(req, res);
      } catch (_) {
        // ignorujemy pojedyncze błędy
      }
    })
  );
}

// Helper: stale-while-revalidate
async function staleWhileRevalidate(req, cacheName) {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(req);

  const fetchPromise = (async () => {
    try {
      const res = await fetch(req);
      // cache tylko sensowne odpowiedzi
      if (res && res.ok) await cache.put(req, res.clone());
      return res;
    } catch (e) {
      return null;
    }
  })();

  // zwróć szybko cache, a w tle odśwież
  return cached || (await fetchPromise) || new Response("", { status: 504 });
}

// Helper: network-first (dla HTML)
async function networkFirst(req, cacheName, fallbackUrl = "/index.html") {
  const cache = await caches.open(cacheName);

  try {
    const res = await fetch(req);
    if (res && res.ok) {
      await cache.put(req, res.clone());
      return res;
    }
  } catch (_) {
    // przechodzimy do cache
  }

  const cached = await cache.match(req);
  if (cached) return cached;

  // fallback do app-shell (SPA offline)
  const fallback = await cache.match(fallbackUrl);
  return fallback || new Response("", { status: 504 });
}

self.addEventListener("install", (event) => {
  event.waitUntil((async () => {
    try {
      const cacheStatic = await caches.open(CACHE_STATIC);
      const cacheHtml = await caches.open(CACHE_HTML);

      // Precache – best effort
      await precacheBestEffort(cacheStatic, PRECACHE_URLS);
      // Dodatkowo trzymaj index.html też w HTML cache
      await precacheBestEffort(cacheHtml, ["/index.html"]);
    } finally {
      // nie blokuj update’ów
      await self.skipWaiting();
    }
  })());
});

self.addEventListener("activate", (event) => {
  event.waitUntil((async () => {
    // usuń stare cache
    const keys = await caches.keys();
    await Promise.all(
      keys
        .filter((k) => k.startsWith("constrivia-") && ![CACHE_STATIC, CACHE_HTML].includes(k))
        .map((k) => caches.delete(k))
    );

    await self.clients.claim();

    // Opcjonalnie: poinformuj klienta, że jest nowy SW (app może wtedy zrobić reload)
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of clients) {
      client.postMessage({ type: "SW_ACTIVATED", version: CACHE_VERSION });
    }
  })());
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  const url = new URL(req.url);

  // 1) Nie dotykaj cross-origin (analytics, CDN-y, itp.)
  if (url.origin !== self.location.origin) return;

  // 2) Tylko GET
  if (req.method !== "GET") return;

  // 3) Nie baw się w cache dla Range (audio/video, itp.)
  if (req.headers.has("range")) return;

  // 4) HTML / nawigacje: network-first (kluczowe na “biały ekran po update”)
  const acceptsHtml = (req.headers.get("accept") || "").includes("text/html");
  if (req.mode === "navigate" || acceptsHtml || url.pathname === "/index.html") {
    event.respondWith(networkFirst(req, CACHE_HTML, "/index.html"));
    return;
  }

  // 5) Reszta (JS/CSS/SVG/PNG/WEBMANIFEST…): stale-while-revalidate
  event.respondWith(staleWhileRevalidate(req, CACHE_STATIC));
});
