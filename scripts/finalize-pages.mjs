import { readFile, writeFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const root = new URL('../docs/', import.meta.url);
const manifest = {
  id: './', name: '散熱片計算', short_name: '散熱片計算', lang: 'zh-Hant', start_url: './', scope: './',
  display: 'standalone', background_color: '#f0f4f7', theme_color: '#123646',
  icons: [{ src: './icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
    { src: './icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    { src: './icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' }],
};
await writeFile(new URL('manifest.webmanifest', root), JSON.stringify(manifest, null, 2));
await writeFile(new URL('.nojekyll', root), '');
const files = ['index.html', 'manifest.webmanifest', 'favicon.svg'];
for (const dir of ['assets', 'icons']) for (const name of await readdir(new URL(dir + '/', root))) files.push(dir + '/' + name);
const hash = createHash('sha256');
for (const path of files) hash.update(await readFile(new URL(path, root)));
const version = hash.digest('hex').slice(0, 16);
await writeFile(new URL('sw.js', root), `/* HS Design: scope-relative offline shell; generated ${version}. */
const PREFIX = 'hs-pages-' + new URL(self.registration.scope).pathname;
const CACHE = PREFIX + '${version}';
const ASSETS = ${JSON.stringify(files)}.map(p => new URL(p, self.registration.scope).href);
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
`);
console.log(`GitHub Pages PWA: ${files.length} cached assets, version ${version}`);
