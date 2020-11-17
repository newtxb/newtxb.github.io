/* eslint-disable no-undef, no-restricted-globals */

const PRECACHE = 'precache-v1';

const PRECACHE_URLS = [
  'index.html',
  './',
  'assets/main.css',
  'assets/main.js',
  'assets/favicon.png',
].map(url => new Request(url, { cache: 'no-cache' }));

// Clear everything we have, cache again, and we are ready!
self.addEventListener('message', async (event) => {
  if (event.data && event.data.action === 'CLEAR_CACHE') {
    const precache = await caches.open(PRECACHE);
    await precache.addAll(PRECACHE_URLS);
    const clients = await self.clients.matchAll();
    clients.forEach(client => client.postMessage({ action: 'CACHE_CLEARED' }));
  }
});

// The install handler takes care of precaching the resources we always need
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(self.skipWaiting()),
  );
});

// The activate handler takes care of cleaning up old caches if any
self.addEventListener('activate', (event) => {
  const currentCaches = [PRECACHE];
  event.waitUntil(
    caches.keys()
      .then(cacheNames => cacheNames.filter(cacheName => !currentCaches.includes(cacheName)))
      .then(cachesToDelete => Promise.all(
        cachesToDelete.map(cacheToDelete => caches.delete(cacheToDelete)),
      ))
      .then(() => self.clients.claim()),
  );
});

// Serve from cache if we have it, otherwise go live
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests, like those for Google Analytics
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => cachedResponse || fetch(event.request)),
    );
  }
});
