// NAIRARush service worker
// Purpose: (1) satisfy the browser's PWA installability requirement, and
// (2) let the app shell (this HTML/CSS/JS + icons) load instantly and even
// offline. It deliberately does NOT touch Firebase/Firestore/Paystack/Google
// Fonts/cdnjs requests — those must always hit the real network so login,
// wallet balance, and payments stay live and accurate.

const CACHE_NAME = 'nairarush-shell-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192x192.png',
  './icon-512x512.png',
  './icon-192x192-maskable.png',
  './icon-512x512-maskable.png'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .catch((err) => console.warn('[sw] precache failed:', err))
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Only ever handle same-origin GET requests for the app shell files.
  // Everything else (auth, Firestore reads/writes, Paystack, fonts, cdn
  // scripts, cross-origin anything) is left completely alone so it goes
  // straight to the network exactly as if there were no service worker.
  let url;
  try { url = new URL(req.url); } catch (e) { return; }
  if (req.method !== 'GET' || url.origin !== self.location.origin) {
    return;
  }

  // Network-first for the shell: always try to fetch the latest version
  // when online (so users get bug fixes/updates immediately), and only
  // fall back to the cached copy when there's no connection at all.
  event.respondWith(
    fetch(req)
      .then((res) => {
        const resClone = res.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(req, resClone)).catch(() => {});
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => cached || caches.match('./index.html'))
      )
  );
});
