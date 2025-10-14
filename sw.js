const CACHE_NAME = "trademaa-cache-v1";
const urlsToCache = [
  "./index.html",
  "./style.css",
  "./script.js", // si séparé
  "./xlsx.full.min.js",
  "https://cdn.jsdelivr.net/npm/xlsx@0.20.2/dist/xlsx.full.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open('v1').then(cache => {
      const urls = ['/', '/style.css', '/script.js','/xlsx.full.min.js', '/icons/icon-192.png', '/manifest.json'];
      return Promise.all(
        urls.map(url => cache.add(url).catch(err => {
          console.warn('Fichier non trouvé, cache ignoré:', url);
        }))
      );
    })
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
