const CACHE_NAME = 'budget-app-v11';

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/favicon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
    // IMAGENS DE FUNDO MENSAIS (cache imediato)
    '/images/janeiro.jpg',
    '/images/fevereiro.jpg',
    '/images/marco.jpg',
    '/images/abril.jpg',
    '/images/maio.jpg',
    '/images/junho.jpg',
    '/images/julho.jpg',
    '/images/agosto.jpg',
    '/images/setembro.jpg',
    '/images/outubro.jpg',
    '/images/novembro.jpg',
    '/images/dezembro.jpg'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting();
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(res => {
            if (res) return res;
            return fetch(e.request).then(response => {
                if (!response || response.status !== 200) return response;
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseToCache));
                return response;
            });
        }).catch(() => new Response('Offline', { status: 503 }))
    );
});
