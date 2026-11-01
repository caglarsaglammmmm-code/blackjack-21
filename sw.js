// Çevrimdışı oyun için önbellek. Liste ve sürüm `npm run stamp` ile üretilir.
const CACHE = 'tokatlik-8e791b89d2fc';
const ASSETS = [
  './',
  'css/style.css',
  'fonts/nunito-latin-600-normal.woff2',
  'fonts/nunito-latin-800-normal.woff2',
  'fonts/nunito-latin-ext-600-normal.woff2',
  'fonts/nunito-latin-ext-800-normal.woff2',
  'fonts/playfair-display-latin-800-normal.woff2',
  'fonts/playfair-display-latin-ext-800-normal.woff2',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png',
  'index.html',
  'js/art.js',
  'js/audio.js',
  'js/brand.js',
  'js/engine.js',
  'js/firebase-config.js',
  'js/fx.js',
  'js/leaderboard.js',
  'js/main.js',
  'js/score-core.js',
  'js/storage.js',
  'js/table.js',
  'js/vendor/firebase.js',
  'manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== location.origin) return;
  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((hit) => {
      if (hit) return hit;
      return fetch(event.request).catch(() => {
        if (event.request.mode === 'navigate') return caches.match('index.html');
        return Response.error();
      });
    }),
  );
});
