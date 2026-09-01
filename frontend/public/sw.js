/* Collabora Hub visitor SW — push + light offline shell cache */
const SHELL_CACHE = "collabora-shell-v3";
const SHELL_URLS = ["/", "/m", "/collabora-icon.svg", "/manifest.webmanifest"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(SHELL_CACHE)
      .then((cache) => cache.addAll(SHELL_URLS).catch(() => undefined))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("collabora-shell-") && k !== SHELL_CACHE)
            .map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname === "/sw.js") return;
  // Never cache API
  if (url.pathname.startsWith("/api") || url.pathname.includes("/mobile/")) {
    return;
  }
  // Network-first for navigations / HTML; cache fallback when offline
  if (req.mode === "navigate" || req.destination === "document") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
          return res;
        })
        .catch(() =>
          caches.match(req).then((cached) => cached || caches.match("/m"))
        )
    );
    return;
  }
  // Cache-first for static icons/manifest
  if (
    url.pathname.endsWith(".svg") ||
    url.pathname.endsWith(".webmanifest") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".ico")
  ) {
    event.respondWith(
      caches.match(req).then(
        (cached) =>
          cached ||
          fetch(req).then((res) => {
            const copy = res.clone();
            caches.open(SHELL_CACHE).then((c) => c.put(req, copy));
            return res;
          })
      )
    );
  }
});

self.addEventListener("push", (event) => {
  let data = {
    title: "Collabora Hub",
    body: "Nouvelle notification",
    tag: "collabora",
    url: "/m",
  };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    try {
      data.body = event.data ? event.data.text() : data.body;
    } catch {
      /* ignore */
    }
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Collabora Hub", {
      body: data.body || "",
      tag: data.tag || "collabora",
      data: { url: data.url || "/m" },
      icon: "/collabora-icon.svg",
      badge: "/collabora-icon.svg",
      vibrate: data.vibrate ||
        (String(data.tag || "").startsWith("session-end")
          ? [200, 80, 200, 80, 400]
          : [120, 60, 120]),
      requireInteraction:
        data.requireInteraction ||
        String(data.tag || "").startsWith("session-end"),
      silent: false,
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/m";
  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        for (const client of clients) {
          if ("focus" in client) {
            client.navigate?.(url);
            return client.focus();
          }
        }
        if (self.clients.openWindow) return self.clients.openWindow(url);
      })
  );
});
