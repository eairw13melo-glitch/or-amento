const CACHE_NAME = 'budget-app-v2';
const STATIC_ASSETS = [
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/favicon.svg'
];

self.addEventListener('install', e => {
    e.waitUntil(caches.open(CACHE_NAME).then(cache => {
        return cache.addAll(STATIC_ASSETS.map(asset => new Request(asset, { mode: 'no-cors' })));
    }).catch(() => {}));
});

self.addEventListener('activate', e => {
    e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))));
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(res => res || fetch(e.request).catch(() => new Response('Offline - Orçamento Familiar', { status: 503, statusText: 'Offline' })))
    );
});
