// Cliniolab service worker.
// Responsibilities: (1) cache the app shell + static assets (CSS/JS/fonts/
// icons) so the site never renders unstyled or breaks offline or on flaky
// connections, (2) offline fallback for page navigations, (3) push
// notification display.

const CACHE_VERSION = 'v2';
const SHELL_CACHE = `cliniolab-shell-${CACHE_VERSION}`;
const STATIC_CACHE = `cliniolab-static-${CACHE_VERSION}`;
const OFFLINE_URL = '/';

const CURRENT_CACHES = [SHELL_CACHE, STATIC_CACHE];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => !CURRENT_CACHES.includes(key)).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

// Static build assets - Next.js content-hashes these filenames, so once a
// given URL is cached it can never go stale under a different deploy; safe
// to serve cache-first and only hit the network on a cache miss.
function isStaticAsset(url) {
  return (
    url.origin === self.location.origin &&
    (url.pathname.startsWith('/_next/static/') ||
      url.pathname.startsWith('/_next/image') ||
      /\.(css|js|woff2?|ttf|otf|png|jpg|jpeg|svg|webp|ico)$/.test(url.pathname))
  );
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);

  // Never cache API/data requests - quiz/exam content, auth state, etc.
  // must always be fresh and must never be served stale from cache.
  if (url.pathname.startsWith('/api/')) return;

  // Page navigations: network-first so users always get the latest page
  // when online, falling back to the cached shell when offline. Also
  // opportunistically updates the shell cache on every successful load.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone();
          caches.open(SHELL_CACHE).then((cache) => cache.put(OFFLINE_URL, copy));
          return response;
        })
        .catch(() => caches.match(request).then((cached) => cached || caches.match(OFFLINE_URL)))
    );
    return;
  }

  // Static assets (CSS, JS chunks, fonts, icons): cache-first, so the app
  // is fully styled and functional offline and on slow/flaky connections,
  // not just able to load a bare HTML shell.
  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
      })
    );
  }
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
