/* Service worker UPAR Suite: cache rangka app supaya boleh dibuka tanpa internet.
 * Tukar VERSI setiap kali fail web dikemas kini supaya pengguna menerima versi baharu. */
const VERSI = 'upar-v1.6.6';
const RANGKA = [
  './', 'index.html', 'config.js', 'manifest.webmanifest', 'css/app.css',
  'js/app.js', 'js/api.js', 'js/ui.js', 'js/art.js', 'js/icons.js',
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
