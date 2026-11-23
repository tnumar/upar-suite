/* Service worker UPAR Suite: cache rangka app supaya boleh dibuka tanpa internet + notifikasi push.
 * Tukar VERSI setiap kali fail web dikemas kini supaya pengguna menerima versi baharu. */
self.window = self; // config.js menulis window.UPAR_CONFIG
try { importScripts('config.js'); } catch (e) {}
const URL_API = (self.UPAR_CONFIG && self.UPAR_CONFIG.API_URL) || '/api';
const VERSI = 'upar-v1.8.3';
const RANGKA = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/api.js', 'js/ui.js', 'js/push.js', 'js/art.js', 'js/icons.js',
  'js/pages/login.js', 'js/pages/home.js', 'js/pages/formulari.js', 'js/pages/admin.js', 'js/pages/profil.js', 'js/pages/pergerakan.js', 'js/pages/bukuoff.js', 'js/pages/inventori.js', 'js/pages/dashboard.js', 'js/pages/guttae.js', 'js/pages/kiosk.js', 'js/pages/soon.js', 'js/pages/uat.js', 'js/uat-senario.js', 'js/pages/penambahbaikan.js',
  'assets/logo.svg', 'assets/logo-usm.jpg', 'assets/icons/icon-192.png', 'assets/icons/icon-512.png', 'assets/icons/maskable-192.png', 'assets/icons/favicon-32.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSI).then((c) => c.addAll(RANGKA.map((p) => new Request(p, { cache: 'reload' })))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== VERSI).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return; // panggilan API (POST) tidak dicache
  const url = new URL(req.url);
  const fon = url.host === 'fonts.googleapis.com' || url.host === 'fonts.gstatic.com';
  if (url.origin !== location.origin && !fon) return;
  // Fon & fail rangka app: cache dahulu → buka serta-merta tanpa menunggu rangkaian (laju di telefon).
  // Kemas kini dijamin oleh VERSI: sw.js baharu → cache baharu → app dimuat semula pada navigasi seterusnya.
  // Fail lain: rangkaian dahulu, cache bila luar talian.
  const rangka = !fon && (req.mode === 'navigate' || RANGKA.some((p) => url.pathname.endsWith('/' + p.replace('./', ''))));
  e.respondWith(caches.open(VERSI).then(async (c) => {
    if (fon || rangka) {
      const hit = await c.match(req, { ignoreSearch: rangka });
      if (hit) return hit;
    }
    try {
      const r = await fetch(req, fon ? {} : { cache: 'no-cache' });
      if (r && (r.ok || r.type === 'opaque')) c.put(req, r.clone());
      return r;
    } catch (err) {
      const hit = await c.match(req, { ignoreSearch: true });
      if (hit) return hit;
      if (req.mode === 'navigate') return c.match('index.html');
      return new Response('', { status: 504 });
    }
  }));
});

self.addEventListener('message', (e) => { if (e.data === 'skipWaiting') self.skipWaiting(); });

/* ---------------- Notifikasi push ----------------
 * Pelayan menghantar "kejutan" tanpa kandungan; notis sebenar diambil di sini melalui API notis.ambil
 * (peranti dikenal pasti oleh endpoint + kunci auth langganan). Penanda masa terakhir disimpan dalam Cache. */
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
async function bacaSejak() { try { const r = await (await caches.open('upar-notis')).match('/sejak'); return r ? Number(await r.text()) || 0 : 0; } catch (e) { return 0; } }
async function tulisSejak(t) { try { await (await caches.open('upar-notis')).put('/sejak', new Response(String(t))); } catch (e) {} }
async function terimaPush() {
  const asas = { icon: 'assets/icons/icon-192.png', badge: 'assets/icons/icon-192.png' };
  try {
    const sub = await self.registration.pushManager.getSubscription();
    if (!sub) throw new Error('tiada langganan');
    const sejak = await bacaSejak();
    const r = await fetch(URL_API, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, redirect: 'follow',
      body: JSON.stringify({ fn: 'notis.ambil', args: { endpoint: sub.endpoint, auth: b64url(sub.getKey('auth')), sejak } }) });
    const j = await r.json();
    const senarai = (j.ok && j.data) || [];
    if (senarai.length) {
      await tulisSejak(Math.max(...senarai.map((n) => n.masa)));
      for (const n of senarai) await self.registration.showNotification(n.tajuk, { ...asas, body: n.badan, tag: n.id, data: { url: n.url } });
      return;
    }
  } catch (e) { /* jatuh ke notis umum */ }
  await self.registration.showNotification('UPAR Suite', { ...asas, body: 'Ada kemas kini Pergerakan Staf. Klik untuk melihat.', tag: 'upar-umum', data: { url: '#/pergerakan' } });
}
self.addEventListener('push', (e) => { e.waitUntil(terimaPush()); });
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const sasar = new URL('./' + ((e.notification.data && e.notification.data.url) || '#/utama'), self.registration.scope).href;
  e.waitUntil((async () => {
    const tetingkap = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const w of tetingkap) { if ('focus' in w) { try { await w.navigate(sasar); } catch (x) {} return w.focus(); } }
    return self.clients.openWindow(sasar);
  })());
});
