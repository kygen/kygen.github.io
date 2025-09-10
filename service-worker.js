// Bump cache version to ensure clients get the latest scripts
// including recent fixes to the barcode scanner logic.
const CACHE_NAME = 'home-inventory-cache-v2';
const ASSETS = [
  '/',
  '/index.html',
  '/style.css',
  '/script.js',
];
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))))
  );
});
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
