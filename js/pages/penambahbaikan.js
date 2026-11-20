// Penambahbaikan Berterusan — staf merekod penambahbaikan (format Laporan: Aspek · Perihal · Sebelum · Selepas + gambar).
// Cetakan A4: (1) Laporan Penambahbaikan Berterusan (melintang) · (2) Kertas Kerja Cadangan Penambahbaikan (tegak),
// dijana automatik daripada satu rekod dan boleh disunting sebelum disimpan & dicetak.
import { S, tajuk } from '../app.js';
import { api } from '../api.js';
import { $, $$, esc, toast, ralat, sibuk, dialog, sahkan, masaRingkas } from '../ui.js';
import { ic } from '../icons.js';

const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const dmy = (s) => (s ? s.split('-').reverse().join('/') : '');
const para = (t) => esc(t || '').replace(/\n/g, '<br>');
const BESAR = (s) => String(s || '').toLocaleUpperCase('ms-MY');

let D = null, P = null;
const st = { q: '', tahun: String(new Date().getFullYear()), aspek: '', saya: false };
const GB = new Map(); // cache gambar: id → data URL

export async function papar(page) {
  tajuk('Penambahbaikan');
  P = page;
  if (!D) page.innerHTML = '<div class="skel" style="height:320px;margin-top:8px"></div>'; else lukis();
  try { D = await api('pb.data'); lukis(); }
  catch (e) { page.innerHTML = `<div class="card empty">${ic('alert')}<p>${esc(e.message)}</p></div>`; }
}

/* ---------------- senarai ---------------- */
const tahunList = () => [...new Set([String(new Date().getFullYear()), ...D.rekod.map((r) => r.tarikh.slice(0, 4))])].filter(Boolean).sort().reverse();
function tapis() {
  const q = st.q.toLowerCase(), me = String(S.me.stafId).toLowerCase();
  return D.rekod.filter((r) => (!st.tahun || r.tarikh.startsWith(st.tahun)) && (!st.aspek || r.aspek === st.aspek)
    && (!st.saya || r.olehId.toLowerCase() === me)
    && (!q || `${r.tajuk} ${r.sebelum} ${r.selepas} ${r.aspek} ${r.olehNama} ${r.ahli}`.toLowerCase().includes(q)));
}
function lukis() {
  const L = tapis();
  P.innerHTML = `<div class="row pb-alat" style="margin:6px 0 12px">
      <div class="search" style="flex:1 1 220px">${ic('search')}<input class="in" id="pq" type="search" placeholder="Cari perihal, sebelum, selepas, staf" value="${esc(st.q)}"></div>
      <select class="in" id="pT" style="width:auto"><option value="">Semua tahun</option>${tahunList().map((y) => `<option ${y === st.tahun ? 'selected' : ''}>${y}</option>`).join('')}</select>
      <select class="in" id="pA" style="width:auto;max-width:260px"><option value="">Semua aspek</option>${D.aspek.map((a) => `<option value="${esc(a.nilai)}" ${a.nilai === st.aspek ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}</select>
      <button class="chip ${st.saya ? 'on' : ''}" id="pS">${ic('user')} Saya sahaja</button></div>
    <div class="row" style="margin:0 0 14px;gap:8px">
      <button class="btn pri" id="pBaru">${ic('plus')} Rekod penambahbaikan</button><span class="spacer"></span>
      <button class="btn" id="pKK">${ic('edit')} Kertas kerja</button>
      <button class="btn" id="pLap">${ic('print')} Cetak laporan</button></div>
    <p class="small muted" style="margin:0 0 10px">${L.length} penambahbaikan${st.tahun ? ' pada ' + st.tahun : ''}. Rekod ikut format Laporan Penambahbaikan Berterusan; Kertas Kerja dijana daripada rekod.</p>
    ${L.length ? `<div class="grid g2 pb-grid">${L.map(kad).join('')}</div>`
      : `<div class="card empty">${ic('bulb')}<p style="margin:0">Belum ada penambahbaikan${st.tahun ? ' bagi ' + st.tahun : ''}. Klik "Rekod penambahbaikan" untuk mula.</p></div>`}`;
  const segar = () => lukis();
  $('#pq', P).oninput = (e) => { st.q = e.target.value; const pos = e.target.selectionStart; segar(); const n = $('#pq', P); n.focus(); n.setSelectionRange(pos, pos); };
  $('#pT', P).onchange = (e) => { st.tahun = e.target.value; segar(); };
  $('#pA', P).onchange = (e) => { st.aspek = e.target.value; segar(); };
  $('#pS', P).onclick = () => { st.saya = !st.saya; segar(); };
  $('#pBaru', P).onclick = () => borang(null);
  $('#pKK', P).onclick = () => pilihKK();
  $('#pLap', P).onclick = () => dialogLaporan();
  P.onclick = (e) => { const k = e.target.closest('[data-pb]'); if (k) butiran(k.dataset.pb); };
}
const ringkas = (t, n = 160) => { t = String(t || '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n) + '…' : t; };
function kad(r) {
  return `<article class="card pad pb-kad click" data-pb="${esc(r.id)}">
    <div class="row" style="gap:6px;margin-bottom:6px"><span class="badge">${esc(r.aspek)}</span>${r.kk ? '<span class="badge ok">Kertas kerja</span>' : ''}<span class="spacer"></span><span class="small muted">${esc(dmy(r.tarikh))}</span></div>
    <b class="pb-t">${esc(r.tajuk)}</b>
    <div class="pb-ss"><div><small>Sebelum</small><p>${esc(ringkas(r.sebelum))}</p></div><div><small>Selepas</small><p>${esc(ringkas(r.selepas))}</p></div></div>
    <div class="small muted row" style="gap:10px;margin-top:8px"><span>${ic('user')} ${esc(r.olehNama)}</span>${r.gambar.length ? `<span>${ic('image')} ${r.gambar.length} gambar</span>` : ''}</div></article>`;
}

/* ---------------- gambar ---------------- */
async function gambar(id) {
  if (GB.has(id)) return GB.get(id);
  const r = await api('pb.gambar', { id });
  GB.set(id, r.data); return r.data;
}
async function isiGambar(root) {
  await Promise.all($$('img[data-gid]', root).map(async (im) => { try { im.src = await gambar(im.dataset.gid); } catch (e) { im.alt = 'Gambar gagal dimuat'; } }));
}
async function kecilkan(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Fail bukan imej yang sah: ' + file.name)); i.src = url; });
    for (const [maks, q] of [[1600, 0.82], [1280, 0.78], [1024, 0.72], [800, 0.65]]) {
      const k = Math.min(1, maks / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL('image/jpeg', q);
      if (d.length <= 1900000) return d;
    }
    throw new Error('Imej terlalu besar: ' + file.name);
  } finally { URL.revokeObjectURL(url); }
}

/* ---------------- butiran ---------------- */
function butiran(id) {
  const r = D.rekod.find((x) => x.id === id); if (!r) return;
  const d = dialog({
    tajuk: r.tajuk, badge: r.aspek, saiz: 'lg',
    badan: `<div class="pb-ss besar"><div><small>Sebelum</small><p>${para(r.sebelum)}</p></div><div><small>Selepas</small><p>${para(r.selepas)}</p></div></div>
      ${r.gambar.length ? `<div class="pb-gal">${r.gambar.map((g) => `<figure><img data-gid="${esc(g.id)}" alt="${esc(g.kapsyen)}"><figcaption>${esc(g.kapsyen)}</figcaption></figure>`).join('')}</div>` : ''}
      <dl class="kv" style="margin-top:14px"><dt>Tarikh</dt><dd>${esc(dmy(r.tarikh))}</dd><dt>Direkod oleh</dt><dd>${esc(r.olehNama)}</dd>
      ${r.ahli ? `<dt>Ahli projek</dt><dd>${esc(r.ahli)}</dd>` : ''}<dt>Kertas kerja</dt><dd>${r.kk ? 'Telah disimpan' : 'Belum (draf automatik)'}</dd>
      ${r.dikemaskini ? `<dt>Dikemas kini</dt><dd>${esc(r.dikemaskiniOleh)} · ${esc(masaRingkas(r.dikemaskini))}</dd>` : ''}</dl>`,
    kaki: `${r.boleh ? `<button class="btn bad" data-padam>${ic('trash')} Padam</button>` : ''}<span class="spacer"></span>
      <button class="btn" data-kk>${ic('print')} Kertas kerja</button>${r.boleh ? `<button class="btn pri" data-ubah>${ic('edit')} Ubah</button>` : ''}`
  });
  isiGambar(d);
  const on = (s, fn) => { const b = $(s, d); if (b) b.onclick = fn; };
  on('[data-ubah]', () => { d.close(); borang(r); });
  on('[data-kk]', () => { d.close(); editorKK(r); });
  on('[data-padam]', async (e) => {
    const b = e.currentTarget;
    if (!(await sahkan(`Padam penambahbaikan "${r.tajuk}" beserta ${r.gambar.length} gambar?`, { ya: 'Padam', bahaya: true }))) return;
    sibuk(b, async () => { try { await api('pb.padam', { id: r.id }); D.rekod = D.rekod.filter((x) => x.id !== r.id); d.close(); toast('Dipadam', 'ok'); lukis(); } catch (err) { ralat(err); } });
  });
}

/* ---------------- borang rekod ---------------- */
function borang(r) {
  const baru = !r;
  r = r || { tarikh: iso(new Date()), aspek: (D.aspek[0] || {}).nilai || '', tajuk: '', sebelum: '', selepas: '', ahli: '', gambar: [] };
  const G = r.gambar.map((g) => ({ id: g.id, kapsyen: g.kapsyen })); // senarai kerja gambar: {id} sedia ada atau {data} baharu
  const d = dialog({
    tajuk: baru ? 'Rekod penambahbaikan' : 'Ubah penambahbaikan', saiz: 'lg',
    badan: `<form id="fpb" autocomplete="off">
      <div class="grid g2" style="gap:0 14px">
        <label class="field"><span>Tarikh dilaksanakan *</span><input class="in" type="date" name="tarikh" value="${esc(r.tarikh)}" required></label>
        <label class="field"><span>Aspek *</span><select class="in" name="aspek">${D.aspek.map((a) => `<option value="${esc(a.nilai)}" ${a.nilai === r.aspek ? 'selected' : ''}>${esc(a.label)}</option>`).join('')}${r.aspek && !D.aspek.some((a) => a.nilai === r.aspek) ? `<option selected>${esc(r.aspek)}</option>` : ''}</select></label></div>
      <label class="field"><span>Jenis / perihal penambahbaikan *</span><input class="in" name="tajuk" maxlength="300" value="${esc(r.tajuk)}" placeholder="cth Template pengiraan TPN"></label>
      <label class="field"><span>Sebelum *</span><textarea class="in" name="sebelum" rows="4" maxlength="5000" placeholder="Keadaan / masalah sebelum penambahbaikan">${esc(r.sebelum)}</textarea></label>
      <label class="field"><span>Selepas *</span><textarea class="in" name="selepas" rows="5" maxlength="5000" placeholder="Apa yang dibuat dan kesannya (cth jimat masa, kurang kesalahan)">${esc(r.selepas)}</textarea></label>
      <label class="field"><span>Ahli projek (pilihan)</span><input class="in" name="ahli" maxlength="500" value="${esc(r.ahli)}" placeholder="cth Tuan Umar, Nik Azira"></label>
      <div class="field"><span>Gambar (maks ${D.maksGambar}) — cth sebelum & selepas</span><div id="gList" class="pb-gedit"></div>
        <label class="btn sm" style="margin-top:8px;width:max-content">${ic('camera')} Tambah gambar<input type="file" accept="image/*" multiple hidden id="gIn"></label></div>
    </form>`,
    kaki: `<button class="btn" data-tutup>Batal</button><button class="btn pri" data-simpan>${ic('check')} Simpan</button>`
  });
  const f = $('#fpb', d), gl = $('#gList', d);
  const lukisG = () => {
    gl.innerHTML = G.map((g, i) => `<div class="pb-gi"><img ${g.data ? `src="${g.data}"` : `data-gid="${esc(g.id)}"`} alt=""><input class="in" data-kap="${i}" maxlength="200" placeholder="Kapsyen (cth Sebelum)" value="${esc(g.kapsyen || '')}"><button type="button" class="btn ghost icon" data-buang="${i}" aria-label="Buang gambar">${ic('x')}</button></div>`).join('') || '<p class="small muted" style="margin:0">Tiada gambar.</p>';
    isiGambar(gl);
  };
  lukisG();
  gl.oninput = (e) => { const i = e.target.dataset.kap; if (i !== undefined) G[i].kapsyen = e.target.value; };
  gl.onclick = (e) => { const b = e.target.closest('[data-buang]'); if (b) { G.splice(Number(b.dataset.buang), 1); lukisG(); } };
  $('#gIn', d).onchange = async (e) => {
    const fs = [...e.target.files]; e.target.value = '';
    if (G.length + fs.length > D.maksGambar) return toast(`Maksimum ${D.maksGambar} gambar.`, 'bad');
    for (const fl of fs) { try { G.push({ data: await kecilkan(fl), kapsyen: G.length === 0 ? 'Sebelum' : G.length === 1 ? 'Selepas' : '' }); } catch (err) { ralat(err); } }
    lukisG();
  };
  $('[data-simpan]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    const v = (n) => f[n].value.trim();
    if (!v('tajuk') || !v('sebelum') || !v('selepas')) return toast('Isi Jenis/perihal, Sebelum dan Selepas.', 'bad');
    try {
      const x = await api('pb.simpan', { id: baru ? '' : r.id, tarikh: v('tarikh'), aspek: f.aspek.value, tajuk: v('tajuk'), sebelum: v('sebelum'), selepas: v('selepas'), ahli: v('ahli'),
        gambar: G.map((g) => (g.id ? { id: g.id, kapsyen: g.kapsyen || '' } : { data: g.data, kapsyen: g.kapsyen || '' })) });
      G.forEach((g, i) => { if (g.data && x.gambar[i]) GB.set(x.gambar[i].id, g.data); });
      D.rekod = [x, ...D.rekod.filter((y) => y.id !== x.id)].sort((a, b) => (a.tarikh < b.tarikh ? 1 : a.tarikh > b.tarikh ? -1 : 0));
      d.close(); toast(baru ? 'Penambahbaikan direkod' : 'Disimpan', 'ok');
      if (!x.tarikh.startsWith(st.tahun)) st.tahun = x.tarikh.slice(0, 4);
      lukis();
    } catch (err) { ralat(err); }
  });
}

/* ---------------- kertas kerja ---------------- */
function drafKK(r) {
  const ayat = String(r.selepas || '').split(/(?<=[.!?])\s+|\n+/).map((s) => s.trim()).filter(Boolean);
  return {
    projek: BESAR(r.tajuk),
    permasalahan: r.sebelum,
    cadangan: ayat[0] || r.selepas,
    implikasi: ayat.length > 1 ? ayat.slice(1).join(' ') : r.selepas,
    disediakan: BESAR(r.olehNama),
    jawatan: r.olehJawatan || 'Pegawai Farmasi UPAR',
    pelulus: (D.cetak && D.cetak.pelulus) || 'Ketua Unit UPAR'
  };
}
function pilihKK() {
  const L = tapis();
  if (!D.rekod.length) return toast('Rekod penambahbaikan dahulu sebelum menjana kertas kerja.', 'bad');
  const d = dialog({
    tajuk: 'Kertas kerja — pilih penambahbaikan', saiz: 'lg',
    badan: `<p class="small muted" style="margin:0 0 10px">Kertas kerja dijana automatik daripada rekod (Projek, Permasalahan, Cadangan, Implikasi). Anda boleh betulkan sebelum simpan & cetak.</p>
      <div class="search" style="margin-bottom:10px">${ic('search')}<input class="in" id="kq" type="search" placeholder="Cari"></div><div id="kl" class="pb-pilih"></div>`
  });
  const isi = (q) => {
    q = q.toLowerCase();
    $('#kl', d).innerHTML = (q ? D.rekod : L.length ? L : D.rekod).filter((r) => !q || `${r.tajuk} ${r.aspek} ${r.olehNama}`.toLowerCase().includes(q))
      .map((r) => `<button type="button" class="pb-pi" data-id="${esc(r.id)}"><b>${esc(r.tajuk)}</b><small>${esc(dmy(r.tarikh))} · ${esc(r.aspek)} · ${esc(r.olehNama)}${r.kk ? ' · <span class="badge ok">disimpan</span>' : ''}</small></button>`).join('') || '<p class="muted small">Tiada padanan.</p>';
  };
  isi('');
  $('#kq', d).oninput = (e) => isi(e.target.value);
  $('#kl', d).onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) { d.close(); editorKK(D.rekod.find((x) => x.id === b.dataset.id)); } };
}
function editorKK(r) {
  const k = { ...drafKK(r), ...(r.kk || {}) };
  const ta = (n, l, rows) => `<label class="field"><span>${l}</span><textarea class="in" name="${n}" rows="${rows}">${esc(k[n])}</textarea></label>`;
  const d = dialog({
    tajuk: 'Kertas kerja cadangan penambahbaikan', badge: r.kk ? 'Disimpan' : 'Draf automatik', saiz: 'lg',
    badan: `<form id="fkk" autocomplete="off">
      <label class="field"><span>Projek</span><textarea class="in" name="projek" rows="2">${esc(k.projek)}</textarea></label>
      ${ta('permasalahan', 'Permasalahan', 4)}${ta('cadangan', 'Cadangan', 3)}${ta('implikasi', 'Implikasi', 4)}
      <div class="grid g2" style="gap:0 14px">
        <label class="field"><span>Dicadang / disediakan oleh</span><input class="in" name="disediakan" value="${esc(k.disediakan)}"></label>
        <label class="field"><span>Jawatan penyedia</span><input class="in" name="jawatan" value="${esc(k.jawatan)}"></label></div>
      <label class="field"><span>Diluluskan oleh (jawatan)</span><input class="in" name="pelulus" value="${esc(k.pelulus)}"></label>
      ${r.gambar.length ? `<label class="switch"><input type="checkbox" name="gambar" checked> Sertakan ${r.gambar.length} gambar sebagai lampiran</label>` : ''}
    </form>`,
    kaki: `${r.boleh && r.kk ? `<button class="btn ghost" data-semula>Set semula draf</button>` : ''}<span class="spacer"></span>
      ${r.boleh ? `<button class="btn" data-simpan>${ic('check')} Simpan</button>` : ''}<button class="btn pri" data-cetak>${ic('print')} ${r.boleh ? 'Simpan & cetak' : 'Cetak'}</button>`
  });
  const f = $('#fkk', d);
  const nilai = () => { const o = {}; ['projek', 'permasalahan', 'cadangan', 'implikasi', 'disediakan', 'jawatan', 'pelulus'].forEach((n) => (o[n] = f[n].value.trim())); return o; };
  const simpanKK = async () => { const x = await api('pb.kk', { id: r.id, kk: nilai() }); D.rekod = D.rekod.map((y) => (y.id === x.id ? x : y)); return x; };
  const on = (s, fn) => { const b = $(s, d); if (b) b.onclick = fn; };
  on('[data-simpan]', (e) => sibuk(e.currentTarget, async () => { try { await simpanKK(); toast('Kertas kerja disimpan', 'ok'); d.close(); lukis(); } catch (err) { ralat(err); } }));
  on('[data-semula]', async () => {
    if (!(await sahkan('Buang suntingan dan jana semula daripada rekod?', { ya: 'Set semula' }))) return;
    try { const x = await api('pb.kk', { id: r.id, kk: null }); D.rekod = D.rekod.map((y) => (y.id === x.id ? x : y)); d.close(); editorKK(x); } catch (err) { ralat(err); }
  });
  on('[data-cetak]', (e) => sibuk(e.currentTarget, async () => {
    const kk = nilai(); if (!kk.projek) return toast('Isi tajuk projek', 'bad');
    try { if (r.boleh) await simpanKK(); await cetakKK(r, kk, f.gambar ? f.gambar.checked : false); d.close(); lukis(); } catch (err) { ralat(err); }
  }));
}
async function cetakKK(r, k, denganGambar) {
  const unit = (D.cetak && D.cetak.unit) || 'UNIT PENDISPENSAN ASEPTIK & RADIOFARMASI';
  const html = `<div class="kk">
    <div class="kk-h"><b>KERTAS KERJA CADANGAN PENAMBAHBAIKAN</b><b>${esc(BESAR(unit))}</b></div>
    <p class="kk-pr"><b>PROJEK :</b> ${para(BESAR(k.projek))}</p>
    <h4>PERMASALAHAN :</h4><p>${para(k.permasalahan)}</p>
    <h4>CADANGAN :</h4><p>${para(k.cadangan)}</p>
    <h4>IMPLIKASI :</h4><p>${para(k.implikasi)}</p>
    ${denganGambar && r.gambar.length ? `<h4>LAMPIRAN GAMBAR :</h4><div class="kk-g">${r.gambar.map((g) => `<figure><img data-gid="${esc(g.id)}" alt=""><figcaption>${esc(g.kapsyen)}</figcaption></figure>`).join('')}</div>` : ''}
    <table class="kk-t"><tr><td>Dicadang / Disediakan Oleh :</td><td>Diluluskan oleh :</td></tr>
      <tr class="kk-sl"><td>……………………………………</td><td>……………………………………</td></tr>
      <tr><td><b>${esc(BESAR(k.disediakan))}</b><br>${esc(k.jawatan)}</td><td><b>${esc(k.pelulus)}</b></td></tr></table></div>`;
  await cetak(html, 'cetak-pbkk');
}

/* ---------------- laporan ---------------- */
function dialogLaporan() {
  const y = st.tahun || String(new Date().getFullYear()), kini = iso(new Date()).slice(0, 7);
  const d = dialog({
    tajuk: 'Cetak Laporan Penambahbaikan Berterusan', saiz: '',
    badan: `<div class="grid g2" style="gap:0 14px">
        <label class="field"><span>Dari bulan</span><input class="in" type="month" id="lD" value="${y}-01"></label>
        <label class="field"><span>Hingga bulan</span><input class="in" type="month" id="lH" value="${y === kini.slice(0, 4) ? kini : y + '-12'}"></label></div>
      <label class="field"><span>Aspek</span><select class="in" id="lA"><option value="">Semua aspek</option>${D.aspek.map((a) => `<option value="${esc(a.nilai)}">${esc(a.label)}</option>`).join('')}</select></label>
      <label class="switch"><input type="checkbox" id="lG"> Sertakan gambar kecil dalam lajur Selepas</label>
      <p class="small muted" id="lInfo" style="margin:10px 0 0"></p>`,
    kaki: `<button class="btn" data-tutup>Batal</button><button class="btn pri" data-cetak>${ic('print')} Cetak (A4 melintang)</button>`
  });
  const pilih = () => { const a = $('#lD', d).value, b = $('#lH', d).value, asp = $('#lA', d).value; return D.rekod.filter((r) => (!a || r.tarikh.slice(0, 7) >= a) && (!b || r.tarikh.slice(0, 7) <= b) && (!asp || r.aspek === asp)); };
  const info = () => { $('#lInfo', d).textContent = `${pilih().length} penambahbaikan akan dicetak.`; };
  d.oninput = info; d.onchange = info; info();
  $('[data-cetak]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    const L = pilih(); if (!L.length) return toast('Tiada penambahbaikan dalam tempoh ini.', 'bad');
    try { await cetakLaporan(L, $('#lD', d).value, $('#lH', d).value, $('#lG', d).checked); d.close(); } catch (err) { ralat(err); }
  });
}
const labelBulan = (ym) => (ym ? `${BESAR(BULAN[Number(ym.slice(5, 7)) - 1])} ${ym.slice(0, 4)}` : '');
function tempohTeks(a, b) {
  if (!a && !b) return '';
  if (a && b && a.slice(0, 4) === b.slice(0, 4)) return `(${BESAR(BULAN[Number(a.slice(5, 7)) - 1])} HINGGA ${labelBulan(b)})`;
  return `(${labelBulan(a) || '…'} HINGGA ${labelBulan(b) || '…'})`;
}
async function cetakLaporan(L, dari, hingga, denganGambar) {
  const urut = D.aspek.map((a) => a.nilai), unit = (D.cetak && D.cetak.unit) || 'UNIT PENDISPENSAN ASEPTIK & RADIOFARMASI';
  const kump = [...new Set(L.map((r) => r.aspek))].sort((a, b) => ((urut.indexOf(a) + 1) || 99) - ((urut.indexOf(b) + 1) || 99));
  const badan = kump.map((a) => {
    const xs = L.filter((r) => r.aspek === a).sort((p, q) => (p.tarikh < q.tarikh ? -1 : p.tarikh > q.tarikh ? 1 : 0));
    return `<tr class="lp-asp"><td colspan="4">ASPEK ${esc(BESAR(a))}</td></tr>` + xs.map((r, i) => `<tr><td class="c">${i + 1}</td><td>${para(r.tajuk)}</td><td>${para(r.sebelum)}</td>
      <td>${para(r.selepas)}${denganGambar && r.gambar.length ? `<div class="lp-g">${r.gambar.map((g) => `<img data-gid="${esc(g.id)}" alt="">`).join('')}</div>` : ''}</td></tr>`).join('');
  }).join('');
  const html = `<div class="lp">
    <img class="lp-logo" src="assets/logo-usm.jpg" alt="">
    <div class="lp-h"><b>LAPORAN PENAMBAHBAIKAN BERTERUSAN</b><b>${esc(BESAR(unit))}</b><b>${esc(tempohTeks(dari, hingga))}</b></div>
    <table class="lp-t"><colgroup><col style="width:6%"><col style="width:24%"><col style="width:35%"><col style="width:35%"></colgroup>
      <thead><tr><th rowspan="2">BIL</th><th rowspan="2">JENIS/PERIHAL</th><th colspan="2">PENAMBAHBAIKAN</th></tr><tr><th>SEBELUM</th><th>SELEPAS</th></tr></thead>
      <tbody>${badan}</tbody></table>
    <div class="lp-k"><p>Diselaraskan oleh:</p><br><br><p><b>${esc((D.cetak && D.cetak.ketuaNama) || '')}</b><br>${esc(BESAR((D.cetak && D.cetak.ketuaJawatan) || 'KETUA UNIT'))}<br>${esc(BESAR(unit))}</p></div></div>`;
  await cetak(html, 'cetak-pblap');
}

/* ---------------- cetak ---------------- */
async function cetak(html, kelas) {
  const el = document.createElement('div');
  el.id = 'cetak'; el.innerHTML = html;
  document.body.appendChild(el);
  await isiGambar(el);
  await Promise.all($$('img', el).map((im) => (im.complete ? null : im.decode().catch(() => null))));
  document.body.classList.add('mencetak', kelas);
  const habis = () => { el.remove(); document.body.classList.remove('mencetak', kelas); removeEventListener('afterprint', habis); };
  addEventListener('afterprint', habis);
  setTimeout(() => print(), 80);
}
