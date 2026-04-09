const CACHE_NAME = 'budget-app-v1';
const ASSETS = [
  '/or-amento/',
  '/or-amento/index.html',
  '/or-amento/style.css',
  '/or-amento/script.js',
  '/or-amento/manifest.json'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)).catch(() => {}));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', e => {
  e.respondWith(caches.match(e.request).then(res => res || fetch(e.request).catch(() => {})));
});
