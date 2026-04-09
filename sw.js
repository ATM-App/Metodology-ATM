const CACHE_NAME = 'adn-keeper-v1';

// Omitimos cacheo estricto para que Firebase trabaje siempre en tiempo real
self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    // Para no entorpecer Firebase, respondemos con la red directamente
    event.respondWith(fetch(event.request).catch(() => caches.match(event.request)));
});