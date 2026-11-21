// Panggilan API ke backend GAS. POST text/plain (tiada preflight CORS).
import { simpan, ambil, buang } from './ui.js';

const URL_API = (window.UPAR_CONFIG && window.UPAR_CONFIG.API_URL) || '/api';

export class RalatApi extends Error {
  constructor(msg, code) { super(msg); this.code = code; }
}

export function token() { return ambil('token'); }
export function setToken(t) { if (t) simpan('token', t); else buang('token'); }

let onAuthGagal = () => {};
export function bilaAuthGagal(fn) { onAuthGagal = fn; }

/* ---------- cache dahulu, segar kemudian (stale-while-revalidate) ----------
 * Setiap panggilan GAS mengambil ~2–3 saat (overhead tetap Apps Script). Panggilan data yang ditanda
 * { cache: true } memulangkan data terakhir serta-merta, kemudian mengambil data segar di latar belakang.
 * Jika data berubah, pendengar bilaDataBaharu(fn) dipanggil supaya halaman dilukis semula. */
const SEGAR_MS = 30000;
/* Pembilang tulis: naik bagi setiap panggilan bukan-baca. Data baca yang dimulakan SEBELUM tulisan terkini
 * adalah basi dan tidak boleh menimpa hasil tulisan itu (perlumbaan "muat lama tiba selepas simpan"). */
const BACA = /\.(data|ringkasan|staf|tetapan|senarai|motivasi|templat|peranti|audit|semua|foto|cuti|laporan|bootstrap|gambar|versi|tx|item|kiraan)$/;
let tulisKe = 0;
export const versiTulis = () => tulisKe;
const segarPada = {};
const dipakai = new Set();
let onDataBaharu = () => {};
export function bilaDataBaharu(fn) { onDataBaharu = fn; }
/** Fungsi API (cache) yang digunakan oleh halaman semasa — ditetapkan semula oleh penghala. */
export function setSemulaDipakai() { dipakai.clear(); }
export function dipakaiHalaman(fn) { return dipakai.has(fn); }
const kunciCache = (fn, args) => 'cache.api.' + fn + ':' + JSON.stringify(args || {});
export function buangCacheApi() {
  try { Object.keys(localStorage).filter((k) => k.startsWith('upar.cache.')).forEach((k) => localStorage.removeItem(k)); } catch (e) {}
  Object.keys(segarPada).forEach((k) => delete segarPada[k]);
}

async function apiCache(fn, args, opt) {
  const k = kunciCache(fn, args), c = ambil(k);
  dipakai.add(fn);
  if (c != null) {
    if (Date.now() - (segarPada[k] || 0) > SEGAR_MS) {
      segarPada[k] = Date.now();
      const v = tulisKe;
      api(fn, args, { senyap: true }).then((d) => {
        if (v !== tulisKe) { segarPada[k] = 0; return; } // ada simpan semasa mengambil — data ini basi
        const s = JSON.stringify(d);
        if (s !== c) { simpan(k, s); onDataBaharu(fn); }
      }).catch(() => { segarPada[k] = 0; });
    }
    try { return JSON.parse(c); } catch (e) { buang(k); }
  }
  const v = tulisKe;
  const d = await api(fn, args, { senyap: opt.senyap });
  if (v === tulisKe) { simpan(k, JSON.stringify(d)); segarPada[k] = Date.now(); }
  return d;
}
/** Lupakan cache (cth selepas simpan borang) supaya bukaan seterusnya mengambil data segar. */
export function lupaCache(fn, args) { const k = kunciCache(fn, args); buang(k); delete segarPada[k]; }
/** Kemas kini cache selepas tindakan tulis (cth simpan) supaya bukaan seterusnya tepat. */
export function kemasCache(fn, args, data) { const k = kunciCache(fn, args); simpan(k, JSON.stringify(data)); segarPada[k] = Date.now(); }

export async function api(fn, args = {}, opt = {}) {
  if (opt.cache) return apiCache(fn, args, opt);
  const { senyap = false } = opt;
  const tulis = !BACA.test(fn);
  if (tulis) tulisKe++;
  let res;
  try {
    res = await fetch(URL_API, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ fn, token: token(), args }),
      redirect: 'follow'
    });
  } catch (e) {
    throw new RalatApi('Tiada sambungan internet. Cuba lagi bila dalam talian.', 'OFFLINE');
  }
  let j;
  try { j = await res.json(); } catch (e) { throw new RalatApi('Respons pelayan tidak sah (HTTP ' + res.status + ').', 'BAD'); }
  if (tulis) tulisKe++; // tulisan selesai: bacaan yang dimulakan semasa tulisan berjalan juga basi
  if (!j.ok) {
    if (j.code === 'AUTH' && !senyap) onAuthGagal(j.error);
    throw new RalatApi(j.error || 'Ralat tidak diketahui.', j.code);
  }
  return j.data;
}
