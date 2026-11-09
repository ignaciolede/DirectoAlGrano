/* Directo al grano — service worker.
   Guarda la cáscara de la app para que abra rápido y sin señal desde la pantalla de inicio.
   Siempre pide primero a la red (así cada cambio publicado llega al toque) y usa la copia solo si no hay conexión.
   No toca Supabase, los tiles del mapa ni los CDN: eso va directo a la red. */
var CACHE = 'dag-shell-v1';
var SHELL = [
  './',
  './index.html',
  './app.css',
  './manifest.webmanifest',
  './js/config.js',
  './js/store.js',
  './js/geo.js',
  './js/map.js',
  './js/app.js',
  './icons/apple-touch-icon.png',
  './icons/icon-192.png',
  '../design-system/tokens.css',
  '../design-system/components/bundle.css',
  '../design-system/components/bundle.js',
  '../design-system/assets/Logos/app-icon.svg'
];

self.addEventListener('install', function (e) {
  e.waitUntil(caches.open(CACHE).then(function (c) { return c.addAll(SHELL); }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener('activate', function (e) {
  e.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith(
    fetch(req).then(function (res) {
      if (res.ok) { var copy = res.clone(); caches.open(CACHE).then(function (c) { c.put(req, copy); }); }
      return res;
    }).catch(function () {
      return caches.match(req, { ignoreSearch: true }).then(function (hit) {
        return hit || (req.mode === 'navigate' ? caches.match('./index.html') : Response.error());
      });
    })
  );
});
