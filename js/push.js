// Notifikasi push (Web Push). Service worker menerima "kejutan" daripada pelayan, kemudian mengambil notis
// melalui API notis.ambil. Di iPhone, app mesti dipasang di Skrin Utama (iOS 16.4+).
import { api } from './api.js';
import { ambil, simpan } from './ui.js';

const iOS = () => /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
const terpasang = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const disokong = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function keU8(b64) {
  const p = '='.repeat((4 - (b64.length % 4)) % 4), s = atob((b64 + p).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from(s, (c) => c.charCodeAt(0));
}

/** Status notifikasi peranti ini: 'tidak-disokong' | 'perlu-pasang' | 'disekat' | 'aktif' | 'tidak-aktif'. */
export async function statusPush() {
  if (iOS() && !terpasang()) return 'perlu-pasang';
  if (!disokong()) return 'tidak-disokong';
  if (Notification.permission === 'denied') return 'disekat';
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    return sub && Notification.permission === 'granted' ? 'aktif' : 'tidak-aktif';
  } catch (e) { return 'tidak-aktif'; }
}

/** Aktifkan (mesti dipanggil daripada klik pengguna). */
export async function aktifkanPush() {
  const st = await statusPush();
  if (st === 'perlu-pasang') throw new Error('Di iPhone, pasang app ke Skrin Utama dahulu (Safari → Kongsi → Tambah ke Skrin Utama), kemudian buka UPAR Suite dari ikon.');
  if (st === 'tidak-disokong') throw new Error('Pelayar ini tidak menyokong notifikasi. Guna Chrome/Edge (PC & Android) atau app di Skrin Utama (iPhone).');
  const izin = await Notification.requestPermission();
  if (izin !== 'granted') throw new Error('Notifikasi tidak dibenarkan. Benarkan notifikasi untuk UPAR Suite dalam tetapan pelayar / telefon.');
  const { kunci } = await api('push.kunci');
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (sub) {
    const lama = sub.options && sub.options.applicationServerKey ? btoa(String.fromCharCode(...new Uint8Array(sub.options.applicationServerKey))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') : kunci;
    if (lama !== kunci) { await sub.unsubscribe(); sub = null; }
  }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: keU8(kunci) });
  await daftar(sub);
  return true;
}

async function daftar(sub) {
  const j = sub.toJSON();
  const peranti = (iOS() ? 'iPhone/iPad' : /Android/.test(navigator.userAgent) ? 'Android' : 'PC') + (terpasang() ? ' · app' : ' · pelayar');
  await api('push.langgan', { endpoint: j.endpoint, p256dh: j.keys.p256dh, auth: j.keys.auth, peranti });
  simpan('push.daftar', String(Date.now()));
}

export async function hentiPush() {
  try {
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) { try { await api('push.henti', { endpoint: sub.endpoint }, { senyap: true }); } catch (e) {} await sub.unsubscribe(); }
  } catch (e) {}
  simpan('push.daftar', '');
}

/** Selaraskan semula langganan dengan akaun yang sedang log masuk (sekali sehari, senyap). */
export async function segerakPush() {
  try {
    if (!disokong() || Notification.permission !== 'granted') return;
    if (Date.now() - Number(ambil('push.daftar') || 0) < 864e5) return;
    const reg = await navigator.serviceWorker.ready, sub = await reg.pushManager.getSubscription();
    if (sub) await daftar(sub);
  } catch (e) {}
}

export const PESAN_STATUS = {
  'aktif': 'Notifikasi aktif di peranti ini.',
  'tidak-aktif': 'Notifikasi belum diaktifkan di peranti ini.',
  'disekat': 'Notifikasi disekat. Benarkan dalam tetapan pelayar / telefon (Tetapan → Notifikasi → UPAR Suite).',
  'perlu-pasang': 'Di iPhone, notifikasi hanya berfungsi bila UPAR Suite dipasang di Skrin Utama dan dibuka dari ikon.',
  'tidak-disokong': 'Pelayar ini tidak menyokong notifikasi.'
};
