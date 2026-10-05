/**
 * AegisVault - Service Worker
 * Cache-first offline capability ensuring 100% offline vault operation
 */

const CACHE_NAME = 'aegis-vault-v1.0.0';
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './css/styles.css',
  './js/crypto.js',
  './js/vault.js',
  './js/app.js',
  './manifest.json',
  './icons/shield.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[AegisVault SW] Caching offline assets');
      return cache.addAll(ASSETS_TO_CACHE).catch(err => {
        console.warn('[AegisVault SW] Some assets could not be cached immediately:', err);
      });
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keyList) => {
      return Promise.all(
        keyList.map((key) => {
          if (key !== CACHE_NAME) {
            console.log('[AegisVault SW] Removing old cache:', key);
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  // Offline-first strategy
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }
      return fetch(event.request).then((response) => {
        // Cache external requests like fonts
        if (response && response.status === 200 && (event.request.url.startsWith('http') || event.request.url.startsWith('https'))) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }
        return response;
      }).catch(() => {
        // Fallback to cached index.html for navigation
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
      });
    })
  );
});
