const CACHE_NAME = 'g5-pl-v9';
const STATIC_ASSETS = [
  '/',
  '/index.html',
  '/css/main.css',
  '/css/components.css',
  '/css/dashboard.css',
  '/js/app.js',
  '/js/api.js',
  '/js/rpe.js',
  '/js/views/login.js',
  '/js/views/athleteDashboard.js',
  '/js/views/sessionLog.js',
  '/js/views/athleteProfile.js',
  '/js/views/coachDashboard.js',
  '/js/views/programBuilder.js',
  '/js/views/athleteDetail.js',
  '/js/views/athleteExercise.js',
  '/js/views/weekDetail.js',
  '/js/components/navbar.js',
  '/js/components/weekView.js',
  '/js/components/setRow.js',
  '/js/components/questionnaire.js',
  '/js/components/exerciseHistory.js',
  '/icons/logo.svg'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS).catch(() => {}))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Network-first for API calls
  if (url.pathname.startsWith('/api/')) {
    e.respondWith(
      fetch(e.request).catch(() => new Response(JSON.stringify({ error: 'Offline' }), {
        headers: { 'Content-Type': 'application/json' }
      }))
    );
    return;
  }

  // Cache-first for static assets
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        const clone = res.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(e.request, clone));
        return res;
      });
    }).catch(() => caches.match('/index.html'))
  );
});
