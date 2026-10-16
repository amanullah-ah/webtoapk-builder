// Web to APK service worker: caches the app shell so the app opens instantly and offline.
// Builds always need internet, so /api/ is never cached.
const VERSION = 'w2apk-v3';
const SHELL = [
  '/', '/index.html', '/aman.css', '/script.js', '/manifest.webmanifest',
  '/icons/icon-192.png', '/icons/apple-touch-icon.png', '/icons/favicon-32.png', '/favicon.ico'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)));
});

self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k)));
    await self.clients.claim();
  })());
});

self.addEventListener('message', e => {
  if(e.data === 'SKIP_WAITING') self.skipWaiting();
});

async function staleWhileRevalidate(req){
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  const net = fetch(req).then(res => {
    if(res && (res.ok || res.type === 'opaque')) cache.put(req, res.clone());
    return res;
  }).catch(() => hit);
  return hit || net;
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);

  if(url.origin === self.location.origin){
    if(url.pathname.startsWith('/api/')) return;
    if(req.mode === 'navigate'){
      e.respondWith(
        fetch(req).then(res => {
          if(res.ok){ const copy = res.clone(); caches.open(VERSION).then(c => c.put('/index.html', copy)); }
          return res;
        }).catch(() => caches.match('/index.html'))
      );
      return;
    }
    e.respondWith(staleWhileRevalidate(req));
    return;
  }
  if(url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com'){
    e.respondWith(staleWhileRevalidate(req));
  }
});
