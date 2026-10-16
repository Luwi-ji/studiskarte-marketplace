// Service worker. Two jobs:
// 1. Show a static "connection needed" page when a page cannot load because the
//    device is offline. It stores that one page and nothing else, so no private
//    data is ever kept on the device.
// 2. Show device alerts (Web Push) and open the right page when one is tapped.
//    An alert carries only a headline and the post's title, never message text.

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

// An alert from the server: { title, body, url, tag }. Showing a notification is
// required for every push (iPhone cancels alerts for apps that skip it).
self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  const title = typeof data.title === "string" && data.title ? data.title : "Studiskarte";
  const tag = typeof data.tag === "string" && data.tag ? data.tag : undefined;
  event.waitUntil(
    self.registration.showNotification(title, {
      body: typeof data.body === "string" ? data.body : "",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag,
      // A newer alert about the same thing replaces the older one and still alerts.
      renotify: Boolean(tag),
      data: { url: pathOnly(data.url) },
    }),
  );
});

// Only a path on this site: an alert can never send the app somewhere else.
function pathOnly(value) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//") ? value : "/";
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = pathOnly(event.notification.data && event.notification.data.url);
  event.waitUntil(
    (async () => {
      const open = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of open) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) await client.navigate(url).catch(() => {});
          return;
        }
      }
      await self.clients.openWindow(url);
    })(),
  );
});
