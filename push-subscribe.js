// push-subscribe.js — requests Notification permission once and subscribes
// to push on first visit after this ships. Safe to include on every page;
// no-ops if already subscribed or permission already denied.
(function () {
  const VAPID_PUBLIC_KEY = 'BHT84JUXPijgu58Wk3yNosqUZQXWEV2C7X-H3doe-YKK9TUQJdR-A0Z_WzwOG-Z1BQUyzh0lCxwRdrgp4LEFGfI';

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = atob(base64);
    return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)));
  }

  async function subscribeToPush() {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (Notification.permission === 'denied') return;
    if (localStorage.getItem('row_push_subscribed')) return;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    const reg = await navigator.serviceWorker.ready;
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });

    const token = window.RowAuth ? await window.RowAuth.getAccessToken() : null;
    if (!token) return; // not signed in yet -- retry on next page load's subscribeToPush() call

    const res = await fetch('/api/subscribe-push', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
      body: JSON.stringify(sub.toJSON()),
    });
    if (!res.ok) return; // leave row_push_subscribed unset so the next load retries

    localStorage.setItem('row_push_subscribed', '1');
  }

  document.addEventListener('DOMContentLoaded', () => {
    setTimeout(subscribeToPush, 3000); // don't compete with page-load-critical work
  });
})();
