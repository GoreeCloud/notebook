const PREFIX = "goreecloud-notebook-shell-";
const CACHE = PREFIX + "v6";
const ASSETS = ["./", "./index.html", "./manifest.webmanifest", "./assets/gc-ui-foundations.v1.css", "./assets/styles.css", "./assets/icon.svg", "./src/app.js", "./src/formatting.js", "./src/model.js", "./src/storage.js", "./src/backup.js"];
const ALLOWED = new Set(ASSETS.map(path => new URL(path, self.registration.scope).href));

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys =>
    Promise.all(keys.filter(key => key.startsWith(PREFIX) && key !== CACHE).map(key => caches.delete(key)))
  ).then(() => self.clients.claim()));
});

// Network-first avoids a permanently stale editor while retaining reliable offline shell use.
// Never cache arbitrary same-origin requests; future private APIs must stay out of shell caches.
self.addEventListener("fetch", event => {
  const request = event.request;
  if (request.method !== "GET" || new URL(request.url).origin !== self.location.origin) return;
  const allowed = ALLOWED.has(request.url);
  const navigation = request.mode === "navigate";
  if (!allowed && !navigation) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    try {
      const response = await fetch(request);
      if (response.ok && allowed) await cache.put(request, response.clone()).catch(() => {});
      return response;
    } catch {
      const exact = await cache.match(request);
      if (exact) return exact;
      if (navigation) {
        const fallback = await cache.match("./index.html");
        if (fallback) return fallback;
      }
      return Response.error();
    }
  })());
});
