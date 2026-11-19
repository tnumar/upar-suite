import { S, tajuk } from '../app.js';
import { esc, salam, tarikhPanjang, namaPanggilan } from '../ui.js';
import { ic } from '../icons.js';
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
    if (!data) isi = `<p class="small muted" style="margin:0">Modul ini akan dilancarkan tidak lama lagi.</p>`;
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
    <h2 class="sec">Pintasan</h2>
    <div class="shortcuts">${pin.map((p) => `<a class="sc" href="${p.hash}"><span class="ic" style="background:${p.warna}">${ic(p.ic)}</span>${esc(p.label)}</a>`).join('')}</div>
  `;
}
