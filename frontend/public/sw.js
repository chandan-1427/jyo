// Jyo's service worker: shows push notifications and opens the app when one
// is tapped. It has no fetch handler on purpose: a worker that caches pages
// can keep serving an old version of the app after a deploy.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Jyo", {
      body: data.body || "",
      icon: "/icons-192.png",
      badge: "/icons-192.png",
      data: { url: data.url || "/feed" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  // Only ever a page of Jyo's own.
  let url = new URL(event.notification.data?.url || "/feed", self.location.origin);
  if (url.origin !== self.location.origin) url = new URL("/feed", self.location.origin);

  event.waitUntil(
    (async () => {
      const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      const open = windows.find((w) => new URL(w.url).origin === self.location.origin);
      if (open) {
        await open.focus();
        if ("navigate" in open) await open.navigate(url.href);
        return;
      }
      await self.clients.openWindow(url.href);
    })()
  );
});
