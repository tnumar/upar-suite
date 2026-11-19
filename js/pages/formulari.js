// Modul Formulari: rujukan formulasi aseptik + kod item. Boleh dibaca luar talian; EDITOR boleh ubah.
import { tajuk } from '../app.js';
import { api } from '../api.js';
import { $, $$, esc, teksKaya, toast, ralat, sibuk, salin, dialog, sahkan, debounce, simpan, ambil, masaRingkas } from '../ui.js';
import { ic } from '../icons.js';

let D = null;            // { v, editor, formulasi, kod, kategori }
let NAMA = new Map();    // kod → nama
let KOD_LC = [];
let GUNA = new Set();    // kod yang digunakan dalam formulari
const st = { tab: 'formulari', kat: 'all', q: '', kq: '', kmode: 'all', kshown: 60 };

function sediakan(d) {
  D = d;
  NAMA = new Map(d.kod.map(([c, n]) => [c, n]));
  KOD_LC = d.kod.map(([c, n]) => (c + ' ' + n).toLowerCase());
  GUNA = new Set();
  d.formulasi.forEach((f) => {
    if (f.pcode) GUNA.add(f.pcode);
    semuaBahan(f).forEach((i) => i.k && GUNA.add(i.k));
  });
}
const semuaBahan = (f) => (f.hasVariants ? f.variants.flatMap((v) => v.ingredients || []) : f.ingredients || []);
const labelKat = (k) => ((D.kategori || []).find((x) => x.nilai === k) || {}).label || k;

/** Ambil data terkini daripada pelayan. Pulangkan true jika data berubah. */
async function muat(paksa = false) {
  const r = await api('formulari.data', { v: D && !paksa ? D.v : '' });
  if (r.sama) { D.editor = r.editor; return false; }
  sediakan(r); simpan('cache.formulari', r); return true;
}

export async function papar(page, rest) {
  tajuk('Formulari');
  st.tab = rest[0] === 'kod' ? 'kod' : 'formulari';
  if (!D) { const c = ambil('cache.formulari', true); if (c) sediakan(c); }
  if (D) lukis(page);
  else page.innerHTML = '<div class="skel" style="height:46px;margin:8px 0 14px"></div><div class="grid g3">' + '<div class="skel" style="height:120px"></div>'.repeat(6) + '</div>';
  try {
    const editorDulu = D && D.editor;
    if ((await muat()) || D.editor !== editorDulu) { if (page.isConnected) lukis(page); }
  } catch (e) {
    if (!D) { page.innerHTML = `<div class="empty">${ic('wifi')}<p>${esc(e.message)}</p></div>`; return; }
    if (e.code === 'OFFLINE') toast('Luar talian — memaparkan data tersimpan');
  }
  const id = Number(rest[0]);
  if (id) bukaFormulasi(id);
}

function lukis(page) {
  page.innerHTML = `
  <div class="row" style="margin:6px 0 14px">
    <div class="tabs" id="ftabs"><button data-tab="formulari" class="${st.tab === 'formulari' ? 'on' : ''}">Formulari</button><button data-tab="kod" class="${st.tab === 'kod' ? 'on' : ''}">Rujukan Kod</button></div>
    <span class="spacer"></span>
    ${D.editor ? `<button class="btn pri" id="bBaru">${ic('plus')} ${st.tab === 'kod' ? 'Kod baharu' : 'Formulasi baharu'}</button>` : ''}
  </div>
  <div id="vF" ${st.tab !== 'formulari' ? 'hidden' : ''}>
    <div class="search">${ic('search')}<input class="in" id="q1" type="search" placeholder="Cari sediaan, bahan atau kod" value="${esc(st.q)}" autocomplete="off"></div>
    <div class="chips" id="cats" style="margin-top:12px">
      <button class="chip ${st.kat === 'all' ? 'on' : ''}" data-cat="all">Semua</button>
      ${(D.kategori || []).map((k) => `<button class="chip ${st.kat === k.nilai ? 'on' : ''}" data-cat="${esc(k.nilai)}">${esc(k.label)}</button>`).join('')}
      ${D.editor ? `<button class="chip ${st.kat === '_arkib' ? 'on' : ''}" data-cat="_arkib">Diarkib</button>` : ''}
    </div>
    <p class="small muted" id="c1" style="margin:4px 0 12px"></p>
    <div class="grid g3" id="grid"></div>
  </div>
  <div id="vK" ${st.tab !== 'kod' ? 'hidden' : ''}>
    <div class="search">${ic('search')}<input class="in" id="q2" type="search" placeholder="Cari nama atau kod item" value="${esc(st.kq)}" autocomplete="off"></div>
    <div class="chips" id="kcats" style="margin-top:12px">
      <button class="chip ${st.kmode === 'all' ? 'on' : ''}" data-k="all">Semua item</button>
      <button class="chip ${st.kmode === 'used' ? 'on' : ''}" data-k="used">Digunakan dalam formulari</button>
      <button class="chip ${st.kmode === 'gt' ? 'on' : ''}" data-k="gt">Produk siap Guttae (GT)</button>
    </div>
    <p class="small muted" id="c2" style="margin:4px 0 12px"></p>
    <div class="card" id="klist" style="overflow:hidden"></div>
  </div>`;
  senarai(); if (st.tab === 'kod') senaraiKod(true);

  $('#ftabs', page).onclick = (e) => { const b = e.target.closest('[data-tab]'); if (!b) return; location.hash = b.dataset.tab === 'kod' ? '#/formulari/kod' : '#/formulari'; };
  $('#q1', page).oninput = debounce((e) => { st.q = e.target.value; senarai(); }, 120);
  $('#q2', page).oninput = debounce((e) => { st.kq = e.target.value; senaraiKod(true); }, 120);
  $('#cats', page).onclick = (e) => { const b = e.target.closest('[data-cat]'); if (!b) return; st.kat = b.dataset.cat; $$('#cats .chip').forEach((c) => c.classList.toggle('on', c === b)); senarai(); };
  $('#kcats', page).onclick = (e) => { const b = e.target.closest('[data-k]'); if (!b) return; st.kmode = b.dataset.k; $$('#kcats .chip').forEach((c) => c.classList.toggle('on', c === b)); senaraiKod(true); };
  $('#grid', page).onclick = (e) => { const c = e.target.closest('[data-open]'); if (c) bukaFormulasi(Number(c.dataset.open)); };
  $('#grid', page).onkeydown = (e) => { if (e.key === 'Enter') { const c = e.target.closest('[data-open]'); if (c) bukaFormulasi(Number(c.dataset.open)); } };
  $('#klist', page).onclick = (e) => {
    const cp = e.target.closest('[data-copy]'); if (cp) { e.stopPropagation(); return salin(cp.dataset.copy, 'Disalin: ' + cp.dataset.copy); }
    if (e.target.closest('[data-more]')) { st.kshown += 60; return senaraiKod(false); }
    const r = e.target.closest('[data-kod]'); if (r && D.editor) editKod(r.dataset.kod);
  };
  const bb = $('#bBaru', page);
  if (bb) bb.onclick = () => (st.tab === 'kod' ? editKod('') : penyunting(null));
}

/* ---------------- senarai formulasi ---------------- */
function padan(f, terms) {
  if (!terms.length) return true;
  const s = [f.title, f.pcode, f.category, ...semuaBahan(f).flatMap((i) => [i.b, i.k, NAMA.get(i.k)])].join(' ').toLowerCase();
  return terms.every((t) => s.includes(t));
}
function senarai() {
  const terms = st.q.toLowerCase().split(/\s+/).filter(Boolean);
  const list = D.formulasi.filter((f) => (st.kat === '_arkib' ? !f.aktif : f.aktif && (st.kat === 'all' || f.category === st.kat)) && padan(f, terms))
    .sort((a, b) => a.title.localeCompare(b.title));
  $('#c1').textContent = list.length + ' sediaan';
  $('#grid').innerHTML = list.map((f) => `
    <article class="card fcard ${f.aktif ? '' : 'arkib'}" tabindex="0" data-open="${f.id}">
      <div class="row" style="gap:6px"><span class="badge">${esc(labelKat(f.category))}</span>${f.hasVariants ? `<span class="badge grey">${f.variants.length} formulasi</span>` : ''}${f.aktif ? '' : '<span class="badge warn">Diarkib</span>'}</div>
      <h4>${esc(f.title)}</h4>
      <div class="meta">${f.pcode ? `<span class="code" style="cursor:inherit">${esc(f.pcode)}</span>` : '<span>Tiada kod produk</span>'}<span>· ${semuaBahan(f).length} bahan</span></div>
    </article>`).join('') || `<div class="empty" style="grid-column:1/-1">${ic('search')}<p>Tiada sediaan dijumpai.</p></div>`;
}

/* ---------------- rujukan kod ---------------- */
function senaraiKod(reset) {
  if (reset) st.kshown = 60;
  const terms = st.kq.toLowerCase().split(/\s+/).filter(Boolean), hits = [];
  for (let i = 0; i < D.kod.length; i++) {
    const c = D.kod[i][0];
    if (st.kmode === 'used' && !GUNA.has(c)) continue;
    if (st.kmode === 'gt' && !c.startsWith('GT-')) continue;
    if (terms.every((t) => KOD_LC[i].includes(t))) hits.push(i);
  }
  $('#c2').textContent = hits.length + ' item' + (hits.length > st.kshown ? ` (dipaparkan ${st.kshown})` : '') + (D.editor ? ' · klik baris untuk edit' : ' · klik kod untuk salin');
  $('#klist').innerHTML = hits.slice(0, st.kshown).map((i) => {
    const [c, n] = D.kod[i];
    return `<div class="kod-row ${GUNA.has(c) ? 'used' : ''}" data-kod="${esc(c)}" ${D.editor ? 'style="cursor:pointer"' : ''}><span class="code" data-copy="${esc(c)}">${esc(c)}</span><div class="nm">${esc(n)}</div><button class="btn ghost icon sm" data-copy="${esc(n)}" aria-label="Salin nama">${ic('copy')}</button></div>`;
  }).join('') + (hits.length > st.kshown ? `<div style="padding:12px;text-align:center"><button class="btn sm" data-more>Tunjuk lagi (${hits.length - st.kshown})</button></div>` : '')
    || `<div class="empty">${ic('search')}<p>Tiada item dijumpai.</p></div>`;
}

function editKod(kod) {
  const nama = kod ? NAMA.get(kod) || '' : '';
  const d = dialog({
    tajuk: kod ? 'Edit kod item' : 'Kod item baharu', saiz: 'sm',
    badan: `<form id="fk"><label class="field"><span>Kod</span><input class="in" name="kod" value="${esc(kod)}" ${kod ? 'readonly' : ''} required placeholder="cth 03-SO-020"></label>
      <label class="field"><span>Nama item</span><input class="in" name="nama" value="${esc(nama)}" required></label></form>`,
    kaki: `${kod ? `<button class="btn bad" data-padam>${ic('trash')} Buang</button><span class="spacer"></span>` : ''}<button class="btn" data-tutup>Batal</button><button class="btn pri" data-simpan>Simpan</button>`
  });
  const f = $('#fk', d);
  const hantar = (padam, btn) => sibuk(btn, async () => {
    try { await api('formulari.kod', { kod: f.kod.value, nama: f.nama.value, padam }); await muat(); d.close(); senaraiKod(false); toast(padam ? 'Kod dibuang' : 'Kod disimpan', 'ok'); }
    catch (e) { ralat(e); }
  });
  $('[data-simpan]', d).onclick = (e) => hantar(false, e.currentTarget);
  const p = $('[data-padam]', d);
  if (p) p.onclick = async (e) => { const b = e.currentTarget; if (await sahkan('Buang kod ' + kod + ' daripada senarai rujukan?', { bahaya: true, ya: 'Buang' })) hantar(true, b); };
}

/* ---------------- butiran formulasi ---------------- */
function htmlBahan(d) {
  return `<ul class="ings">${(d.ingredients || []).map((i, n) => `
    <li><span class="n">${n + 1}</span><div><div style="font-weight:700">${esc(i.b)}</div>
      ${i.k ? `<div class="k"><span class="code" data-copy="${esc(i.k)}">${esc(i.k)}</span><span class="small muted">${esc(NAMA.get(i.k) || 'Kod tiada dalam senarai')}</span>${i.s ? '<span class="badge warn">Padanan terbaik — sila semak</span>' : ''}</div>` : '<div class="small muted">Tiada kod item</div>'}
    </div><span class="q">${esc(i.q)}</span></li>`).join('')}
    ${d.total ? `<li class="tot"><span>JUMLAH ISIPADU</span><span>${esc(d.total)}</span></li>` : ''}</ul>
    <div class="row" style="margin-top:10px;gap:6px"><span class="small muted">Salin senarai:</span>
      <button class="btn sm" data-list="kod">Kod</button><button class="btn sm" data-list="nama">Nama</button><button class="btn sm" data-list="semua">Kod + nama + kuantiti</button></div>`;
}
function htmlLangkah(d) {
  return `<ol class="steps">${(d.method || []).map((s, n) => { const nota = /^nota:/i.test(s); return `<li class="${nota ? 'note' : ''}"><span class="n">${nota ? '!' : n + 1}</span><p>${teksKaya(s)}</p></li>`; }).join('')}</ol>`;
}

function bukaFormulasi(id) {
  const f = D.formulasi.find((x) => x.id === id);
  if (!f) return toast('Formulasi tidak dijumpai', 'bad');
  let v = 0;
  const data = () => (f.hasVariants ? f.variants[v] : f);
  const d = dialog({
    tajuk: f.title, badge: labelKat(f.category), saiz: 'lg',
    onClose: () => { if (location.hash.startsWith('#/formulari/' + id)) history.replaceState(null, '', '#/formulari'); },
    badan: `
      ${!f.aktif ? '<div class="note-box">Formulasi ini <b>diarkib</b> dan tidak dipaparkan kepada staf.</div>' : ''}
      ${(f.notes || []).map((x) => `<div class="note-box">${teksKaya(x)}</div>`).join('')}
      <div class="card" style="padding:12px 14px;display:flex;align-items:center;gap:12px;flex-wrap:wrap;box-shadow:none">
        <div style="flex:1;min-width:180px"><div class="small muted">Kod produk siap</div>
          ${f.pcode ? `<div class="small">${esc(NAMA.get(f.pcode) || '')}</div>` : '<div class="small muted">Tiada kod untuk produk ini</div>'}</div>
        ${f.pcode ? `<span class="code" data-copy="${esc(f.pcode)}">${esc(f.pcode)}</span>` : ''}
      </div>
      ${f.hasVariants ? `<div class="h5">Pilih formulasi</div><div class="vtabs" id="vt">${f.variants.map((x, i) => `<button data-v="${i}" class="${i === 0 ? 'on' : ''}">${esc(x.name)}<small>${esc(x.description || '')}</small></button>`).join('')}</div>` : ''}
      <div class="h5">Bahan</div><div id="mb"></div>
      <div class="h5">Kaedah penyediaan</div><div id="ml"></div>
      <div class="h5">Kestabilan &amp; simpanan</div>
      <div class="info2"><div><h5>Tempoh luput</h5><p>${esc(f.expiry || '-')}</p></div><div><h5>Simpanan</h5><p>${esc(f.storage || '-')}</p></div></div>
      <p class="small muted" style="margin:16px 0 0">Versi ${f.versi}${f.dikemaskiniOleh ? ' · dikemas kini oleh ' + esc(f.dikemaskiniOleh) + ' · ' + esc(masaRingkas(f.dikemaskiniPada)) : ''}</p>`,
    kaki: D.editor ? `<button class="btn" data-sejarah>${ic('history')} Sejarah versi</button><button class="btn" data-arkib>${ic('archive')} ${f.aktif ? 'Arkib' : 'Aktifkan'}</button><span class="spacer"></span><button class="btn pri" data-edit>${ic('edit')} Edit</button>` : ''
  });
  const isi = () => { $('#mb', d).innerHTML = htmlBahan(data()); $('#ml', d).innerHTML = htmlLangkah(data()); };
  isi();
  d.addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copy]'); if (cp) return salin(cp.dataset.copy, 'Disalin: ' + cp.dataset.copy);
    const vb = e.target.closest('[data-v]'); if (vb) { v = Number(vb.dataset.v); $$('#vt button', d).forEach((b, i) => b.classList.toggle('on', i === v)); return isi(); }
    const ls = e.target.closest('[data-list]');
    if (ls) {
      const rows = (data().ingredients || []).map((i) => ({ k: i.k || '', n: (i.k && NAMA.get(i.k)) || i.b, q: i.q }));
      if (ls.dataset.list === 'kod') return salin(rows.map((r) => r.k).filter(Boolean).join('\n'), 'Semua kod disalin');
      if (ls.dataset.list === 'nama') return salin(rows.map((r) => r.n).join('\n'), 'Semua nama disalin');
      return salin(rows.map((r) => [r.k || '-', r.n, r.q].join('\t')).join('\n'), 'Disalin (sedia tampal ke Excel)');
    }
    if (e.target.closest('[data-edit]')) { d.close(); return penyunting(f); }
    if (e.target.closest('[data-sejarah]')) return sejarah(f);
    const ar = e.target.closest('[data-arkib]');
    if (ar) {
      sahkan(f.aktif ? 'Arkib formulasi ini? Staf tidak akan melihatnya lagi.' : 'Aktifkan semula formulasi ini?', { ya: f.aktif ? 'Arkib' : 'Aktifkan', bahaya: f.aktif })
        .then((ok) => ok && sibuk(ar, async () => {
          try { await api('formulari.arkib', { id: f.id, aktif: !f.aktif }); await muat(true); d.close(); senarai(); toast('Dikemas kini', 'ok'); } catch (err) { ralat(err); }
        }));
    }
  });
}

/* ---------------- sejarah versi ---------------- */
async function sejarah(f) {
  const d = dialog({ tajuk: 'Sejarah versi', badge: f.title, badan: '<div class="skel" style="height:160px"></div>' });
  try {
    const vs = await api('formulari.versi', { id: f.id });
    $('.dlg-b', d).innerHTML = `<p class="small muted" style="margin:0 0 12px">Setiap simpanan disimpan sebagai versi. Pulihkan versi lama jika perlu — ia disimpan sebagai versi baharu.</p>
      <table class="tbl"><thead><tr><th>Versi</th><th>Tindakan</th><th>Oleh</th><th>Masa</th><th></th></tr></thead><tbody>
      ${vs.map((x, i) => `<tr><td><b>v${x.versi}</b>${i === 0 ? ' <span class="badge ok">Semasa</span>' : ''}</td><td>${esc(x.tindakan)}</td><td>${esc(x.oleh)}</td><td class="small">${esc(masaRingkas(x.masa))}</td>
        <td>${i > 0 && x.tindakan !== 'ARKIB' && x.tindakan !== 'AKTIFKAN' ? `<button class="btn sm" data-pulih="${x.versi}">Pulihkan</button>` : ''}</td></tr>`).join('')}</tbody></table>`;
    d.addEventListener('click', async (e) => {
      const b = e.target.closest('[data-pulih]'); if (!b) return;
      if (!(await sahkan('Pulihkan v' + b.dataset.pulih + '? Kandungan semasa akan digantikan (versi semasa masih tersimpan dalam sejarah).', { ya: 'Pulihkan' }))) return;
      sibuk(b, async () => {
        try { await api('formulari.pulih', { id: f.id, versi: Number(b.dataset.pulih) }); await muat(true); d.close(); senarai(); toast('Versi dipulihkan', 'ok'); bukaFormulasi(f.id); }
        catch (err) { ralat(err); }
      });
    });
  } catch (e) { $('.dlg-b', d).innerHTML = `<p>${esc(e.message)}</p>`; }
}

/* ---------------- penyunting ---------------- */
function barisBahan(i = {}) {
  return `<div class="ed-ing"><input class="in" data-f="b" placeholder="Nama bahan" value="${esc(i.b || '')}">
    <input class="in" data-f="q" placeholder="Kuantiti" value="${esc(i.q || '')}">
    <input class="in" data-f="k" placeholder="Kod item" list="dlKod" value="${esc(i.k || '')}">
    <button type="button" class="btn ghost icon" data-buang aria-label="Buang bahan">${ic('x')}</button></div>`;
}
function blokVarian(v = {}, n = 0) {
  return `<div class="ed-var" data-var><div class="row" style="margin-bottom:10px"><b>Formulasi ${n + 1}</b><span class="spacer"></span><button type="button" class="btn sm bad" data-buangvar>${ic('trash')} Buang</button></div>
    <div class="grid g2" style="gap:0 14px"><label class="field"><span>Nama</span><input class="in" data-vf="name" value="${esc(v.name || 'Formulasi ' + (n + 1))}"></label>
    <label class="field"><span>Keterangan</span><input class="in" data-vf="description" value="${esc(v.description || '')}"></label></div>
    ${blokBahanLangkah(v)}</div>`;
}
function blokBahanLangkah(d = {}) {
  return `<div class="field"><span>Bahan</span><div data-ings>${(d.ingredients && d.ingredients.length ? d.ingredients : [{}]).map(barisBahan).join('')}</div>
      <button type="button" class="btn sm" data-tambahbahan style="align-self:flex-start">${ic('plus')} Tambah bahan</button></div>
    <label class="field"><span>Jumlah isipadu</span><input class="in" data-vf="total" value="${esc(d.total || '')}" placeholder="cth 5.00 mL"></label>
    <label class="field"><span>Kaedah penyediaan</span><textarea class="in" data-vf="method" rows="7" placeholder="Satu langkah setiap baris. Mula dengan 'Nota:' untuk nota.">${esc((d.method || []).join('\n'))}</textarea><small>Satu langkah setiap baris. Baris bermula "Nota:" dipaparkan sebagai nota.</small></label>`;
}

function penyunting(f) {
  const baru = !f;
  const x = f ? JSON.parse(JSON.stringify(f)) : { category: (D.kategori[0] || {}).nilai || 'GUTTAE', ingredients: [{}], method: [] };
  const d = dialog({
    tajuk: baru ? 'Formulasi baharu' : 'Edit: ' + f.title, saiz: 'lg',
    badan: `<form id="fe" autocomplete="off">
      <datalist id="dlKod"></datalist>
      <div class="grid g2" style="gap:0 14px">
        <label class="field"><span>Tajuk sediaan *</span><input class="in" name="title" value="${esc(x.title || '')}" required></label>
        <label class="field"><span>Kategori *</span><select class="in" name="category">${D.kategori.map((k) => `<option value="${esc(k.nilai)}" ${k.nilai === x.category ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select></label>
        <label class="field"><span>Kod produk siap</span><input class="in" name="pcode" list="dlKod" value="${esc(x.pcode || '')}" placeholder="cth GT-AM-003"></label>
        <label class="field" style="justify-content:flex-end"><span class="switch"><input type="checkbox" name="hasVariants" ${x.hasVariants ? 'checked' : ''}> Ada beberapa formulasi (varian)</span></label>
      </div>
      <div id="badanUtama">${x.hasVariants ? '' : blokBahanLangkah(x)}</div>
      <div id="badanVarian">${x.hasVariants ? x.variants.map(blokVarian).join('') + `<button type="button" class="btn sm" data-tambahvar>${ic('plus')} Tambah formulasi</button>` : ''}</div>
      <div class="grid g2" style="gap:0 14px;margin-top:6px">
        <label class="field"><span>Tempoh luput</span><input class="in" name="expiry" value="${esc(x.expiry || '')}"></label>
        <label class="field"><span>Simpanan</span><input class="in" name="storage" value="${esc(x.storage || '')}"></label>
      </div>
      <label class="field"><span>Nota penting</span><textarea class="in" name="notes" rows="3" placeholder="Satu nota setiap baris. Guna **teks** untuk huruf tebal.">${esc((x.notes || []).join('\n'))}</textarea></label>
    </form>`,
    kaki: `<button class="btn" data-tutup>Batal</button><button class="btn pri" data-simpan>${ic('check')} Simpan${baru ? '' : ' (v' + (f.versi + 1) + ')'}</button>`
  });
  const fe = $('#fe', d);
  // datalist kod: diisi ikut taipan supaya ringan
  const dl = $('#dlKod', d);
  fe.addEventListener('input', debounce((e) => {
    if (!e.target.matches('[data-f=k],[name=pcode]')) return;
    const q = e.target.value.toLowerCase(); if (q.length < 2) return;
    const out = [];
    for (let i = 0; i < D.kod.length && out.length < 30; i++) if (KOD_LC[i].includes(q)) out.push(`<option value="${esc(D.kod[i][0])}">${esc(D.kod[i][1])}</option>`);
    dl.innerHTML = out.join('');
  }, 100));
  fe.addEventListener('change', (e) => {
    if (e.target.name !== 'hasVariants') return;
    const semasa = kumpul(true);
    if (e.target.checked) {
      $('#badanUtama', d).innerHTML = '';
      $('#badanVarian', d).innerHTML = blokVarian({ name: 'Formulasi 1', ingredients: semasa.ingredients, total: semasa.total, method: semasa.method }, 0) + `<button type="button" class="btn sm" data-tambahvar>${ic('plus')} Tambah formulasi</button>`;
    } else {
      const v0 = (semasa.variants || [])[0] || {};
      $('#badanVarian', d).innerHTML = '';
      $('#badanUtama', d).innerHTML = blokBahanLangkah(v0);
    }
  });
  d.addEventListener('click', (e) => {
    if (e.target.closest('[data-tambahbahan]')) { e.target.closest('.field').querySelector('[data-ings]').insertAdjacentHTML('beforeend', barisBahan()); return; }
    const bb = e.target.closest('[data-buang]'); if (bb) { const w = bb.closest('[data-ings]'); if (w.children.length > 1) bb.closest('.ed-ing').remove(); else bb.closest('.ed-ing').querySelectorAll('input').forEach((i) => (i.value = '')); return; }
    if (e.target.closest('[data-tambahvar]')) { const n = $$('[data-var]', d).length; e.target.closest('[data-tambahvar]').insertAdjacentHTML('beforebegin', blokVarian({}, n)); return; }
    const bv = e.target.closest('[data-buangvar]'); if (bv) { if ($$('[data-var]', d).length > 1) bv.closest('[data-var]').remove(); else toast('Sekurang-kurangnya satu formulasi'); }
  });

  function bahanDari(el) {
    return $$('.ed-ing', el).map((r) => ({ b: $('[data-f=b]', r).value.trim(), q: $('[data-f=q]', r).value.trim(), k: $('[data-f=k]', r).value.trim().toUpperCase() || null }))
      .filter((i) => i.b || i.q || i.k);
  }
  const baris = (s) => s.split('\n').map((t) => t.trim()).filter(Boolean);
  function kumpul(longgar) {
    const o = { title: fe.elements.title.value.trim(), category: fe.category.value, pcode: fe.pcode.value.trim().toUpperCase() || null, expiry: fe.expiry.value.trim(), storage: fe.storage.value.trim(), notes: baris(fe.notes.value) };
    if (fe.hasVariants.checked) {
      o.hasVariants = true;
      o.variants = $$('[data-var]', d).map((v) => ({ name: $('[data-vf=name]', v).value.trim(), description: $('[data-vf=description]', v).value.trim(), ingredients: bahanDari(v), total: $('[data-vf=total]', v).value.trim(), method: baris($('[data-vf=method]', v).value) }));
    } else {
      const u = $('#badanUtama', d);
      o.ingredients = bahanDari(u); o.total = ($('[data-vf=total]', u) || {}).value || ''; o.method = baris(($('[data-vf=method]', u) || {}).value || '');
    }
    // tanda 's' (padanan terbaik) dikekalkan jika bahan & kod tidak berubah
    if (!longgar && f) {
      const lama = new Map(semuaBahan(f).map((i) => [i.b + '|' + i.k, i.s]));
      const tanda = (arr) => arr.forEach((i) => { if (lama.get(i.b + '|' + i.k)) i.s = true; });
      if (o.hasVariants) o.variants.forEach((v) => tanda(v.ingredients)); else tanda(o.ingredients);
    }
    return o;
  }
  $('[data-simpan]', d).onclick = (e) => {
    const o = kumpul(false);
    if (!o.title) return ralat('Tajuk sediaan wajib diisi.');
    const kodTiada = (o.hasVariants ? o.variants.flatMap((v) => v.ingredients) : o.ingredients).filter((i) => i.k && !NAMA.has(i.k)).map((i) => i.k);
    const teruskan = kodTiada.length ? sahkan('Kod berikut tiada dalam senarai rujukan: ' + kodTiada.join(', ') + '. Simpan juga?', { ya: 'Simpan' }) : Promise.resolve(true);
    teruskan.then((ok) => ok && sibuk(e.target.closest('button'), async () => {
      try {
        const r = await api('formulari.simpan', { id: f ? f.id : null, versi: f ? f.versi : null, data: o });
        await muat(true); d.close(); senarai(); toast('Disimpan sebagai v' + r.versi, 'ok'); bukaFormulasi(r.id);
      } catch (err) { ralat(err); }
    }));
  };
}
