// Bump on any deploy that changes precached files or fetch behavior -- the
// activate handler below deletes every cache that doesn't match this name,
// so a bump is what actually forces offline users off stale app code
// (Codex review catch, 2026-08-20: this never bumped, so a fixed name plus
// cache-everything below could leave an offline user on old code
// indefinitely). No build step exists to automate this (Row is plain
// static per README) -- bump it by hand alongside a deploy that needs
// cache invalidation. That manual-bump ceiling is accepted, not solved
// here; automating it needs a real build step, which is a bigger change
// than this fix.
const CACHE = 'row-v2';
const OFFLINE = '/offline.html';
const PRECACHE = [OFFLINE, '/', '/index.html', '/main.html', '/gym.html', '/health.html', '/sync.js', '/topbar.js'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(PRECACHE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});

// Cross-origin (Supabase API calls) and this app's own /api/* serverless
// routes (some auth-sensitive: coach-read, stripe-webhook, subscribe-push)
// must never be cached -- the old handler cached every successful GET
// regardless of origin/path, meaning an authenticated API response could
// get served stale from Cache Storage later, even after sign-out on that
// device (Codex review catch, 2026-08-20). Only same-origin static assets
// go through the cache-then-network-fallback path now.
self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(e.request)
      .then(res => { const clone = res.clone(); caches.open(CACHE).then(c => c.put(e.request, clone)); return res; })
      .catch(() => caches.match(e.request).then(cached => cached || caches.match(OFFLINE)))
  );
});

self.addEventListener('push', e => {
  let data = { title: 'Row', body: 'New notification' };
  try { if (e.data) data = e.data.json(); } catch (_) {}
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body,
    icon: '/icons/icon-192.png',
    data: { url: data.url },
  }));
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || '/gym.html';
  e.waitUntil(clients.openWindow(url));
});
