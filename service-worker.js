/* eslint-disable no-undef, no-restricted-globals */

const PRECACHE = 'precache-v1';

const PRECACHE_URLS = [
  'index.html',
  './',
  'assets/main.css',
  'assets/main.js',
];

self.addEventListener('message', async (event) => {
  if (event.data && event.data.action === 'CLEAR_CACHE') {
    await (await caches.open(PRECACHE)).addAll(PRECACHE_URLS);
    (await self.clients.matchAll())
      .forEach(client => client.postMessage({ action: 'CACHE_CLEARED' }));
  }
});

// The following come from here (but I removed runtime cache):
// https://googlechrome.github.io/samples/service-worker/basic/

// The install handler takes care of precaching the resources we always need.
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(self.skipWaiting()),
  );
});

// The activate handler takes care of cleaning up old caches.
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

// The fetch handler serves responses for same-origin resources from a cache.
// If no response is found, it populates the runtime cache with the response
// from the network before returning it to the page.
self.addEventListener('fetch', (event) => {
  // Skip cross-origin requests, like those for Google Analytics.
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => cachedResponse || fetch(event.request)),
    );
  }
});
