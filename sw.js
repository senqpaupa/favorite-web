// Service worker: кэширует оболочку приложения, чтобы работало без интернета.
const CACHE = 'favorie-v2';
const ASSETS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/styles.css',
  './icons/icon.svg',
  './js/app.js',
  './js/db.js',
  './js/models.js',
  './js/util.js',
  './js/print.js',
  './js/sync.js',
  './js/views/orders.js',
  './js/views/order.js',
  './js/views/clients.js',
  './js/views/analytics.js',
  './js/views/settings.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Запросы к Supabase не кэшируем — всегда в сеть.
  if (url.pathname.includes('/rest/v1/')) return;
  if (e.request.method !== 'GET') return;
  // Cache-first для своих ассетов, иначе сеть с откатом в кэш.
  e.respondWith(
    caches.match(e.request).then((hit) => hit || fetch(e.request).then((res) => {
      const copy = res.clone();
      if (url.origin === location.origin) caches.open(CACHE).then((c) => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
