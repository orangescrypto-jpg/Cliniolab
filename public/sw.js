// Cliniolab service worker.
// Two responsibilities: (1) a minimal cache so the app is installable and
// has a basic offline fallback, (2) push notification display.

const CACHE_NAME = 'cliniolab-v1';
const OFFLINE_URL = '/';

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Network-first for navigation requests, falling back to cache when offline.
// Deliberately not caching API responses - quiz/exam data must stay fresh
// and never be served stale from cache.
self.addEventListener('fetch', (event) => {
  if (event.request.mode !== 'navigate') return;

  event.respondWith(
    fetch(event.request).catch(() =>
      caches.match(OFFLINE_URL).then((cached) => cached || Response.error())
    )
  );
});

// Push notifications (e.g. comment replies, quiz result follow-ups).
// The push payload is expected to be JSON: { title, body, url }.
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload = { title: 'Cliniolab', body: 'You have a new notification.', url: '/' };
  try {
    payload = { ...payload, ...event.data.json() };
  } catch {
    payload.body = event.data.text();
  }

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: '/icon-192.png',
      badge: '/icon-192.png',
      data: { url: payload.url },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const url = event.notification.data?.url || '/';
  event.waitUntil(self.clients.openWindow(url));
});
