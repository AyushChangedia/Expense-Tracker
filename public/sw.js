/**
 * FluxFin service worker.
 *
 * Deliberately conservative about what it caches. This is a finance app behind
 * a login, so HTML responses are never stored — a cached page could show one
 * person's balances to whoever opens the app next on a shared device, and a
 * stale dashboard is worse than no dashboard.
 *
 * Strategy:
 *   - Navigations      -> network only, falling back to a static offline page.
 *   - Build assets     -> cache first (immutable, content-hashed by Next.js).
 *   - Icons / manifest -> stale-while-revalidate.
 *   - Everything else  -> straight to the network.
 */

const VERSION = "fluxfin-v1";
const STATIC_CACHE = `${VERSION}-static`;
const OFFLINE_URL = "/offline.html";

const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      // A single missing file must not fail the whole install, so each entry
      // is added independently.
      .then((cache) =>
        Promise.allSettled(PRECACHE.map((url) => cache.add(new Request(url, { cache: "reload" })))),
      )
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "SKIP_WAITING") self.skipWaiting();
});

function isBuildAsset(url) {
  return url.pathname.startsWith("/_next/static/");
}

function isIconOrManifest(url) {
  return (
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest" ||
    url.pathname === "/favicon.ico" ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".svg")
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.method !== "GET") return;

  const url = new URL(request.url);

  // Never touch other origins, the auth endpoints, or any API response.
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  // --- Navigations: network only, offline page as the fallback -------------
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(STATIC_CACHE);
        const offline = await cache.match(OFFLINE_URL);
        return (
          offline ??
          new Response("You are offline.", {
            status: 503,
            headers: { "Content-Type": "text/plain" },
          })
        );
      }),
    );
    return;
  }

  // --- Build assets: cache first (content-hashed, safe to keep) ------------
  if (isBuildAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ??
          fetch(request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          }),
      ),
    );
    return;
  }

  // --- Icons and manifest: stale-while-revalidate --------------------------
  if (isIconOrManifest(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }

  // Anything else falls through to the network untouched.
});
