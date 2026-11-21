// Senarai semak UAT: staf menanda setiap senario Lulus / Gagal dengan catatan.
import { S, tajuk } from '../app.js';
import { api } from '../api.js';
import { $, $$, esc, toast, ralat } from '../ui.js';
import { ic } from '../icons.js';
import { KUMPULAN, senarioSaya } from '../uat-senario.js';

export async function papar(page) {
  tajuk('UAT');
  const senarai = senarioSaya(S);
  page.innerHTML = '<div class="skel" style="height:240px;margin-top:8px"></div>';
  let hasil = {};
  try { (await api('uat.data', {}, { cache: true })).forEach((r) => { hasil[r.senario] = r; }); }
  catch (e) { page.innerHTML = `<div class="empty">${ic('alert')}<p>${esc(e.message)}</p></div>`; return; }

  const kiraan = () => {
    const siap = senarai.filter((x) => hasil[x.id] && hasil[x.id].status).length;
    const gagal = senarai.filter((x) => hasil[x.id] && hasil[x.id].status === 'GAGAL').length;
    return { siap, gagal, jumlah: senarai.length };
  };
  const kepala = () => {
    const k = kiraan(), pc = k.jumlah ? Math.round(k.siap / k.jumlah * 100) : 0;
    return `<div class="row" style="justify-content:space-between"><b>${k.siap} / ${k.jumlah} senario diuji</b>
      <span class="small">${k.gagal ? `<span class="badge bad">${k.gagal} gagal</span>` : ''} ${pc === 100 ? '<span class="badge ok">Selesai — terima kasih!</span>' : ''}</span></div>
      <div class="uat-bar"><i style="width:${pc}%"></i></div>`;
  };
  const kad = (x) => {
    const r = hasil[x.id] || {}, st = r.status || '';
    return `<article class="uat-kad ${st === 'LULUS' ? 'lulus' : st === 'GAGAL' ? 'gagal' : ''}" data-id="${esc(x.id)}">
      <div class="uat-atas"><span class="uat-id">${esc(x.id)}</span><b>${esc(x.tajuk)}</b></div>
      <p class="small" style="margin:6px 0 2px"><span class="muted">Langkah:</span> ${esc(x.langkah)}</p>
      <p class="small" style="margin:0 0 10px"><span class="muted">Dijangka:</span> ${esc(x.jangka)}</p>
      <div class="row" style="gap:8px">
        <button class="btn sm ${st === 'LULUS' ? 'ok-on' : ''}" data-st="LULUS" type="button">${ic('check')} Lulus</button>
        <button class="btn sm ${st === 'GAGAL' ? 'bad-on' : ''}" data-st="GAGAL" type="button">${ic('x')} Gagal</button>
        <span class="small muted uat-simpan" style="margin-left:auto"></span>
      </div>
      <textarea class="in uat-cat" rows="${x.bebas ? 4 : 2}" placeholder="${st === 'GAGAL' || x.bebas ? 'Terangkan apa yang berlaku (wajib jika gagal)' : 'Catatan (pilihan)'}">${esc(r.catatan || '')}</textarea>
    </article>`;
  };

  page.innerHTML = `<div class="uat" style="margin-top:8px">
    <section class="card pad" style="margin-bottom:14px">
      <p style="margin:0 0 12px">Ini ialah <b>persekitaran Ujian</b>. Cuba setiap senario di bawah, kemudian klik <b>Lulus</b> atau <b>Gagal</b>. Jika gagal, tulis apa yang berlaku. Data ujian boleh dipadam selepas UAT.</p>
      <div id="uatKepala">${kepala()}</div>
    </section>
    ${KUMPULAN.map((g) => {
      const xs = senarai.filter((x) => x.modul === g.modul);
      return xs.length ? `<h3 class="uat-h">${esc(g.nama)}</h3><div class="grid g2" style="align-items:start">${xs.map(kad).join('')}</div>` : '';
    }).join('')}
  </div>`;

  const simpanKad = async (el, status) => {
    const id = el.dataset.id, cat = $('.uat-cat', el).value.trim(), lbl = $('.uat-simpan', el);
    if (status === 'GAGAL' && !cat) { toast('Sila terangkan apa yang berlaku dalam ruangan catatan.', 'bad'); $('.uat-cat', el).focus(); }
    lbl.textContent = 'Menyimpan…';
    try {
      hasil[id] = await api('uat.simpan', { senario: id, status, catatan: cat });
      el.classList.toggle('lulus', status === 'LULUS'); el.classList.toggle('gagal', status === 'GAGAL');
      $$('[data-st]', el).forEach((b) => { b.classList.remove('ok-on', 'bad-on'); if (b.dataset.st === status) b.classList.add(status === 'LULUS' ? 'ok-on' : 'bad-on'); });
      lbl.textContent = 'Disimpan';
      $('#uatKepala', page).innerHTML = kepala();
    } catch (e) { lbl.textContent = ''; ralat(e); }
  };
  $$('.uat-kad', page).forEach((el) => {
    $$('[data-st]', el).forEach((b) => { b.onclick = () => { const cur = (hasil[el.dataset.id] || {}).status; simpanKad(el, cur === b.dataset.st ? '' : b.dataset.st); }; });
    const ta = $('.uat-cat', el);
    ta.onchange = () => { const r = hasil[el.dataset.id] || {}; if (ta.value.trim() !== (r.catatan || '')) simpanKad(el, r.status || ''); };
  });
}
