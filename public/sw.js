// Service worker: recebe as notificações (Web Push) e abre o app no item certo ao tocar.
self.addEventListener("push", (event) => {
  let data = { title: "Cabeça Leve", body: "", url: "/" };
  try { data = { ...data, ...event.data.json() }; } catch {}
  event.waitUntil(self.registration.showNotification(data.title, { body: data.body, data: { url: data.url }, icon: "/icon.svg", badge: "/icon.svg" }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = new URL(event.notification.data?.url || "/", self.location.origin).href;
  event.waitUntil((async () => {
    const tabs = await clients.matchAll({ type: "window", includeUncontrolled: true });
    const open = tabs.find((t) => t.url.startsWith(self.location.origin));
    if (open) { await open.focus(); return open.navigate(url); }
    return clients.openWindow(url);
  })());
});
