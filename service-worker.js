const CACHE_NAME = 'expense-tracker-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './scrript.js',
  './Background image.jfif',
  './manifest.json'
];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS)));
  self.skipWaiting();
});
self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});
self.addEventListener('fetch', event => {
  event.respondWith(caches.match(event.request).then(res => res || fetch(event.request)));
});
