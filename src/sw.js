/* WorkerTink custom service worker: precache + Web Push. */
import {precacheAndRoute, cleanupOutdatedCaches} from 'workbox-precaching';

precacheAndRoute(self.__WB_MANIFEST || []);
cleanupOutdatedCaches();

self.addEventListener('push', event => {
  let payload = {title:'WorkerTink', body:'Новое уведомление', url:'./'};
  try { if (event.data) payload = {...payload, ...event.data.json()}; } catch {}
  event.waitUntil(self.registration.showNotification(payload.title || 'WorkerTink', {
    body: payload.body || '',
    icon: './icon-192.png',
    badge: './icon-192.png',
    tag: payload.tag || undefined,
    renotify: true,
    data: {url: payload.url || './'}
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL(event.notification.data?.url || './', self.location.href).href;
  event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(clients => {
    const same = clients.find(client => client.url.startsWith(self.location.origin));
    if (same) { same.focus(); try { same.navigate(target); } catch {} return; }
    return self.clients.openWindow(target);
  }));
});
