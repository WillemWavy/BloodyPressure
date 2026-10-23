// Service worker: maakt de app offline bruikbaar. Hij slaat alleen de app-bestanden op, nooit je gegevens.
const VERSION = 'bp-v1.0.0';
const FILES = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/analysis.js',
  './js/bp.js',
  './js/charts.js',
  './js/dates.js',
  './js/dom.js',
  './js/i18n.js',
  './js/icons.js',
  './js/pdf.js',
  './js/store.js',
  './js/views/about.js',
  './js/views/calendar.js',
  './js/views/common.js',
  './js/views/daily.js',
  './js/views/day.js',
  './js/views/meds.js',
  './js/views/more.js',
  './js/views/part.js',
  './js/views/report.js',
  './js/views/trends.js',
  './vendor/jspdf.umd.min.js',
  './icons/icon.svg',
  './icons/favicon.svg',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(VERSION).then(cache => cache.addAll(FILES)));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches
      .keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('message', event => {
  if (event.data === 'skipWaiting') self.skipWaiting();
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;
  event.respondWith(
    caches.match(req, { ignoreSearch: true }).then(
      hit =>
        hit ||
        fetch(req).then(res => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone();
            caches.open(VERSION).then(cache => cache.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
