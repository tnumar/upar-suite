// Mod TV / Kiosk: papan baca sahaja dengan paparan bergilir, untuk peranti yang didaftar admin (#/kiosk/<token>).
import { api } from '../api.js';
import { $, $$, esc, toast, ralat, simpan, ambil } from '../ui.js';
import { ic } from '../icons.js';
import { alat, papanHTML, wadHTML, dialogTutup, AKHIR, JENIS, LABEL, hm, hariIni, tarikhP, fmtDur } from './dashboard.js';

const PAPAR = ['papan', 'wad', 'guttae'];
let D = null, R = null, tok = '', giliran = 0, tPapar = null, tData = null, tJam = null;

export async function paparKiosk(root, token) {
  if (token) { simpan('kiosk.token', token); history.replaceState(null, '', location.pathname + '#/kiosk'); }
  tok = token || ambil('kiosk.token') || '';
  R = root;
  document.documentElement.classList.add('kiosk-on');
  if (!tok) { root.innerHTML = `<div class="kiosk-err">${ic('tv')}<h2>Peranti belum didaftar</h2><p>Minta admin buka Admin → Peranti Kiosk dan buka pautan peranti pada skrin ini.</p></div>`; return; }
  root.innerHTML = `<div class="kiosk"><header><img src="assets/logo.svg" alt=""><div><b>Dashboard UPAR</b><small id="kDev"></small></div><span class="spacer"></span>
      <div class="kiosk-v">${PAPAR.map((p, i) => `<i data-i="${i}"></i>`).join('')}</div><b id="kTarikh"></b><b id="kJam" class="kiosk-jam"></b>
      <button class="btn" id="kBaru">${ic('sync')} Mula hari baru</button></header><main id="kUtama"><div class="skel" style="height:70vh"></div></main></div>`;
  $('#kBaru', root).onclick = mulaHariBaru;
  clearInterval(tJam); tJam = setInterval(jam, 1000); jam();
  await muat();
  clearInterval(tData); tData = setInterval(muat, 30000);
  clearInterval(tPapar); tPapar = setInterval(() => { giliran = (giliran + 1) % PAPAR.length; lukis(); }, 20000);
}
function jam() { const n = new Date(), j = $('#kJam', R); if (j) j.textContent = `${String(n.getHours()).padStart(2, '0')}:${String(n.getMinutes()).padStart(2, '0')}`; }
async function muat() {
  try { D = await api('kiosk.data', { token: tok }, { senyap: true }); simpan('cache.kiosk', D); }
  catch (e) {
    if (e.code === 'AUTH') { clearInterval(tData); clearInterval(tPapar); R.innerHTML = `<div class="kiosk-err">${ic('alert')}<h2>Peranti tidak sah</h2><p>${esc(e.message)}</p></div>`; return; }
    D = D || ambil('cache.kiosk', true);
  }
  lukis();
}
function lukis() {
  if (!D || !R) return;
  $('#kDev', R).textContent = D.peranti || '';
  $('#kTarikh', R).textContent = tarikhP(hariIni());
  $$('.kiosk-v i', R).forEach((x) => x.classList.toggle('on', Number(x.dataset.i) === giliran));
  const A = alat(D), now = Date.now(), kini = hariIni();
  const items = D.preskripsi.filter((i) => i.status >= 0 && (i.date === kini || (i.date < kini && i.status < AKHIR)));
  const m = $('#kUtama', R), v = PAPAR[giliran];
  const ringkas = `<div class="kiosk-sum">${JENIS.map((t) => { const a = items.filter((i) => i.type === t), s = a.filter((i) => i.status === AKHIR).length, lw = a.filter((i) => i.status < AKHIR && A.lewat(i, now)).length;
    return `<div class="s-${t.toLowerCase()}"><span>${LABEL[t]}</span><b>${s}<small> / ${a.length}</small></b>${lw ? `<em>${lw} lewat</em>` : ''}</div>`; }).join('')}</div>`;
  if (v === 'guttae') {
    const g = (D.guttae || []).filter((x) => x.st !== 'ok');
    m.innerHTML = ringkas + `<h2 class="kiosk-h">Guttae perlu perhatian</h2>${g.length ? `<div class="kiosk-gut">${g.map((x) => `<div class="${x.st}"><b>${esc(x.nama)}</b><span>${{ x: 'Ada yang luput', w: 'Hampir luput', n: 'Tarikh belum diisi', z: 'Habis' }[x.st]}</span><small>${x.boleh} botol${x.luputTerdekat ? ' · luput ' + esc(x.luputTerdekat) : ''}</small></div>`).join('')}</div>` : '<p class="kiosk-ok">✓ Semua guttae dalam keadaan baik.</p>'}`;
  } else if (!items.length) m.innerHTML = ringkas + '<p class="kiosk-ok">Belum ada preskripsi hari ini.</p>';
  else m.innerHTML = ringkas + (v === 'wad' ? wadHTML(items, A, now, { ro: true }) : papanHTML(items, A, now, { ro: true, tarikh: kini }));
}
function mulaHariBaru() {
  if (!D) return;
  const kini = hariIni(), l = D.preskripsi.filter((i) => i.status >= 0 && i.status < AKHIR && i.date <= kini).sort((a, b) => a.recAt - b.recAt);
  dialogTutup(l, async (k) => {
    try { D = await api('kiosk.tutup', { token: tok, keputusan: k }, { senyap: true }); toast('Hari baharu dimulakan', 'ok'); giliran = 0; lukis(); } catch (e) { ralat(e); }
  });
}
export { fmtDur };
