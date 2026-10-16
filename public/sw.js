// Service worker. One job for now: show a static "connection needed" page when
// a page cannot load because the device is offline. It stores that one page
// and nothing else, so no private data is ever kept on the device.
// Alerts (push) are added in Phase 9.

// Bump when offline.html changes so installed apps fetch the new copy.
const CACHE = "offline-v2";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(CACHE);
      // Bypass the HTTP cache so a new version of the page is always picked up.
      await cache.add(new Request(OFFLINE_URL, { cache: "reload" }));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      // Remove anything a previous version stored.
      for (const name of await caches.keys()) {
        if (name !== CACHE) await caches.delete(name);
      }
      // Start the network request while the worker boots, so pages are not slower.
      if (self.registration.navigationPreload) {
        await self.registration.navigationPreload.enable();
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener("fetch", (event) => {
  // Only page loads. Data, images and scripts go straight to the network.
  if (event.request.mode !== "navigate") return;
  event.respondWith(
    (async () => {
      try {
        return (await event.preloadResponse) || (await fetch(event.request));
      } catch {
        // fetch only throws when there is no network; server errors pass through.
        return (await caches.match(OFFLINE_URL, { cacheName: CACHE })) ?? Response.error();
      }
    })(),
  );
});
