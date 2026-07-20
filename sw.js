const CACHE = 'row-v1';
const OFFLINE = '/offline.html';
const PRECACHE = [OFFLINE, '/', '/index.html', '/main.html', '/gym.html', '/health.html', '/finance.html', '/sync.js', '/topbar.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); return res; })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match(OFFLINE)))
  );
});

self.addEventListener('push', e => {
  let data = { title: 'Row', body: 'New notification' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, { body: data.body, icon: '/icons/icon-192.png' }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.openWindow('/gym.html'));
});
