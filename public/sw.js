const CACHE = "mission-supply-v2";
const STATIC_ASSETS = [
  "/icon-192.svg",
  "/icon-512.svg",
  "/icon-192-maskable.svg",
  "/icon-512-maskable.svg",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(STATIC_ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;

  if (request.mode === "websocket") return;

  const url = new URL(request.url);

  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/api/")) return;

  if (STATIC_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached ?? fetch(request)),
    );
    return;
  }

  if (
    request.mode === "navigate" ||
    (request.headers.get("Accept")?.includes("text/html") &&
      !url.pathname.startsWith("/api/"))
  ) {
    event.respondWith(
      fetch(request).catch(() => caches.match("/")),
    );
    return;
  }

  event.respondWith(
    fetch(request).catch(() => caches.match(request)),
  );
});

self.addEventListener("push", (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    event.waitUntil(
      self.registration.showNotification(data.title ?? "Mission Supply", {
        body: data.body ?? "",
        icon: data.icon ?? "/icon-192.svg",
        badge: data.badge ?? "/icon-192.svg",
        vibrate: [100, 50, 100],
        data: { url: data.url ?? "/" },
      }),
    );
  } catch {
    event.waitUntil(
      self.registration.showNotification("Mission Supply", {
        body: event.data.text(),
      }),
    );
  }
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url ?? "/";
  event.waitUntil(
    clients.matchAll({ type: "window" }).then((windowClients) => {
      const existing = windowClients.find((c) => c.url === url);
      if (existing) {
        existing.focus();
      } else {
        clients.openWindow(url);
      }
    }),
  );
});
