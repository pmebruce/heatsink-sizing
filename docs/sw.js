/* HS Design: scope-relative offline shell; generated 82771e7d40e79c64. */
const PREFIX = 'hs-pages-' + new URL(self.registration.scope).pathname;
const CACHE = PREFIX + '82771e7d40e79c64';
const ASSETS = ["index.html","manifest.webmanifest","favicon.svg","assets/index-D-Okii3J.css","assets/index-jD5xaA8H.js","icons/apple-touch-icon.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png"].map(p => new URL(p, self.registration.scope).href);
self.addEventListener('install', event => event.waitUntil((async () => {
  const cache = await caches.open(CACHE);
  try {
    for (const url of ASSETS) {
      const response = await fetch(url, { cache: 'reload' });
      if (!response.ok || response.redirected) throw new Error('Invalid cache response');
      if (url.endsWith('/index.html') && !(await response.clone().text()).includes('散熱片計算')) throw new Error('Invalid app shell');
      await cache.put(url, response);
    }
  } catch (error) { await caches.delete(CACHE); throw error; }
})()));
self.addEventListener('activate', event => event.waitUntil((async () => {
  for (const key of await caches.keys()) if (key.startsWith(PREFIX) && key !== CACHE) await caches.delete(key);
  await self.clients.claim();
})()));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin || !url.href.startsWith(self.registration.scope)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith((async () => {
      const cache = await caches.open(CACHE);
      // A version-consistent shell prevents mixing new HTML with old assets.
      return await cache.match(new URL('index.html', self.registration.scope).href) || fetch(event.request);
    })());
  } else if (ASSETS.includes(url.href)) event.respondWith((async () => {
    const cache = await caches.open(CACHE);
    return await cache.match(event.request) || fetch(event.request);
  })());
});
