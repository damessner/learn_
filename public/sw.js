// Cache name suffix is filled in at runtime in `activate` based on the
// current /api/version response. Until then we use a fallback name.
let ACTIVE_CACHE_NAME = "learn-cache-bootstrap-v1";
const OFFLINE_URL = "/offline.html";

const ASSETS_TO_CACHE = [
  "/",
  "/offline.html",
  "/favicon.ico",
  "/manifest.json",
  "/globals.css",
  "/icon-192.png",
  "/icon-512.png",
  "/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(ACTIVE_CACHE_NAME).then((cache) => {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  // Do NOT skipWaiting here — let the new SW wait until activated so
  // existing tabs don't get yanked into the new version mid-session.
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Fetch the current app version and adopt the new cache name.
      // If the version endpoint is unreachable, keep the bootstrap name
      // so the user keeps a working offline cache.
      try {
        const res = await fetch("/api/version");
        if (res.ok) {
          const data = await res.json();
          if (data && typeof data.version === "string") {
            ACTIVE_CACHE_NAME = `learn-cache-v-${data.version}`;
          }
        }
      } catch {
        // Offline or transient error — keep the bootstrap name.
      }

      // Delete any cache whose name does not match the active one.
      const names = await caches.keys();
      await Promise.all(
        names
          .filter((name) => name !== ACTIVE_CACHE_NAME)
          .map((name) => caches.delete(name))
      );

      await self.clients.claim();
    })()
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;

  const url = new URL(event.request.url);
  // Skip backend dynamic endpoints, dev hot reloads, and next configs
  if (
    url.pathname.startsWith("/api") ||
    url.pathname.startsWith("/_next") ||
    url.pathname.includes("webpack")
  ) {
    return;
  }

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request)
        .then((response) => {
          if (!response || response.status !== 200 || response.type !== "basic") {
            return response;
          }

          const responseToCache = response.clone();
          caches.open(ACTIVE_CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });

          return response;
        })
        .catch(() => {
          if (event.request.mode === "navigate") {
            return caches.match(OFFLINE_URL);
          }
        });
    })
  );
});
