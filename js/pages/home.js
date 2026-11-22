import { S, tajuk } from '../app.js';
import { esc, salam, tarikhPanjang, namaPanggilan, pcKongsi } from '../ui.js';
import { ic } from '../icons.js';
import { statusPush, aktifkanPush } from '../push.js';
import { toast, ralat, sibuk, ambil, simpan } from '../ui.js';
import { seni } from '../art.js';

const KAD = {
  dashboard: { nama: 'Dashboard', ic: 'board', warna: 'linear-gradient(135deg,#4f46e5,#7c3aed)', hash: '#/dashboard' },
  guttae: { nama: 'Guttae', ic: 'drop', warna: 'linear-gradient(135deg,#0891b2,#22d3ee)', hash: '#/guttae' },
  bukuoff: { nama: 'Buku Off', ic: 'calendar', warna: 'linear-gradient(135deg,#be185d,#f472b6)', hash: '#/bukuoff' },
  inventori: { nama: 'Inventori', ic: 'box', warna: 'linear-gradient(135deg,#d97706,#fbbf24)', hash: '#/inventori' }
};

const PINTASAN = [
  { k: 'bukuoff', label: 'Tambah rekod OT', ic: 'plus', warna: '#be185d', hash: '#/bukuoff/baru' },
  { k: 'inventori', label: 'Keluarkan stok', ic: 'box', warna: '#d97706', hash: '#/inventori/keluar' },
  { k: 'dashboard', label: 'Preskripsi baharu', ic: 'board', warna: '#4f46e5', hash: '#/dashboard/baru' },
  { k: 'formulari', label: 'Cari formulasi', ic: 'search', warna: '#0e7490', hash: '#/formulari', semua: true }
];

export function papar(page) {
  tajuk('Utama');
  if (!S.boot) return;
  const b = S.boot, me = S.me, q = b.motivasi;
  const kad = Object.keys(KAD).filter((k) => S.ada(k)).map((k) => {
    const K = KAD[k], data = (b.kad || []).find((x) => x.modul === k);
    let isi;
    if (k === 'bukuoff' && pcKongsi()) isi = `<p class="small muted" style="margin:0">${ic('lock')} Dilindungi PIN pada PC — klik untuk buka.</p>`;
    else if (!data) isi = `<p class="small muted" style="margin:0">Modul ini akan dilancarkan tidak lama lagi.</p>`;
    else if (data.ralat) isi = `<p class="small muted" style="margin:0">${esc(data.ralat)}</p>`;
    else isi = `<div class="stats">${(data.stat || []).map((s) => `<div class="stat ${esc(s.nada || '')}"><b>${esc(s.nilai)}</b><span>${esc(s.label)}</span></div>`).join('')}</div>`;
    return `<a class="card kad" href="${K.hash}" style="color:inherit">
      <div class="kad-h"><span class="ic" style="background:${K.warna}">${ic(K.ic)}</span><b>${esc(K.nama)}</b><span class="spacer"></span>${ic('arrow', 'muted')}</div>${isi}</a>`;
  }).join('');
  const pin = PINTASAN.filter((p) => p.semua || S.ada(p.k));

  page.innerHTML = `
    <div class="hello">
      <div><h2>${esc(salam())}, ${esc(namaPanggilan(me.nama))} 👋</h2><p>${esc(tarikhPanjang())}</p></div>
    </div>
    ${q ? `<section class="quote" aria-label="Kata motivasi hari ini">
      <div class="qbg">${q.imej ? `<img src="${esc(q.imej)}" alt="" loading="lazy">` : seni(q.seni)}</div>
      <div class="qtxt"><small>${q.bahasa === 'BI' ? 'Quote of the day' : 'Kata-kata hari ini'}</small>
        <blockquote>“${esc(q.teks)}”</blockquote>${q.sumber ? `<cite>— ${esc(q.sumber)}</cite>` : ''}</div>
    </section>` : ''}
    ${kad ? `<h2 class="sec">Ringkasan</h2><div class="grid g2">${kad}</div>` : ''}
    <div id="jemputNotis"></div>
    <h2 class="sec">Pintasan</h2>
    <div class="shortcuts">${pin.map((p) => `<a class="sc" href="${p.hash}"><span class="ic" style="background:${p.warna}">${ic(p.ic)}</span>${esc(p.label)}</a>`).join('')}</div>
  `;
  if (S.ada('pergerakan')) jemputNotis(page);
}

/** Jemputan sekali untuk mengaktifkan notifikasi (boleh ditolak; muncul semula selepas 14 hari). */
async function jemputNotis(page) {
  const el = page.querySelector('#jemputNotis'); if (!el) return;
  if (Date.now() - Number(ambil('notis.tolak') || 0) < 14 * 864e5) return;
  const st = await statusPush();
  if (st !== 'tidak-aktif' && st !== 'perlu-pasang') return;
  el.innerHTML = `<section class="card pad jemput-notis"><span class="ic">${ic('bell')}</span><div style="flex:1;min-width:0"><b>Terima notis Pergerakan Staf</b>
    <p class="small muted" style="margin:2px 0 0">${st === 'perlu-pasang' ? 'Pasang UPAR Suite ke Skrin Utama (Safari → Kongsi → Tambah ke Skrin Utama), buka dari ikon, kemudian aktifkan notifikasi di sini.' : 'Notis bila staf mengisi cuti/off, dan ringkasan pergerakan hari ini setiap pagi jam 8.00.'}</p></div>
    <div class="row" style="gap:6px">${st === 'tidak-aktif' ? `<button class="btn pri sm" data-on>${ic('bell')} Aktifkan</button>` : ''}<button class="btn ghost sm" data-tolak>Nanti</button></div></section>`;
  const on = el.querySelector('[data-on]');
  if (on) on.onclick = () => sibuk(on, async () => { try { await aktifkanPush(); toast('Notifikasi diaktifkan', 'ok'); el.innerHTML = ''; } catch (err) { ralat(err); } });
  el.querySelector('[data-tolak]').onclick = () => { simpan('notis.tolak', String(Date.now())); el.innerHTML = ''; };
}
