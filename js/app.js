// UPAR Suite — rangka aplikasi: sesi, penghala, navigasi.
import { api, token, setToken, bilaAuthGagal, bilaDataBaharu, setSemulaDipakai, dipakaiHalaman, buangCacheApi, bilaPinDiperlukan } from './api.js';
import { $, $$, esc, simpan, ambil, buang, toast, ralat, inisial, sibuk, pcKongsi } from './ui.js';
import { ic } from './icons.js';

/* ---------- keadaan global ---------- */
export const S = {
  boot: ambil('boot', true),   // data bootstrap terakhir (untuk luar talian)
  get me() { return this.boot && this.boot.me; },
  peranan(m) { return (this.me && this.me.peranan && this.me.peranan[m]) || ''; },
  ada(m, senarai) { const r = this.peranan(m); return !!r && (!senarai || senarai.includes(r)); }
};

/* ---------- modul & navigasi ---------- */
const MODUL = [
  { k: 'utama', nama: 'Utama', ic: 'home', hash: '#/utama', semua: true },
  { k: 'pergerakan', nama: 'Pergerakan Staf', pendek: 'Pergerakan', ic: 'jadual', hash: '#/pergerakan' },
  { k: 'dashboard', nama: 'Dashboard', ic: 'board', hash: '#/dashboard' },
  { k: 'guttae', nama: 'Guttae', ic: 'drop', hash: '#/guttae' },
  { k: 'bukuoff', nama: 'Buku Off', ic: 'calendar', hash: '#/bukuoff' },
  { k: 'inventori', nama: 'Inventori', ic: 'box', hash: '#/inventori' },
  { k: 'formulari', nama: 'Formulari', ic: 'flask', hash: '#/formulari', semua: true },
  { k: 'penambahbaikan', nama: 'Penambahbaikan', ic: 'bulb', hash: '#/penambahbaikan', semua: true },
  { k: 'uat', nama: 'UAT (Ujian)', pendek: 'UAT', ic: 'check', hash: '#/uat', semua: true, ujian: true }
];
const persekitaran = () => (window.UPAR_CONFIG || {}).PERSEKITARAN || '';
const boleh = (m) => (m.ujian ? persekitaran() !== 'PRODUKSI' : true) && (m.semua || S.ada(m.k));

const HALAMAN = {
  utama: () => import('./pages/home.js'),
  formulari: () => import('./pages/formulari.js'),
  admin: () => import('./pages/admin.js'),
  profil: () => import('./pages/profil.js'),
  pergerakan: () => import('./pages/pergerakan.js'),
  dashboard: () => import('./pages/dashboard.js'), guttae: () => import('./pages/guttae.js'),
  bukuoff: () => import('./pages/bukuoff.js'), inventori: () => import('./pages/inventori.js'),
  uat: () => import('./pages/uat.js'),
  penambahbaikan: () => import('./pages/penambahbaikan.js')
};

/* ---------- jenama ---------- */
function terapJenama() {
  const j = S.boot && S.boot.jenama;
  if (!j) return;
  if (/^#[0-9a-f]{6}$/i.test(j.warna || '')) { document.documentElement.style.setProperty('--brand', j.warna); simpan('warna', j.warna); }
  document.title = j.namaApp || 'UPAR Suite';
}
export const logoUrl = () => (S.boot && S.boot.jenama && S.boot.jenama.logo) || 'assets/logo.svg';

/* ---------- rangka ---------- */
function lukisRangka() {
  const j = (S.boot && S.boot.jenama) || {}, me = S.me;
  const env = (window.UPAR_CONFIG || {}).PERSEKITARAN;
  const nav = MODUL.filter(boleh);
  const navHtml = nav.map((m) => `<a href="${m.hash}" data-nav="${m.k}">${ic(m.ic)}<span>${esc(m.nama)}</span>${m.fasa ? '<span class="soon">Fasa ' + m.fasa + '</span>' : ''}</a>`).join('');
  const adminHtml = S.ada('suite', ['ADMIN']) ? `<h6>Pentadbiran</h6><a href="#/admin" data-nav="admin">${ic('shield')}<span>Admin</span></a>` : '';
  const botNav = nav.filter((m) => !m.fasa && !m.ujian).slice(0, 3).concat(nav.filter((m) => m.fasa).slice(0, 1));
  $('#app').innerHTML = `
  <div class="shell">
    <aside class="side">
      <div class="brand"><img src="${esc(logoUrl())}" alt=""><div><b>${esc(j.namaApp || 'UPAR Suite')}</b><small>${esc(j.subjudul || '')}</small></div></div>
      <nav class="nav"><h6>Modul</h6>${navHtml}${adminHtml}</nav>
      <div class="side-foot"><a class="me" href="#/profil"><span class="av">${esc(inisial(me.nama))}</span><span style="min-width:0"><b>${esc(me.nama)}</b><small>${esc(me.stafId)}${env && env !== 'PRODUKSI' ? ' · ' + esc(env) : ''}</small></span></a><p class="kredit">Developed by TUTI 2026</p></div>
    </aside>
    <div class="main">
      <header class="top" id="top"><img class="tlogo" src="${esc(logoUrl())}" alt=""><h1 id="tajuk"></h1>
        <span class="net">${ic('wifi')} Luar talian</span>
        <a class="btn ghost icon" href="#/profil" aria-label="Profil" data-nav="profil"><span class="av" style="width:32px;height:32px;font-size:12px">${esc(inisial(me.nama))}</span></a>
      </header>
      <main class="page" id="page"></main>
    </div>
    <nav class="bot">${botNav.map((m) => `<a href="${m.hash}" data-nav="${m.k}">${ic(m.ic)}<span>${esc(m.pendek || m.nama)}</span></a>`).join('')}
      <a href="#/lagi" data-nav="lagi">${ic('menu')}<span>Lagi</span></a></nav>
  </div>`;
  addEventListener('scroll', () => $('#top') && $('#top').classList.toggle('scrolled', scrollY > 4), { passive: true });
}

export function tajuk(t) { const el = $('#tajuk'); if (el) el.textContent = t; }

/* ---------- penghala ---------- */
let giliran = 0, kotor = false, kekalSkrol = false;
// Data segar tiba (latar belakang) → lukis semula halaman semasa, kecuali pengguna sedang mengisi / dialog terbuka.
bilaDataBaharu((fn) => {
  if (!dipakaiHalaman(fn) || kotor || document.querySelector('dialog[open]')) return;
  const a = document.activeElement;
  if (a && a.closest && a.closest('#page') && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
  kekalSkrol = true; lalu();
});
addEventListener('input', (e) => { if (e.target.closest && e.target.closest('#page')) kotor = true; }, true);
/* ---------- kunci modul peribadi (PC kongsi sahaja) ----------
 * Buku Off & Admin minta PIN semula di PC. Terkunci semula bila keluar dari modul atau 5 minit tiada aktiviti. */
const PERIBADI = ['bukuoff', 'admin'];
const LAHU_MS = 5 * 60 * 1000;
let terbuka = false, aktifAkhir = 0;
function kunciSemula(lukis) {
  if (!terbuka) return;
  terbuka = false;
  api('auth.kunci', {}, { senyap: true }).catch(() => {});
  const k = ((location.hash || '').split('/')[1] || '');
  if (lukis && PERIBADI.includes(k)) lalu();
}
['pointerdown', 'keydown'].forEach((ev) => addEventListener(ev, () => { aktifAkhir = Date.now(); }, { passive: true, capture: true }));
setInterval(() => { if (terbuka && Date.now() - aktifAkhir > LAHU_MS) { kunciSemula(true); toast('Dikunci semula selepas 5 minit tiada aktiviti'); } }, 20000);
bilaPinDiperlukan(() => { terbuka = false; lalu(); });

function paparKunci(page, k, m) {
  tajuk(m ? m.nama : 'Admin');
  page.innerHTML = `<div class="kunci-p card">
    <span class="kunci-ic">${ic('lock')}</span>
    <h2>${esc(m ? m.nama : 'Admin')} dilindungi</h2>
    <p class="muted">PC ini mungkin dikongsi. Masukkan PIN anda untuk meneruskan.<br><small>Modul akan dikunci semula bila anda keluar atau selepas 5 minit tiada aktiviti.</small></p>
    <form id="fKunci" autocomplete="off"><input class="in" id="pinK" type="password" inputmode="numeric" autocomplete="off" placeholder="PIN" aria-label="PIN" maxlength="12">
      <button class="btn pri" type="submit">${ic('lock')} Buka</button></form>
    <p class="small" id="msgK" style="color:var(--bad);min-height:20px;margin:10px 0 0"></p>
    <p class="small muted" style="margin:0">Log masuk sebagai <b>${esc(S.me.nama)}</b>. Bukan anda? <a href="#/profil">Log keluar</a></p></div>`;
  const f = $('#fKunci', page), inp = $('#pinK', page);
  inp.focus();
  f.onsubmit = (e) => {
    e.preventDefault();
    if (!inp.value) { inp.focus(); return; }
    sibuk(f.querySelector('button'), async () => {
      try { await api('auth.sahPin', { pin: inp.value }); terbuka = true; aktifAkhir = Date.now(); lalu(); }
      catch (err) { $('#msgK', page).textContent = err.message; inp.value = ''; inp.focus(); }
    });
  };
}

async function lalu() {
  if ((location.hash || '').startsWith('#/sah/')) { // pautan pengesahan Buku Off daripada emel (tanpa log masuk)
    const [, , id = '', t = ''] = location.hash.split('/');
    const m = await import('./pages/bukuoff.js');
    return m.paparSah($('#app'), decodeURIComponent(id), t);
  }
  if ((location.hash || '').startsWith('#/kiosk')) { // TV / kiosk (peranti berdaftar, tanpa log masuk staf)
    const [, , t = ''] = location.hash.split('/');
    const m = await import('./pages/kiosk.js');
    return m.paparKiosk($('#app'), t);
  }
  if (window.__versiBaharu) { location.reload(); return; } // versi baharu sudah dipasang → muat semula senyap semasa bertukar halaman
  if (!token() || !S.me) return paparLogin();
  if (!$('#page')) lukisRangka();
  if (S.me.tukarPin && !location.hash.startsWith('#/profil')) { location.hash = '#/profil/pin'; return; }
  const [, k = 'utama', ...rest] = (location.hash || '#/utama').split('/');
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === k));
  const page = $('#page');
  if (k === 'lagi') return paparLagi(page);
  const m = MODUL.find((x) => x.k === k);
  if ((m && !boleh(m)) || (k === 'admin' && !S.ada('suite', ['ADMIN'])) || !HALAMAN[k]) { location.hash = '#/utama'; return; }
  if (pcKongsi()) {
    if (!PERIBADI.includes(k)) kunciSemula(false);
    else if (!terbuka) { ++giliran; page.innerHTML = ''; return paparKunci(page, k, m); }
  }
  const n = ++giliran;
  try {
    const mod = await HALAMAN[k]();
    if (n !== giliran) return;
    // bekas baharu bagi setiap navigasi: kerja tak segerak / pemasa halaman lama (cth penyelarasan Dashboard)
    // akan menulis ke bekas yang sudah tertanggal, bukan ke halaman yang sedang dibuka.
    page.innerHTML = '';
    setSemulaDipakai(); kotor = false;
    const bekas = document.createElement('div');
    bekas.className = 'page-v';
    page.appendChild(bekas);
    const y = scrollY, kekal = kekalSkrol;
    kekalSkrol = false;
    if (!kekal) scrollTo(0, 0);
    await mod.papar(bekas, rest, { modul: m });
    if (kekal && n === giliran) scrollTo(0, y); // lukis semula senyap: kekalkan kedudukan skrol
  } catch (e) { console.error(e); page.innerHTML = `<div class="empty">${ic('alert')}<p>${esc(e.message || e)}</p></div>`; }
}

function paparLagi(page) {
  tajuk('Menu');
  const nav = MODUL.filter(boleh);
  page.innerHTML = `<div class="grid" style="gap:10px;margin-top:8px">
    ${nav.map((m) => `<a class="sc" href="${m.hash}"><span class="ic" style="background:linear-gradient(135deg,var(--brand),var(--brand-2))">${ic(m.ic)}</span>${esc(m.nama)}${m.fasa ? `<span class="badge grey" style="margin-left:auto">Fasa ${m.fasa}</span>` : ''}</a>`).join('')}
    ${S.ada('suite', ['ADMIN']) ? `<a class="sc" href="#/admin"><span class="ic" style="background:#0f172a">${ic('shield')}</span>Admin</a>` : ''}
    <a class="sc" href="#/profil"><span class="ic" style="background:#0e7490">${ic('user')}</span>Profil & Tetapan</a>
  </div>`;
}

async function paparLogin() {
  const m = await import('./pages/login.js');
  m.papar($('#app'), async (data) => {
    setToken(data.token); delete data.token;
    setBoot(data);
    lukisRangka();
    location.hash = data.me.tukarPin ? '#/profil/pin' : '#/utama';
    lalu();
    jadualPramuat();
  });
}

export function setBoot(b) { S.boot = b; simpan('boot', b); terapJenama(); }

/** Muat semula bootstrap daripada pelayan (senyap). */
export async function segarBoot() {
  try { setBoot(await api('teras.bootstrap')); return true; } catch (e) { return false; }
}

export async function logKeluar() {
  try { await api('auth.logout', {}, { senyap: true }); } catch (e) {}
  setToken(null); buang('boot'); S.boot = null; terbuka = false;
  ['formulari', 'bukuoff', 'inventori', 'dashboard', 'guttae'].forEach((k) => buang('cache.' + k));
  buangCacheApi();
  buang('dash.q');
  try { Object.keys(localStorage).filter((k) => k.startsWith('upar.cache.perg.')).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  location.hash = '';
  paparLogin();
}

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__pasang = e; });
bilaAuthGagal((msg) => { toast(msg || 'Sesi tamat', 'bad'); setToken(null); buang('boot'); S.boot = null; paparLogin(); });

/* ---------- pramuat ----------
 * Selepas app dibuka, ambil data modul utama di latar belakang (2 serentak) supaya modul dibuka serta-merta
 * daripada cache walaupun belum pernah dilawati. */
let sudahPramuat = false;
function jadualPramuat() { if (!sudahPramuat) { sudahPramuat = true; setTimeout(pramuat, 2500); } }
async function pramuat() {
  if (!navigator.onLine || !token() || (navigator.connection && navigator.connection.saveData)) return;
  const ada = (k) => { const m = MODUL.find((x) => x.k === k); return !!m && boleh(m); };
  const kerja = [];
  const dc = (fn, args = {}) => () => api(fn, args, { cache: true, senyap: true });
  if (ada('pergerakan')) kerja.push(async () => { const m = await import('./pages/pergerakan.js'); const d = new Date(); await dc('pergerakan.data', m.argsData(d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')))(); });
  if (ada('bukuoff') && !pcKongsi()) kerja.push(dc('bukuoff.data'));
  if (ada('inventori')) kerja.push(dc('inventori.ringkasan'));
  if (ada('guttae') && !ambil('cache.guttae')) kerja.push(async () => simpan('cache.guttae', await api('guttae.data', {}, { senyap: true })));
  if (!ambil('cache.formulari')) kerja.push(async () => simpan('cache.formulari', await api('formulari.data', { v: '' }, { senyap: true })));
  kerja.push(dc('pb.data'));
  if (ada('uat')) kerja.push(dc('uat.data'));
  if (S.ada('suite', ['ADMIN']) && !pcKongsi()) kerja.push(dc('admin.staf'), dc('admin.tetapan'), dc('admin.senarai'));
  const larian = async () => { while (kerja.length) { try { await kerja.shift()(); } catch (e) { /* abaikan: halaman akan cuba semula */ } } };
  await Promise.all([larian(), larian()]);
}

/* ---------- mula ---------- */
function statusRangkaian() { document.body.classList.toggle('offline', !navigator.onLine); }
addEventListener('online', statusRangkaian); addEventListener('offline', statusRangkaian);
statusRangkaian();

terapJenama();
// PC kongsi: buang data peribadi yang mungkin tersimpan oleh versi terdahulu
if (pcKongsi()) { try { Object.keys(localStorage).filter((x) => /^upar\.cache\.(api\.(bukuoff|admin)\.|bukuoff$)/.test(x)).forEach((x) => localStorage.removeItem(x)); } catch (e) {} }
addEventListener('hashchange', lalu);
if (/^#\/(sah\/|kiosk)/.test(location.hash || '')) lalu();
else if (token() && S.me) {
  lalu();
  jadualPramuat();
  segarBoot().then((ok) => { if (ok && location.hash.startsWith('#/utama')) lalu(); });
} else paparLogin();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const adaSW = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => { if (adaSW) window.__versiBaharu = true; });
  navigator.serviceWorker.register('sw.js').then((r) => {
    // semak versi baharu bila app dibuka semula dari latar belakang
    document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') r.update().catch(() => {}); });
  }).catch(() => {});
}
