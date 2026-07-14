/* eslint-disable no-undef, no-restricted-globals */

const PRECACHE = 'precache-v1';
const UNSPLASH_CACHE = 'unsplash-daily-v1';

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

  if (event.data && event.data.action === 'CACHE_UNSPLASH_IMAGE') {
    const url = event.data.url;
    if (!url) return;
    const cache = await caches.open(UNSPLASH_CACHE);
    // Evict all previous entries before caching the new one
    const oldKeys = await cache.keys();
    await Promise.all(oldKeys.map(req => req.url !== url && cache.delete(req)));
    // Only fetch and cache if not already present
    const existing = await cache.match(url);
    if (!existing) {
      try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit' });
        if (response.ok) await cache.put(url, response);
      } catch (e) {
        // Network unavailable — skip caching
      }
    }
  }
});

// The install handler takes care of precaching the resources we always need
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(PRECACHE)
      .then(cache => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting()),
  );
});

// The activate handler takes care of cleaning up old caches if any
self.addEventListener('activate', (event) => {
  const currentCaches = [PRECACHE, UNSPLASH_CACHE];
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
  // Serve cached Unsplash images directly, avoiding a network round-trip
  if (event.request.url.startsWith('https://images.unsplash.com/')) {
    event.respondWith(
      caches.open(UNSPLASH_CACHE).then(async (cache) => {
        const cached = await cache.match(event.request);
        if (cached) return cached;
        return fetch(event.request);
      }),
    );
    return;
  }

  // Skip other cross-origin requests, like those for Google Analytics
  if (event.request.url.startsWith(self.location.origin)) {
    event.respondWith(
      caches.match(event.request).then(cachedResponse => cachedResponse || fetch(event.request)),
    );
  }
});
