/* global self, clients */
self.addEventListener('notificationclick', function (event) {
  const n = event.notification;
  const url = (n?.data && n.data.url) || n?.data?.FCM_MSG?.data?.url || '/';
  event.notification.close();
  event.waitUntil((async () => {
    const allClients = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    const same = allClients.find(c => c.url.includes(url));
    if (same) { same.focus(); return; }
    await clients.openWindow(url);
  })());
});
