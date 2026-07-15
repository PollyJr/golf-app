const CACHE = "fairway-public-v2";
const PUBLIC_ASSETS = ["/", "/icon.svg", "/manifest.webmanifest", "/logo.svg", "/logo-mark.svg"];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PUBLIC_ASSETS)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith("/api/") || url.pathname.startsWith("/app") || url.pathname.startsWith("/admin") || url.pathname.startsWith("/platform")) return;
  if (!PUBLIC_ASSETS.includes(url.pathname) && !url.pathname.startsWith("/_next/static/") && !url.pathname.startsWith("/icons/")) return;

  event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request).then((response) => {
    if (response.ok && response.type === "basic") caches.open(CACHE).then((cache) => cache.put(event.request, response.clone()));
    return response;
  })));
});
