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

export async function api(fn, args = {}, { senyap = false } = {}) {
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
  if (!j.ok) {
    if (j.code === 'AUTH' && !senyap) onAuthGagal(j.error);
    throw new RalatApi(j.error || 'Ralat tidak diketahui.', j.code);
  }
  return j.data;
}
