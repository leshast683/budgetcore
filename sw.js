const CACHE = 'budgetcore-v9';
const STATIC = [
  '/',
  '/index.html',
  '/app.html',
  '/goals.html',
  '/profile.html',
  '/analytics.html',
  '/style.css',
  '/favicon.png',
  '/budgetly.png',
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(STATIC)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  if (e.request.url.includes('firestore') || e.request.url.includes('firebase')) return;

  // Network-first: always prefer the latest deployed files. Falls back to
  // cache only when offline, so redeploys are visible immediately instead
  // of being masked by a stale cached response.
  e.respondWith(
    fetch(e.request).then(res => {
      if (res.ok) {
        const clone = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, clone));
      }
      return res;
    }).catch(() => caches.match(e.request))
  );
});
