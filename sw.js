const CACHE_NAME = "trademaa-cache-v1";
const urlsToCache = [
  "./index.html",
  "./style.css",
  "./script.js", // si séparé
  "https://cdn.jsdelivr.net/npm/xlsx@0.20.2/dist/xlsx.full.min.js",
  "./icons/icon-192.png",
  "./icons/icon-512.png"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(urlsToCache))
  );
});

self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((response) => response || fetch(event.request))
  );
});
