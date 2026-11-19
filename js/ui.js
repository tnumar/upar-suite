// Utiliti UI: storan selamat, escape, toast, dialog, format tarikh.
import { ic } from './icons.js';

/* ---------- storan (selamat jika localStorage disekat) ---------- */
const NS = 'upar.';
export function simpan(k, v) { try { localStorage.setItem(NS + k, typeof v === 'string' ? v : JSON.stringify(v)); } catch (e) {} }
export function ambil(k, json = false) {
  try { const v = localStorage.getItem(NS + k); if (v == null) return null; return json ? JSON.parse(v) : v; } catch (e) { return null; }
}
export function buang(k) { try { localStorage.removeItem(NS + k); } catch (e) {} }

/* ---------- DOM ---------- */
export const $ = (s, el = document) => el.querySelector(s);
export const $$ = (s, el = document) => Array.from(el.querySelectorAll(s));
export function esc(s) { return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
/** Teks dengan **tebal** (selamat). */
export function teksKaya(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
export function debounce(fn, ms = 150) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

/* ---------- toast ---------- */
export function toast(msg, jenis = '') {
  const el = document.createElement('div');
  el.className = 'toast ' + jenis; el.setAttribute('role', 'status'); el.textContent = msg;
  $('#toasts').appendChild(el);
  setTimeout(() => el.remove(), jenis === 'bad' ? 5000 : 2600);
}
export function ralat(e) { toast(e && e.message ? e.message : String(e), 'bad'); }

export async function salin(teks, mesej = 'Disalin') {
  try { await navigator.clipboard.writeText(teks); toast(mesej); }
  catch (e) {
    const t = document.createElement('textarea'); t.value = teks; document.body.appendChild(t); t.select();
    try { document.execCommand('copy'); toast(mesej); } catch (x) { toast('Gagal menyalin', 'bad'); }
    t.remove();
  }
}

/* ---------- dialog ---------- */
/** Buka dialog. Pulangkan elemen <dialog>; badan diisi oleh pemanggil. */
export function dialog({ tajuk = '', badge = '', badan = '', kaki = '', saiz = '', onClose } = {}) {
  const d = document.createElement('dialog');
  d.className = 'dlg ' + saiz;
  d.innerHTML = `<div class="dlg-h"><div style="flex:1;min-width:0">${badge ? `<span class="badge">${esc(badge)}</span>` : ''}<h3>${esc(tajuk)}</h3></div>
    <button class="btn ghost icon" data-tutup aria-label="Tutup">${ic('x')}</button></div>
    <div class="dlg-b">${badan}</div>${kaki ? `<div class="dlg-f">${kaki}</div>` : ''}`;
  document.body.appendChild(d);
  d.addEventListener('click', (e) => { if (e.target === d || e.target.closest('[data-tutup]')) d.close(); });
  d.addEventListener('close', () => { d.remove(); onClose && onClose(); });
  d.showModal();
  return d;
}

export function sahkan(mesej, { tajuk = 'Pengesahan', ya = 'Ya', bahaya = false } = {}) {
  return new Promise((res) => {
    let jawab = false;
    const d = dialog({
      tajuk, saiz: 'sm', badan: `<p style="margin:0">${esc(mesej)}</p>`,
      kaki: `<button class="btn" data-tutup>Batal</button><button class="btn ${bahaya ? 'bad' : 'pri'}" data-ya>${esc(ya)}</button>`,
      onClose: () => res(jawab)
    });
    d.querySelector('[data-ya]').onclick = () => { jawab = true; d.close(); };
  });
}

/** Butang sibuk semasa tindakan async. */
export async function sibuk(btn, fn) {
  if (btn) btn.classList.add('busy');
  try { return await fn(); } finally { if (btn) btn.classList.remove('busy'); }
}

/* ---------- tarikh ---------- */
const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const BULAN_P = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
export function tarikhPanjang(d = new Date()) { return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN_P[d.getMonth()]} ${d.getFullYear()}`; }
export function masaRingkas(s) {
  if (!s) return '';
  const d = new Date(String(s).length <= 10 ? s + 'T00:00:00' : s);
  if (isNaN(d)) return String(s);
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}, ${p(d.getHours())}:${p(d.getMinutes())}`;
}
export function salam(d = new Date()) {
  const h = d.getHours();
  return h < 12 ? 'Selamat pagi' : h < 14 ? 'Selamat tengah hari' : h < 19 ? 'Selamat petang' : 'Selamat malam';
}
export function inisial(nama) {
  const w = String(nama || '?').replace(/\b(bin|binti|bt|b\.|a\/l|a\/p)\b/gi, ' ').trim().split(/\s+/);
  return ((w[0] || '?')[0] + (w[1] ? w[1][0] : '')).toUpperCase();
}
/**
 * Nama panggilan: buang gelaran sapaan (Encik, Puan, Dr…) tetapi KEKALKAN awalan nama
 * (Mohd Roslan, Raja Zaiful, Nik Azira, Tuan Umar — "Tuan" keturunan dikekalkan).
 */
export function namaPanggilan(nama) {
  const s = String(nama || '').trim();
  const tuanKeturunan = /\b(bin|binti|bt)\s+tuan\b/i.test(s);
  const w = s.split(/\s+/).filter((x) => x && !/^(puan|encik|en\.?|cik|dr\.?|dato'?|datuk|datin|prof\.?|haji|hajah|hj\.?|hjh\.?|ym|yb)$/i.test(x) && !(/^tuan$/i.test(x) && !tuanKeturunan));
  let n = w[0] || s;
  if (w[1] && /^(tuan|mohd|moh\.?|muhammad|muhamad|muhd|mohamad|mohammad|mohamed|md|nik|wan|raja|tengku|tg|che|nur|nurul|siti|ahmad|abdul|ab\.?)$/i.test(w[0]) && !/^(bin|binti|bt|b\.?)$/i.test(w[1])) n = w[0] + ' ' + w[1];
  return n.toLowerCase().replace(/(^|\s)\S/g, (c) => c.toUpperCase());
}
