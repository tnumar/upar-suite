// Guttae — stok ubat titis mata (kelompok: nama, tarikh luput, bilangan). Kemas kini stok sahaja.
import { S, tajuk } from '../app.js';
import { api } from '../api.js';
import { $, $$, esc, toast, ralat, sibuk, dialog, sahkan, simpan, ambil, masaRingkas } from '../ui.js';
import { ic } from '../icons.js';

const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const TAG = { x: ['Ada yang luput', 'bad'], w: ['Hampir luput', 'warn'], n: ['Tarikh belum diisi', 'grey'], ok: ['Baik', 'ok'], z: ['Habis', 'grey'] };
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const fd = (k) => { const d = parseKey(k); return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };

let D = null, P = null, tapis = 'all', pandang = ambil('gut.view') || 'kad', cari = '';
const hari = (k) => Math.round((parseKey(k) - parseKey(D.kini)) / 864e5);
function lencana(g) {
  if (g.qty === 0) return '<span class="badge grey">Habis</span>';
  if (!g.luput) return '<span class="badge grey">Tiada tarikh</span>';
  const d = hari(g.luput);
  if (d < 0) return `<span class="badge bad">Luput ${-d} hari lalu</span>`;
  if (d === 0) return '<span class="badge warn">Luput hari ini</span>';
  return `<span class="badge ${d <= D.amaranHari ? 'warn' : 'ok'}">${d} hari lagi</span>`;
}
function kumpulan() {
  const m = new Map();
  D.kelompok.forEach((g) => { const k = g.nama.toLowerCase(); if (!m.has(k)) m.set(k, { nama: g.nama, b: [] }); m.get(k).b.push(g); });
  const out = [...m.values()].map((o) => {
    o.b.sort((x, y) => (x.luput === y.luput ? 0 : !x.luput ? 1 : !y.luput ? -1 : x.luput < y.luput ? -1 : 1));
    const hidup = o.b.filter((g) => g.qty !== 0), isX = (g) => g.luput && hari(g.luput) < 0, luput = hidup.filter(isX), ok = hidup.filter((g) => !isX(g));
    o.boleh = ok.reduce((t, g) => t + (g.qty || 0), 0); o.allUnknown = ok.length > 0 && ok.every((g) => g.qty === null);
    o.luputQty = luput.reduce((t, g) => t + (g.qty || 0), 0); o.luputN = luput.length;
    o.next = ok.find((g) => g.luput) || null;
    o.st = !hidup.length ? 'z' : luput.length ? 'x' : o.next && hari(o.next.luput) <= D.amaranHari ? 'w' : !o.next ? 'n' : 'ok';
    return o;
  });
  const r = { x: 0, w: 1, n: 2, ok: 3, z: 4 };
  return out.sort((a, b) => r[a.st] - r[b.st] || a.nama.localeCompare(b.nama, 'ms'));
}

export async function papar(page) {
  tajuk('Guttae');
  P = page;
  D = ambil('cache.guttae', true);
  if (D) lukis(); else page.innerHTML = '<div class="skel" style="height:360px;margin-top:8px"></div>';
  try { D = await api('guttae.data'); simpan('cache.guttae', D); lukis(); }
  catch (e) { if (!D) page.innerHTML = `<div class="card empty">${ic('alert')}<p>${esc(e.message)}</p></div>`; else toast('Luar talian — memaparkan data terakhir', 'bad'); }
}
function lukis() {
  const gr = kumpulan(), q = cari.toLowerCase();
  const cnt = { all: gr.length, attn: gr.filter((g) => g.st === 'x' || g.st === 'w').length, z: gr.filter((g) => g.st === 'z').length };
  let L = gr.filter((g) => !q || g.nama.toLowerCase().includes(q));
  if (tapis === 'attn') L = L.filter((g) => g.st === 'x' || g.st === 'w'); else if (tapis === 'z') L = L.filter((g) => g.st === 'z');
  P.innerHTML = `<div class="row" style="margin:6px 0 14px">
      <div class="chips">${[['all', 'Semua'], ['attn', 'Perlu perhatian'], ['z', 'Habis']].map(([k, n]) => `<button class="chip ${tapis === k ? 'on' : ''}" data-f="${k}">${n} <i>${cnt[k]}</i></button>`).join('')}</div>
      <div class="search" style="flex:1 1 200px">${ic('search')}<input class="in" id="gq" type="search" placeholder="Cari nama guttae" value="${esc(cari)}"></div>
      <div class="tabs"><button class="${pandang === 'kad' ? 'on' : ''}" data-v="kad">Kad</button><button class="${pandang === 'senarai' ? 'on' : ''}" data-v="senarai">Senarai</button></div>
      ${D.boleh ? `<button class="btn pri" data-baru>${ic('plus')} Tambah kelompok</button>` : ''}</div>
    ${!L.length ? `<div class="card empty">${ic('drop')}<p style="margin:0">${gr.length ? 'Tiada padanan.' : 'Belum ada stok guttae. Klik "Tambah kelompok".'}</p></div>` : pandang === 'senarai' ? senaraiHTML(L) : kadHTML(L)}`;
  P.onclick = (e) => {
    const b = e.target.closest('[data-f],[data-v],[data-baru],[data-buka],[data-tambah],[data-l]');
    if (!b) return;
    if (b.dataset.f) { tapis = b.dataset.f; return lukis(); }
    if (b.dataset.v) { pandang = b.dataset.v; simpan('gut.view', pandang); return lukis(); }
    if (b.dataset.baru !== undefined) return borang(null);
    if (b.dataset.tambah) { e.stopPropagation(); return borang(null, b.dataset.tambah); }
    if (b.dataset.l) { e.stopPropagation(); const g = D.kelompok.find((x) => x.id === b.dataset.l); return langkah(g, Number(b.dataset.n)); }
    if (b.dataset.buka) { const g = D.kelompok.find((x) => x.id === b.dataset.buka); if (g) borang(g); }
  };
  const gq = $('#gq', P);
  gq.oninput = (e) => { cari = e.target.value; const p = e.target.selectionStart; lukis(); const n = $('#gq', P); n.focus(); n.setSelectionRange(p, p); };
}
function kadHTML(L) {
  return `<div class="gut-grid">${L.map((o) => `<article class="card gut-c ${o.st}">
    <div class="gut-h"><h3>${esc(o.nama)}</h3><span class="badge ${TAG[o.st][1]}">${TAG[o.st][0]}</span></div>
    <div class="gut-big"><b>${o.allUnknown ? '?' : o.boleh}</b><span>${o.allUnknown ? 'bilangan belum diisi' : 'botol boleh digunakan'}</span></div>
    ${o.luputN ? `<div class="gut-x">${o.luputQty ? o.luputQty + ' botol ' : 'Ada kelompok '}sudah luput — asingkan dan kemas kini bilangan.</div>` : ''}
    <div class="small muted">${o.st === 'z' ? 'Tiada stok' : !o.next ? (o.luputN ? 'Tiada kelompok yang masih sah — sediakan kelompok baharu' : 'Tarikh luput belum diisi') : `Luput terdekat: <b>${fd(o.next.luput)}</b>`}</div>
    <div class="gut-b">${o.b.map((g) => `<div class="gut-r${g.qty === 0 ? ' zero' : ''}" data-buka="${esc(g.id)}"><span>${g.luput ? fd(g.luput) : '—'}</span>${lencana(g)}
      ${D.boleh && g.qty !== null ? `<span class="gut-st"><button class="btn icon sm" data-l="${esc(g.id)}" data-n="-1" aria-label="Kurang">−</button><b>${g.qty}</b><button class="btn icon sm" data-l="${esc(g.id)}" data-n="1" aria-label="Tambah">+</button></span>` : `<b>${g.qty === null ? '?' : g.qty}</b>`}</div>`).join('')}</div>
    ${D.boleh ? `<button class="btn sm ghost" data-tambah="${esc(o.nama)}">${ic('plus')} Tambah kelompok</button>` : ''}</article>`).join('')}</div>`;
}
function senaraiHTML(L) {
  return `<div class="card scroll-x"><table class="tbl"><thead><tr><th>Guttae</th><th>Tarikh luput</th><th>Baki tempoh</th><th style="text-align:right">Bilangan</th><th>Kemas kini terakhir</th></tr></thead><tbody>
    ${L.map((o) => o.b.map((g, i) => `<tr class="click" data-buka="${esc(g.id)}">${i === 0 ? `<td rowspan="${o.b.length}"><b>${esc(o.nama)}</b><div class="small muted">${o.allUnknown ? 'bilangan belum diisi' : o.boleh + ' boleh digunakan'} · ${TAG[o.st][0]}</div></td>` : ''}
      <td>${g.luput ? fd(g.luput) : '—'}</td><td>${lencana(g)}</td><td style="text-align:right"><b>${g.qty === null ? '?' : g.qty}</b></td><td class="small muted">${esc(g.oleh)}${g.upd ? ' · ' + esc(masaRingkas(new Date(g.upd).toISOString())) : ''}</td></tr>`).join('')).join('')}</tbody></table></div>`;
}
async function langkah(g, n) {
  const q = Math.max(0, (g.qty || 0) + n);
  try { D = await api('guttae.simpan', { id: g.id, nama: g.nama, luput: g.luput, qty: q }); simpan('cache.guttae', D); lukis(); toast(`${g.nama}: ${q} botol`, 'ok'); }
  catch (e) { ralat(e); }
}
function borang(g, nama) {
  const ro = !D.boleh;
  const semua = [...new Set([...D.nama, ...D.kelompok.map((x) => x.nama)])].sort((a, b) => a.localeCompare(b, 'ms'));
  const d = dialog({
    tajuk: g ? 'Kemas kini kelompok' : 'Tambah kelompok guttae', saiz: 'sm',
    badan: `<form id="fG" autocomplete="off"><label class="field"><span>Nama guttae *</span><input class="in" name="nama" list="dlG" required value="${esc(g ? g.nama : nama || '')}" ${ro ? 'disabled' : ''}><datalist id="dlG">${semua.map((n) => `<option value="${esc(n)}">`).join('')}</datalist></label>
      <label class="field"><span>Tarikh luput</span><input class="in" type="date" name="luput" value="${esc(g ? g.luput : '')}" ${ro ? 'disabled' : ''}></label>
      <label class="field"><span>Bilangan botol</span><div class="row" style="flex-wrap:nowrap"><button type="button" class="btn icon" data-s="-1" ${ro ? 'disabled' : ''}>−</button><input class="in" type="number" min="0" name="qty" value="${g && g.qty !== null ? g.qty : ''}" placeholder="?" style="text-align:center" ${ro ? 'disabled' : ''}><button type="button" class="btn icon" data-s="1" ${ro ? 'disabled' : ''}>+</button></div></label>
      ${g && g.oleh ? `<p class="small muted" style="margin:0">Kemas kini terakhir: ${esc(g.oleh)}</p>` : ''}</form>`,
    kaki: ro ? '<button class="btn" data-tutup>Tutup</button>' : `${g ? `<button class="btn bad ghost" data-padam>${ic('trash')} Padam</button>` : ''}<span class="spacer"></span><button class="btn" data-tutup>Batal</button><button class="btn pri" data-ok>Simpan</button>`
  });
  const f = $('#fG', d);
  $$('[data-s]', d).forEach((b) => (b.onclick = () => { const v = parseInt(f.qty.value, 10); f.qty.value = Math.max(0, (isNaN(v) ? 0 : v) + Number(b.dataset.s)); }));
  if (!g && !nama) f.nama.focus(); else if (!g) f.luput.focus();
  const hantar = (padam) => async (e) => {
    if (padam && !(await sahkan(`Padam kelompok ${g.nama}${g.luput ? ' (' + fd(g.luput) + ')' : ''}?`, { ya: 'Padam', bahaya: true }))) return;
    sibuk(e.currentTarget, async () => {
      try { D = await api('guttae.simpan', { id: g ? g.id : '', nama: f.nama.value.trim(), luput: f.luput.value, qty: f.qty.value, padam }); simpan('cache.guttae', D); d.close(); lukis(); toast(padam ? 'Dipadam' : 'Disimpan', 'ok'); }
      catch (err) { ralat(err); }
    });
  };
  const ok = $('[data-ok]', d); if (ok) ok.onclick = hantar(false);
  const pd = $('[data-padam]', d); if (pd) pd.onclick = hantar(true);
}
