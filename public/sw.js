/* Nagri Path service worker.
   The shell is cached so the app opens offline; speech requests always go to
   the network, since they need the model. */
const CACHE = 'nagri-path-v1';
const SHELL = [
  '/',
  '/manifest.webmanifest',
  '/fonts/manrope-400.woff2',
  '/fonts/manrope-700.woff2',
  '/fonts/fraunces-700.woff2',
  '/fonts/notobengali-400.woff2',
  '/fonts/notobengali-700.woff2',
  '/fonts/nagri-400.woff2',
  '/logos/sust.png',
  '/logos/fair.png',
  '/icons/icon-192.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // never cache the model or any cross-origin call
  if (url.origin !== self.location.origin) return;

  e.respondWith(
    caches.match(req).then((hit) => {
      if (hit) return hit;
      return fetch(req)
        .then((res) => {
          if (res && res.status === 200 && res.type === 'basic') {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        })
        .catch(() => caches.match('/'));
    })
  );
});
