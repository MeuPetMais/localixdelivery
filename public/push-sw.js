/* Localix Web Push Service Worker.
 * Escopo: /push/ — separado do kill-switch em /sw.js.
 * Recebe eventos `push` e renderiza notificações nativas.
 * Payload esperado (JSON): { title, body, tag, url, icon, badge, data }
 */

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { title: "Localix", body: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Localix";
  const options = {
    body: payload.body || "",
    tag: payload.tag || undefined,
    renotify: !!payload.tag,
    icon: payload.icon || "/icon-192.png",
    badge: payload.badge || "/icon-192.png",
    data: { url: payload.url || "/", ...(payload.data || {}) },
    vibrate: [120, 60, 120],
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
      for (const client of all) {
        if ("focus" in client) {
          try {
            await client.focus();
            if ("navigate" in client) await client.navigate(url);
            return;
          } catch {}
        }
      }
      if (self.clients.openWindow) await self.clients.openWindow(url);
    })(),
  );
});
