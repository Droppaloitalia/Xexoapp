// --- XexoApp Service Worker ---
// BUMPA la versione ogni volta che cambi index/css/js per forzare l'update cache
const CACHE = "xexoapp-v6";

// Asset "core" da avere anche offline
const ASSETS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./xexo-logo.png",
  "./header-banner.jpg",          // se non esiste, nessun problema
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/icon-180.png"
];

// Precache di base
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

// Pulizia cache vecchie
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Strategia:
// - Navigazioni (pagine): network-first → fallback cache (index.html) se offline
// - Altri GET (immagini, icone, ecc.): stale-while-revalidate
self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  const isSameOrigin = url.origin === self.location.origin;

  // Pagine / navigazioni
  if (req.mode === "navigate") {
    event.respondWith(networkFirst(req, "./index.html"));
    return;
  }

  // Altre risorse statiche del tuo dominio
  if (isSameOrigin) {
    event.respondWith(staleWhileRevalidate(req));
  }
});

// Helpers
async function networkFirst(request, fallbackUrl) {
  try {
    const fresh = await fetch(request);
    // Salva in cache solo se ok
    if (fresh && fresh.status === 200) {
      const cache = await caches.open(CACHE);
      cache.put(request, fresh.clone());
    }
    return fresh;
  } catch (err) {
    // Offline → prova dalla cache; per le navigazioni, torna index.html
    const cached = await caches.match(request);
    if (cached) return cached;
    if (fallbackUrl) {
      const fallback = await caches.match(fallbackUrl);
      if (fallback) return fallback;
    }
    // come ultima spiaggia
    return new Response("Offline", { status: 503, statusText: "Offline" });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);

  const networkPromise = fetch(request).then((response) => {
    // Salva risposte 200 dello stesso dominio
    if (response && response.status === 200) {
      cache.put(request, response.clone());
    }
    return response;
  }).catch(() => cached);

  return cached || networkPromise;
}
