const CACHE_NAME = 'budget-app-v10';  // ← Versão atualizada (importante!)

const STATIC_ASSETS = [
    '/',
    '/index.html',
    '/style.css',
    '/script.js',
    '/manifest.json',
    '/favicon.svg',
    '/icons/icon-192.png',
    '/icons/icon-512.png'
];

self.addEventListener('install', e => {
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
    );
    self.skipWaiting(); // Força ativação imediata
});

self.addEventListener('activate', e => {
    e.waitUntil(
        caches.keys().then(keys => Promise.all(
            keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
        ))
    );
    self.clients.claim(); // Controla todas as abas imediatamente
});

self.addEventListener('fetch', e => {
    e.respondWith(
        caches.match(e.request).then(res => {
            if (res) return res;
            return fetch(e.request).then(response => {
                if (!response || response.status !== 200 || response.type !== 'basic') {
                    return response;
                }
                const responseToCache = response.clone();
                caches.open(CACHE_NAME).then(cache => cache.put(e.request, responseToCache));
                return response;
            });
        }).catch(() => {
            return new Response('Você está offline. Os dados salvos ainda estão disponíveis.', { 
                status: 503, 
                statusText: 'Offline' 
            });
        })
    );
});
