/*
 * Fairway service worker.
 *
 * Its job is small on purpose: make the app installable, keep the static
 * shell (hashed JS/CSS, icons) available without a network round trip, and
 * show a friendly page instead of the browser's error when a navigation
 * fails offline.
 *
 * It never stores pages or API responses: everything behind a sign-in is
 * personal and must come from the server. Scores entered while offline are
 * queued by the scorecard itself, not here.
 */

// Bump when the caching rules below change. Static files are content-hashed,
// so a new deploy does not need a new version.
const VERSION = "v3";
const CACHE = `fairway-static-${VERSION}`;
const OFFLINE_URL = "/offline";
const PRECACHE = [
  OFFLINE_URL,
  "/icons/icon.svg",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];
const MAX_ENTRIES = 160;

/** The scripts and styles a page needs, read from its HTML. */
function staticAssetsOf(html) {
  const matches = html.match(/\/_next\/static\/[^"'\\)\s<>]+/g) || [];
  return [...new Set(matches)];
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // One missing file must not prevent installation.
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
      // The offline page is only useful with its styles, so store those too.
      const offline = await cache.match(OFFLINE_URL);
      if (offline) {
        const assets = staticAssetsOf(await offline.clone().text());
        await Promise.all(assets.map((url) => cache.add(url).catch(() => undefined)));
      }
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      await Promise.all(names.filter((name) => name !== CACHE).map((name) => caches.delete(name)));
      await self.clients.claim();
    })(),
  );
});

/** Keeps the cache from growing without bound across many deploys. */
async function trim(cache) {
  const keys = await cache.keys();
  const excess = keys.length - MAX_ENTRIES;
  if (excess <= 0) return;
  const protectedUrls = new Set(PRECACHE.map((url) => new URL(url, self.location.origin).href));
  let removed = 0;
  for (const request of keys) {
    if (removed >= excess) break;
    if (protectedUrls.has(request.url)) continue;
    await cache.delete(request);
    removed += 1;
  }
}

/** Immutable files: answer from the cache, fetch and remember on a miss. */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok && response.type === "basic") {
    await cache.put(request, response.clone());
    void trim(cache);
  }
  return response;
}

/** Pages: always from the network; the offline page when there is none. */
async function navigate(request) {
  try {
    return await fetch(request);
  } catch (error) {
    const cache = await caches.open(CACHE);
    const offline = await cache.match(OFFLINE_URL);
    if (offline) return offline;
    throw error;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  // Data, streams and anything personal go straight to the network.
  if (url.pathname.startsWith("/api/")) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request));
    return;
  }
  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
  }
});
