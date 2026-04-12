const CACHE_NAME = 'remote-control-v1';
const ASSETS = [
    './',
    './index.htm',
    './manifest.json',
    './css/style.css',
    './js/app.js',
    './js/connection.js',
    './js/timer.js',
    './js/modes.js',
    './js/storage.js',
    './icons/icon.svg',
];

self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME)
            .then((cache) => cache.addAll(ASSETS))
            .then(() => self.skipWaiting())
    );
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) =>
            Promise.all(
                keys
                    .filter((key) => key !== CACHE_NAME)
                    .map((key) => caches.delete(key))
            )
        ).then(() => self.clients.claim())
    );
});

self.addEventListener('fetch', (event) => {
    event.respondWith(
        caches.match(event.request).then((cached) => {
            return cached || fetch(event.request).then((response) => {
                // Only cache same-origin GET requests
                if (event.request.method === 'GET' && response.status === 200 && response.type === 'basic') {
                    const clone = response.clone();
                    caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
                }
                return response;
            });
        }).catch(() => {
            // Offline fallback
            if (event.request.mode === 'navigate') {
                return caches.match('./index.htm');
            }
        })
    );
});
