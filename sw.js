// ============================================
//  ResQ — Service Worker
//  Caches app shell for offline support
// ============================================

const CACHE_NAME = 'resq-v1';

const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/dashboard.html',
  '/admin.html',
  '/css/styles.css',
  '/js/config.js',
  '/js/report.js',
  '/js/dashboard.js',
  '/js/admin.js',
  '/manifest.json',
];

/* ===== Install — cache app shell ===== */
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
  self.skipWaiting();
});

/* ===== Activate — clean old caches ===== */
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

/* ===== Fetch — cache first for static, network first for API ===== */
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);

  // Always go network for Supabase API calls
  if (url.hostname.includes('supabase.co')) {
    event.respondWith(fetch(event.request).catch(() => new Response('Offline', { status: 503 })));
    return;
  }

  // Cache first for everything else
  event.respondWith(
    caches.match(event.request).then(cached => {
      return cached || fetch(event.request).then(response => {
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        return response;
      });
    }).catch(() => caches.match('/index.html'))
  );
});