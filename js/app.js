// UPAR Suite — rangka aplikasi: sesi, penghala, navigasi.
import { api, token, setToken, bilaAuthGagal } from './api.js';
import { $, $$, esc, simpan, ambil, buang, toast, ralat, inisial } from './ui.js';
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
let giliran = 0;
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
  if (!token() || !S.me) return paparLogin();
  if (!$('#page')) lukisRangka();
  if (S.me.tukarPin && !location.hash.startsWith('#/profil')) { location.hash = '#/profil/pin'; return; }
  const [, k = 'utama', ...rest] = (location.hash || '#/utama').split('/');
  $$('[data-nav]').forEach((a) => a.classList.toggle('on', a.dataset.nav === k));
  const page = $('#page');
  if (k === 'lagi') return paparLagi(page);
  const m = MODUL.find((x) => x.k === k);
  if ((m && !boleh(m)) || (k === 'admin' && !S.ada('suite', ['ADMIN'])) || !HALAMAN[k]) { location.hash = '#/utama'; return; }
  const n = ++giliran;
  try {
    const mod = await HALAMAN[k]();
    if (n !== giliran) return;
    // bekas baharu bagi setiap navigasi: kerja tak segerak / pemasa halaman lama (cth penyelarasan Dashboard)
    // akan menulis ke bekas yang sudah tertanggal, bukan ke halaman yang sedang dibuka.
    page.innerHTML = '';
    const bekas = document.createElement('div');
    bekas.className = 'page-v';
    page.appendChild(bekas);
    scrollTo(0, 0);
    await mod.papar(bekas, rest, { modul: m });
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
  });
}

export function setBoot(b) { S.boot = b; simpan('boot', b); terapJenama(); }

/** Muat semula bootstrap daripada pelayan (senyap). */
export async function segarBoot() {
  try { setBoot(await api('teras.bootstrap')); return true; } catch (e) { return false; }
}

export async function logKeluar() {
  try { await api('auth.logout', {}, { senyap: true }); } catch (e) {}
  setToken(null); buang('boot'); S.boot = null;
  ['formulari', 'bukuoff', 'inventori', 'dashboard', 'guttae'].forEach((k) => buang('cache.' + k));
  buang('dash.q');
  try { Object.keys(localStorage).filter((k) => k.startsWith('upar.cache.perg.')).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  location.hash = '';
  paparLogin();
}

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); window.__pasang = e; });
bilaAuthGagal((msg) => { toast(msg || 'Sesi tamat', 'bad'); setToken(null); buang('boot'); S.boot = null; paparLogin(); });

/* ---------- mula ---------- */
function statusRangkaian() { document.body.classList.toggle('offline', !navigator.onLine); }
addEventListener('online', statusRangkaian); addEventListener('offline', statusRangkaian);
statusRangkaian();

terapJenama();
addEventListener('hashchange', lalu);
if (/^#\/(sah\/|kiosk)/.test(location.hash || '')) lalu();
else if (token() && S.me) {
  lalu();
  segarBoot().then((ok) => { if (ok && location.hash.startsWith('#/utama')) lalu(); });
} else paparLogin();

if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}
