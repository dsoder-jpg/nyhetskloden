// Nyhetskloden: lagrer kartfliser, skrifter og kartstil, så kartet virker uten nett og starter raskere.
// Appens egne filer og nyhetene lagres ikke her (motoren tar vare på sakene selv).
const CACHE = 'nk-kart-1', MAX = 4000;
const HOSTS = /^https:\/\/(tiles\.openfreemap\.org|server\.arcgisonline\.com|services\.arcgisonline\.com|gibs\.earthdata\.nasa\.gov|unpkg\.com)\//;
self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil((async () => {
  for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
  await self.clients.claim();
})()));
let puts = 0;
async function trim() {
  const c = await caches.open(CACHE), keys = await c.keys();
  if (keys.length > MAX) for (const k of keys.slice(0, keys.length - MAX)) await c.delete(k);
}
self.addEventListener('fetch', e => {
  const u = e.request.url;
  if (e.request.method !== 'GET' || !HOSTS.test(u)) return;
  // kartstilen: nettet først (den kan endres), ellers lagret kopi
  if (/\/styles\//.test(u)) {
    e.respondWith(fetch(e.request).then(r => { if (r.ok) { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)); } return r; }).catch(() => caches.match(e.request)));
    return;
  }
  // fliser og skrifter: lagret kopi først, ellers nettet
  e.respondWith(caches.match(e.request).then(hit => hit || fetch(e.request).then(r => {
    if (r.ok || r.type === 'opaque') { const cl = r.clone(); caches.open(CACHE).then(c => c.put(e.request, cl)).then(() => { if (++puts % 200 === 0) trim(); }); }
    return r;
  })));
});
