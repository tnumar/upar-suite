// Inventori — stor visual (kad + foto), bakul keluaran, imbas kod bar/QR, label 100×50 mm, lupus, kiraan stok & laporan.
import { S, tajuk, setBoot } from '../app.js';
import { api } from '../api.js';
import { $, $$, esc, toast, ralat, sibuk, dialog, sahkan, simpan, ambil, debounce, masaRingkas } from '../ui.js';
import { ic } from '../icons.js';

const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const STOK = { cukup: ['Mencukupi', 'ok'], rendah: ['Stok rendah', 'warn'], habis: ['Stok habis', 'bad'], negatif: ['Stok negatif', 'bad'], belum: ['Min. belum ditetapkan', 'grey'] };
const LUPUT = { luput: ['Telah luput', 'bad'], luput30: ['Luput ≤30 hari', 'warn'], luput90: ['Luput ≤90 hari', 'warn'], sah: ['Masih sah', 'ok'], tiada: ['Tiada tarikh luput', 'grey'], kosong: ['—', 'grey'] };
const JTX = { TERIMA: ['Terima', 'ok'], GUNA: ['Guna', 'warn'], LUPUS: ['Lupus', 'bad'], PELARASAN: ['Pelarasan', 'grey'] };
const WARNA_KAT = ['#0ea5e9', '#db2777', '#d97706', '#10b981', '#8b5cf6', '#ef4444'];
const LAPORAN = [
  ['baki', 'Baki stok semasa'], ['minimum', 'Stok di bawah paras minimum'], ['perancangan', 'Perancangan stok (min / menokok / maks)'], ['luput', 'Item luput & hampir luput'],
  ['penerimaan', 'Penerimaan stok'], ['pengeluaran', 'Penggunaan stok'], ['lupus', 'Pelupusan stok'], ['pelarasan', 'Pelarasan (kiraan stok)'],
  ['bulanan', 'Penggunaan bulanan'], ['tahunan', 'Rumusan stok tahunan'], ['item', 'Sejarah transaksi satu item'], ['analisis', 'Analisis tahunan (graf)']
];
const CDN = { qr: 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js', bar: 'https://cdn.jsdelivr.net/npm/jsbarcode@3.11.6/dist/JsBarcode.all.min.js', zxing: 'https://cdn.jsdelivr.net/npm/@zxing/library@0.21.3/umd/index.min.js' };

const pad = (n) => String(n).padStart(2, '0');
const hariIni = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const dmy = (t) => { if (!t || !/^\d{4}-\d{2}-\d{2}/.test(t)) return t || ''; const p = t.slice(0, 10).split('-'); return `${+p[2]} ${BULAN[+p[1] - 1]} ${p[0]}`; };
const bdg = (pair) => `<span class="badge ${pair[1]}">${esc(pair[0])}</span>`;
/** Kuantiti unit asas → "3 box + 40 pcs". */
function fq(n, s) {
  n = Number(n) || 0;
  if (!s) return String(n);
  const isi = s.isiPek || 1;
  if (!(isi > 1) || !s.unitPek) return `${n} ${s.unit}`;
  const neg = n < 0, a = Math.abs(n), p = Math.floor(a / isi), r = a % isi;
  return (neg ? '−' : '') + (p ? `${p} ${s.unitPek}` : '') + (p && r ? ' + ' : '') + (r || !p ? `${r} ${s.unit}` : '');
}
const muatSkrip = (() => { const ada = {}; return (url) => (ada[url] = ada[url] || new Promise((ok, no) => { const s = document.createElement('script'); s.src = url; s.onload = ok; s.onerror = () => { delete ada[url]; no(new Error('Gagal memuat pustaka (perlu internet).')); }; document.head.appendChild(s); })); })();

let D = null, P = null, kat = null, V = 'stor', FOTO = {};
const bakul = new Map(); // kod -> kuantiti unit asas
const katLabel = (v) => ((D && D.kategori.find((k) => k.nilai === v)) || { label: v }).label;
const katWarna = (v) => WARNA_KAT[Math.max(0, D ? D.kategori.findIndex((k) => k.nilai === v) : 0) % WARNA_KAT.length];
const katChip = (v) => `<span class="kat" style="--c:${katWarna(v)}">${esc(katLabel(v))}</span>`;
const dlmKat = (x) => !kat.length || kat.includes(x.kategori);
const items = () => D.items.filter(dlmKat);
const itemOf = (kod) => D.items.find((x) => x.kod === kod);
const adaKel = (s, st) => s.kelompok.some((b) => b.baki > 0 && st.includes(b.status));
const lpOf = (s) => ['luput', 'luput30', 'luput90'].find((x) => adaKel(s, [x]));
function teruk(s) {
  let v = s.stok === 'negatif' ? 6 : s.stok === 'habis' ? 5 : s.stok === 'rendah' ? 3 : 0;
  v += adaKel(s, ['luput']) ? 4 : adaKel(s, ['luput30']) ? 3 : adaKel(s, ['luput90']) ? 1 : 0;
  return v + (s.perluTempah ? 1 : 0);
}
const perluPerhatian = (s) => s.aktif && (s.perluTempah || ['rendah', 'habis', 'negatif'].includes(s.stok) || adaKel(s, ['luput', 'luput30', 'luput90']));
function stat(list) {
  const st = { aktif: 0, cukup: 0, rendah: 0, habis: 0, negatif: 0, belum: 0, hampir: 0, luput: 0, tempah: 0, semak: 0 };
  list.forEach((s) => { if (!s.aktif) return; st.aktif++; st[s.stok]++; if (s.perluTempah) st.tempah++; if (s.ada.luput) st.luput++; if (s.ada.luput30 || s.ada.luput90) st.hampir++; if (s.semak || s.tidakPadan > 0 || s.kurang > 0) st.semak++; });
  return st;
}
function fotoSrc(s) { if (!s.foto) return ''; if (s.foto === 'SHEET') return FOTO[s.kod] || ''; return /^https:\/\//.test(s.foto) ? s.foto : ''; }
function fotoHTML(s, cls = '') {
  const src = fotoSrc(s);
  return src ? `<img class="inv-foto ${cls}" src="${esc(src)}" alt="" loading="lazy">`
    : `<span class="inv-foto inv-foto0 ${cls}" style="--c:${katWarna(s.kategori)}">${ic('box')}<b>${esc((s.desk || s.kod).replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase())}</b></span>`;
}

/* ============================ halaman ============================ */
export async function papar(page, rest) {
  tajuk('Inventori');
  P = page;
  V = ['ringkasan', 'transaksi', 'kiraan', 'laporan', 'urus'].includes(rest[0]) ? rest[0] : rest[0] === 'keluar' || rest[0] === 'terima' ? 'transaksi' : 'stor';
  if (rest[0] === 'keluar') tapisTx.jenis = 'I'; if (rest[0] === 'terima') tapisTx.jenis = 'R';
  page.innerHTML = '<div class="skel" style="height:420px;margin-top:8px"></div>';
  try { await muat(); } catch (e) { return; }
  if (kat === null) kat = ((S.me.pilihan || {}).kategoriInventori || []).filter((k) => D.kategori.some((x) => x.nilai === k));
  if (V === 'kiraan' && !D.boleh.kiraan) V = 'stor';
  if (V === 'urus' && !D.boleh.urus) V = 'stor';
  lukis();
  if (rest[0] === 'item' && rest[1]) butiranItem(decodeURIComponent(rest[1]));
}
async function muat() {
  try { D = await api('inventori.ringkasan'); simpan('cache.inventori', D); }
  catch (e) {
    D = ambil('cache.inventori', true);
    if (!D) { P.innerHTML = `<div class="card empty">${ic('alert')}<p>${esc(e.message)}</p></div>`; throw e; }
    toast('Luar talian — memaparkan data terakhir', 'bad');
  }
  const c = ambil('inv.foto', true);
  if (c && c.v === D.fotoV) FOTO = c.foto;
  else if (D.items.some((x) => x.foto === 'SHEET')) { try { const f = await api('inventori.foto'); FOTO = f.foto; simpan('inv.foto', f); } catch (e) { FOTO = (c && c.foto) || {}; } }
}
async function muatSemula() { await muat(); lukis(); }

function lukis() {
  const tab = [['stor', 'Stor', 'box'], ['ringkasan', 'Ringkasan', 'board'], ['transaksi', 'Transaksi', 'history'], D.boleh.kiraan && ['kiraan', 'Kiraan stok', 'list'], ['laporan', 'Laporan', 'log'], D.boleh.urus && ['urus', 'Urus', 'cog']].filter(Boolean);
  P.innerHTML = `<div class="inv-top">
      <div class="tabs inv-tabs">${tab.map(([k, n]) => `<button class="${V === k ? 'on' : ''}" data-v="${k}">${n}</button>`).join('')}</div>
      <span class="spacer"></span>
      <button class="btn" id="bImbas" title="Imbas kod bar / QR">${ic('scan')}<span class="hide-s">Imbas</span></button>
      ${D.boleh.tulis ? `<button class="btn" data-tx="R">${ic('plus')}<span class="hide-s">Terima</span></button>` : ''}
    </div>
    <div class="chips inv-kat"><span class="small muted" style="flex:none;align-self:center">Kategori:</span>
      ${D.kategori.map((k) => `<button class="chip ${kat.includes(k.nilai) ? 'on' : ''}" data-k="${esc(k.nilai)}"><i class="pk-dot" style="--c:${katWarna(k.nilai)}"></i>${esc(k.label)}</button>`).join('')}
      ${kat.length ? `<button class="chip ghost" data-k="">${ic('x')} Semua</button>` : ''}
      <button class="chip ghost" data-simpankat title="Jadikan pilihan lalai saya (juga untuk kad Halaman Utama)">${ic('check')} Simpan pilihan</button></div>
    <div id="invV"></div><div id="bakulBar"></div>`;
  $$('[data-v]', P).forEach((b) => (b.onclick = () => { location.hash = b.dataset.v === 'stor' ? '#/inventori' : '#/inventori/' + b.dataset.v; }));
  $$('[data-tx]', P).forEach((b) => (b.onclick = () => borangTx('R')));
  $('#bImbas', P).onclick = () => imbas((kod) => butiranItem(kod));
  $$('[data-k]', P).forEach((b) => (b.onclick = () => { const k = b.dataset.k; kat = !k ? [] : kat.includes(k) ? kat.filter((x) => x !== k) : [...kat, k]; lukis(); }));
  $('[data-simpankat]', P).onclick = (e) => sibuk(e.currentTarget, async () => {
    try { const me = await api('teras.profil', { emel: S.me.emel, pilihan: { kategoriInventori: kat } }); setBoot({ ...S.boot, me }); toast('Pilihan kategori disimpan', 'ok'); } catch (err) { ralat(err); }
  });
  ({ stor: lStor, ringkasan: lRingkasan, transaksi: lTx, kiraan: lKiraan, laporan: lLaporan, urus: lUrus })[V]($('#invV', P));
  lukisBakul();
}

/* ============================ STOR (kad visual) ============================ */
const st0 = { q: '', status: '', lokasi: '', susun: 'perhatian', papar: ambil('inv.papar') || 'kad' };
function senaraiStor() {
  const f = st0.status;
  let L = items().filter((s) => {
    if (f === 'tidakaktif') return !s.aktif;
    if (!s.aktif) return false;
    if (st0.lokasi && s.lokasi !== st0.lokasi) return false;
    if (['cukup', 'rendah', 'belum'].includes(f)) return s.stok === f;
    if (f === 'habisneg') return s.stok === 'habis' || s.stok === 'negatif';
    if (f === 'hampir') return adaKel(s, ['luput30', 'luput90']);
    if (f === 'luput') return adaKel(s, ['luput']);
    if (f === 'tempah') return s.perluTempah;
    if (f === 'perhatian') return perluPerhatian(s);
    if (f === 'semak') return s.semak || s.tidakPadan > 0 || s.kurang > 0;
    return true;
  });
  const q = st0.q.toLowerCase();
  if (q) L = L.filter((s) => `${s.kod} ${s.desk} ${s.kodHospital} ${s.lokasi} ${s.catatan}`.toLowerCase().includes(q));
  const by = { perhatian: (a, b) => teruk(b) - teruk(a) || a.desk.localeCompare(b.desk), nama: (a, b) => a.desk.localeCompare(b.desk), kategori: (a, b) => a.kategori.localeCompare(b.kategori) || a.desk.localeCompare(b.desk), lokasi: (a, b) => (a.lokasi || '~').localeCompare(b.lokasi || '~') || a.desk.localeCompare(b.desk) };
  return L.sort(by[st0.susun] || by.nama);
}
function lStor(el) {
  const pilihan = [['', 'Semua aktif'], ['perhatian', 'Perlu perhatian'], ['cukup', 'Mencukupi'], ['rendah', 'Stok rendah'], ['habisneg', 'Habis / negatif'], ['belum', 'Min. belum ditetapkan'], ['hampir', 'Hampir luput'], ['luput', 'Telah luput'], ['tempah', 'Perlu tempahan'], ['semak', 'Perlu semakan'], ['tidakaktif', 'Tidak aktif']];
  el.innerHTML = `<div class="row inv-alat"><div class="search" style="flex:1 1 240px">${ic('search')}<input class="in" id="sq" type="search" placeholder="Cari item, kod, kod hospital, lokasi" value="${esc(st0.q)}"></div>
      <select class="in" id="sSt">${pilihan.map(([k, n]) => `<option value="${k}" ${st0.status === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      ${D.lokasi.length ? `<select class="in" id="sLk"><option value="">Semua lokasi</option>${D.lokasi.map((l) => `<option ${st0.lokasi === l.nilai ? 'selected' : ''}>${esc(l.nilai)}</option>`).join('')}</select>` : ''}
      <select class="in" id="sSu"><option value="perhatian">Susun: perhatian</option><option value="nama">Susun: nama</option><option value="kategori">Susun: kategori</option><option value="lokasi">Susun: lokasi</option></select>
      <div class="tabs"><button class="${st0.papar === 'kad' ? 'on' : ''}" data-p="kad" title="Paparan kad">${ic('board')}</button><button class="${st0.papar === 'jadual' ? 'on' : ''}" data-p="jadual" title="Paparan jadual">${ic('list')}</button></div>
      ${D.boleh.urus ? `<button class="btn pri" id="bItem">${ic('plus')}<span class="hide-s">Item baharu</span></button>` : ''}</div>
    <div id="sOut"></div>`;
  $('#sSu', el).value = st0.susun;
  const isi = () => {
    const L = senaraiStor(), o = $('#sOut', el);
    if (!L.length) { o.innerHTML = `<div class="card empty">${ic('box')}<p style="margin:0">Tiada item sepadan.</p></div>`; return; }
    o.innerHTML = st0.papar === 'kad' ? `<div class="inv-grid">${L.map(kadItem).join('')}</div>` : jadualItem(L);
  };
  isi();
  $('#sq', el).oninput = debounce((e) => { st0.q = e.target.value; isi(); }, 200);
  $('#sSt', el).onchange = (e) => { st0.status = e.target.value; isi(); };
  if ($('#sLk', el)) $('#sLk', el).onchange = (e) => { st0.lokasi = e.target.value; isi(); };
  $('#sSu', el).onchange = (e) => { st0.susun = e.target.value; isi(); };
  $$('[data-p]', el).forEach((b) => (b.onclick = () => { st0.papar = b.dataset.p; simpan('inv.papar', st0.papar); lStor(el); }));
  const bi = $('#bItem', el); if (bi) bi.onclick = () => borangItem(null);
  el.onclick = (e) => {
    const m = e.target.closest('[data-tambah],[data-kurang]');
    if (m) { e.stopPropagation(); return ubahBakul(m.dataset.tambah || m.dataset.kurang, m.dataset.tambah ? 1 : -1); }
    const k = e.target.closest('[data-buka]'); if (k) butiranItem(k.dataset.buka);
  };
}
function bar(s) {
  const maks = Math.max(s.lvMaks || 0, (s.effMin || 0) * 2, s.baki, 1), pct = Math.max(0, Math.min(100, (s.baki / maks) * 100)), mp = s.effMin ? Math.min(100, (s.effMin / maks) * 100) : null;
  const w = s.stok === 'cukup' ? 'var(--ok)' : s.stok === 'rendah' ? 'var(--warn)' : s.stok === 'belum' ? 'var(--muted)' : 'var(--bad)';
  return `<div class="inv-bar" title="Baki ${esc(fq(s.baki, s))}${s.effMin != null ? ' · min ' + esc(fq(s.effMin, s)) : ''}${s.lvMaks ? ' · maks ' + esc(fq(s.lvMaks, s)) : ''}"><i style="width:${pct}%;background:${w}"></i>${mp !== null ? `<u style="left:${mp}%"></u>` : ''}</div>`;
}
function kadItem(s) {
  const lp = lpOf(s), dlm = bakul.get(s.kod) || 0, langkah = s.isiPek > 1 ? s.isiPek : 1;
  return `<article class="inv-kad ${s.aktif ? '' : 'off'}" data-buka="${esc(s.kod)}">
    <div class="inv-kad-f">${fotoHTML(s)}${s.lokasi ? `<span class="inv-lok">${ic('pin')}${esc(s.lokasi)}</span>` : ''}</div>
    <div class="inv-kad-b"><b class="inv-kad-n">${esc(s.desk)}</b><small class="muted">${esc(s.kod)}${s.kodHospital ? ' · ' + esc(s.kodHospital) : ''}</small>
      <div class="inv-kad-q"><b class="${s.baki <= 0 ? 'bad' : ''}">${esc(fq(s.baki, s))}</b>${s.isiPek > 1 ? `<small>${s.baki} ${esc(s.unit)}</small>` : ''}</div>${bar(s)}
      <div class="inv-kad-t">${katChip(s.kategori)}${s.stok !== 'cukup' ? bdg(STOK[s.stok]) : ''}${lp ? bdg(LUPUT[lp]) : ''}${s.perluTempah ? '<span class="badge">Tempah</span>' : ''}</div></div>
    ${D.boleh.tulis && s.aktif && (s.baki > 0 || D.tetapan.negatif || dlm) ? `<div class="inv-kad-k">${dlm ? `<button class="btn icon sm" data-kurang="${esc(s.kod)}" aria-label="Kurang">−</button><span class="inv-dlm">${esc(fq(dlm, s))}</span>` : `<span class="small muted">${langkah > 1 ? `+1 ${esc(s.unitPek)}` : 'Keluar'}</span>`}
      <button class="btn icon sm pri" data-tambah="${esc(s.kod)}" aria-label="Tambah ke bakul">${ic('plus')}</button></div>` : ''}</article>`;
}
function jadualItem(L) {
  return `<div class="card scroll-x"><table class="tbl inv-tbl"><thead><tr><th></th><th>Item</th><th>Kategori</th><th>Lokasi</th><th style="text-align:right">Baki</th><th style="text-align:right">Min.</th><th>Status</th><th>Luput terdekat</th>${D.boleh.tulis ? '<th></th>' : ''}</tr></thead>
    <tbody>${L.map((s) => `<tr class="click" data-buka="${esc(s.kod)}"><td style="width:46px">${fotoHTML(s, 'kecil')}</td>
      <td><b>${esc(s.desk)}</b><div class="small muted">${esc(s.kod)}${s.kodHospital ? ' · ' + esc(s.kodHospital) : ''}</div></td><td>${katChip(s.kategori)}</td><td class="small">${esc(s.lokasi || '—')}</td>
      <td style="text-align:right;white-space:nowrap"><b>${esc(fq(s.baki, s))}</b></td><td style="text-align:right;white-space:nowrap" class="small">${s.effMin == null ? '—' : esc(fq(s.effMin, s))}</td>
      <td>${s.aktif ? bdg(STOK[s.stok]) : '<span class="badge grey">Tidak aktif</span>'}${s.perluTempah ? ' <span class="badge">Tempah</span>' : ''}</td>
      <td class="small">${s.luputHampir ? esc(dmy(s.luputHampir)) + ' ' + bdg(LUPUT[s.luput]) : '—'}</td>
      ${D.boleh.tulis ? `<td>${s.aktif ? `<button class="btn icon sm pri" data-tambah="${esc(s.kod)}" aria-label="Tambah ke bakul">${ic('plus')}</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table></div>`;
}

/* ---------- bakul keluaran ---------- */
function ubahBakul(kod, arah) {
  const s = itemOf(kod); if (!s) return;
  const langkah = s.isiPek > 1 ? s.isiPek : 1, n = Math.max(0, (bakul.get(kod) || 0) + arah * langkah);
  if (n > s.baki && arah > 0 && !D.tetapan.negatif) { toast(`Baki ${s.desk} hanya ${fq(s.baki, s)}`, 'bad'); return; }
  n ? bakul.set(kod, n) : bakul.delete(kod);
  const k = $(`.inv-kad[data-buka="${CSS.escape(kod)}"]`, P);
  if (k) k.outerHTML = kadItem(s);
  lukisBakul();
}
function lukisBakul() {
  const el = $('#bakulBar', P); if (!el) return;
  if (!bakul.size) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="inv-bakul"><span class="inv-bakul-ic">${ic('box')}<b>${bakul.size}</b></span><span style="flex:1;min-width:0"><b>Bakul keluaran</b><small>${[...bakul].map(([k, n]) => esc((itemOf(k) || {}).desk || k) + ' ×' + esc(fq(n, itemOf(k)))).join(' · ')}</small></span>
    <button class="btn ghost sm" id="bkKosong">Kosongkan</button><button class="btn pri" id="bkSah">${ic('check')} Sahkan keluaran</button></div>`;
  $('#bkKosong', el).onclick = () => { bakul.clear(); lukis(); };
  $('#bkSah', el).onclick = sahkanBakul;
}
function sahkanBakul() {
  const rid = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
  const d = dialog({
    tajuk: 'Sahkan keluaran', badge: bakul.size + ' item',
    badan: `<div class="inv-bk-list">${[...bakul].map(([k, n]) => { const s = itemOf(k), isi = s.isiPek > 1; return `<div class="inv-bk" data-k="${esc(k)}">${fotoHTML(s, 'kecil')}<span style="flex:1;min-width:0"><b>${esc(s.desk)}</b><small class="muted">Baki ${esc(fq(s.baki, s))}</small></span>
        <input class="in" type="number" min="0" step="1" value="${isi && n % s.isiPek === 0 ? n / s.isiPek : n}" data-q style="width:84px">
        ${isi ? `<select class="in" data-u style="width:auto"><option value="pek" ${n % s.isiPek === 0 ? 'selected' : ''}>${esc(s.unitPek)}</option><option value="asas" ${n % s.isiPek ? 'selected' : ''}>${esc(s.unit)}</option></select>` : `<span class="small muted" style="width:50px">${esc(s.unit)}</span>`}
        <button class="btn ghost icon" data-buang aria-label="Buang">${ic('x')}</button></div>`; }).join('')}</div>
      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px;margin-top:14px">
        <label class="field"><span>Tarikh</span><input class="in" type="date" id="bkT" value="${hariIni()}" max="${hariIni()}"></label>
        <label class="field"><span>Catatan</span><input class="in" id="bkC" maxlength="300" placeholder="cth Sesi TPN pagi / wad"></label></div>
      <p class="small muted" style="margin:0">Kelompok dipilih secara automatik (FEFO — luput terawal dahulu).</p>`,
    kaki: `<button class="btn" data-tutup>Kembali</button><button class="btn pri" data-ok>${ic('check')} Keluarkan</button>`
  });
  d.addEventListener('click', (e) => { const b = e.target.closest('[data-buang]'); if (b) { const r = b.closest('[data-k]'); bakul.delete(r.dataset.k); r.remove(); lukisBakul(); if (!bakul.size) d.close(); } });
  $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    const baris = $$('[data-k]', d).map((r) => ({ kod: r.dataset.k, kuantiti: Number($('[data-q]', r).value), dalamPek: $('[data-u]', r) ? $('[data-u]', r).value === 'pek' : false })).filter((b) => b.kuantiti > 0);
    if (!baris.length) return toast('Bakul kosong', 'bad');
    try {
      const r = await api('inventori.keluarPukal', { baris, tarikh: $('#bkT', d).value, catatan: $('#bkC', d).value.trim(), reqId: rid });
      d.close(); bakul.clear(); toast(`${r.bil} item dikeluarkan`, 'ok');
      dialog({ tajuk: 'Keluaran direkod', saiz: 'sm', badan: `<table class="tbl">${r.baris.map((x) => `<tr><td><b>${esc(x.desk)}</b><div class="small muted">keluar ${esc(x.q)}</div></td><td style="text-align:right" class="small">baki<br><b>${esc(x.bakiQ)}</b></td></tr>`).join('')}</table>`, kaki: '<button class="btn pri" data-tutup>Selesai</button>' });
      await muatSemula();
    } catch (err) { ralat(err); }
  });
}

/* ============================ RINGKASAN ============================ */
function lRingkasan(el) {
  const L = items(), st = stat(L), attn = L.filter(perluPerhatian).sort((a, b) => teruk(b) - teruk(a));
  const kad = [['Item aktif', st.aktif, '', ''], ['Mencukupi', st.cukup, 'ok', 'cukup'], ['Bawah paras minimum', st.rendah, 'warn', 'rendah'], ['Habis / negatif', st.habis + st.negatif, 'bad', 'habisneg'],
    [`Hampir luput (≤${D.d2} hari)`, st.hampir, 'warn', 'hampir'], ['Telah luput', st.luput, 'bad', 'luput'], ['Perlu tempahan', st.tempah, 'warn', 'tempah'], ['Perlu semakan', st.semak, '', 'semak']];
  el.innerHTML = `<div class="inv-stats">${kad.map(([l, v, n, f]) => `<button class="stat ${n}" data-f="${f}"><b>${v}</b><span>${esc(l)}</span></button>`).join('')}</div>
    <div class="grid inv-g2">
      <section class="card"><div class="inv-h"><b>Perlu perhatian</b><span class="badge">${attn.length}</span></div>
        ${attn.length ? `<div class="inv-list">${attn.slice(0, 10).map((s) => `<button class="inv-row" data-buka="${esc(s.kod)}">${fotoHTML(s, 'kecil')}<span class="inv-n"><b>${esc(s.desk)}</b><small>${katChip(s.kategori)} ${s.stok !== 'cukup' ? bdg(STOK[s.stok]) : ''} ${lpOf(s) ? bdg(LUPUT[lpOf(s)]) : ''}</small></span><span class="inv-b"><b class="${s.baki <= 0 ? 'bad' : ''}">${esc(fq(s.baki, s))}</b></span></button>`).join('')}</div>
          ${attn.length > 10 ? `<button class="btn sm ghost inv-more" data-f="perhatian">Lihat semua (${attn.length}) ${ic('arrow')}</button>` : ''}`
          : `<div class="empty" style="padding:28px">${ic('check')}<p style="margin:0">Tiada item memerlukan perhatian.</p></div>`}</section>
      <section class="card pad"><b>Bilangan transaksi 12 bulan</b>${carta(D.bulanan.map((b) => ({ l: BULAN[+b.b.slice(5) - 1], v: [b.nIn, b.nOut, b.nLupus] })))}</section>
    </div>
    <div class="grid inv-g2" style="margin-top:16px">
      <section class="card"><div class="inv-h"><b>Penerimaan terkini</b></div>${terkini(D.terimaTerkini.filter(dlmKat))}</section>
      <section class="card"><div class="inv-h"><b>Keluaran terkini</b></div>${terkini(D.keluarTerkini.filter(dlmKat))}</section>
    </div>
    <p class="small muted" style="margin:12px 2px">Dikemas kini ${esc(masaRingkas(D.dijana))} · paras stok: ${D.paras.kaedah === 'auto' ? `automatik (purata ${D.paras.purata} bulan; nilai manual item mengatasi)` : 'manual'}</p>`;
  el.onclick = (e) => {
    const f = e.target.closest('[data-f]'); if (f) { st0.status = f.dataset.f; location.hash = '#/inventori'; return; }
    const r = e.target.closest('[data-buka]'); if (r) butiranItem(r.dataset.buka);
  };
}
function terkini(list) {
  return list.length ? `<table class="tbl"><tbody>${list.map((t) => `<tr class="click" data-buka="${esc(t.kod)}"><td class="small" style="white-space:nowrap">${esc(dmy(t.tarikh))}</td><td><b class="small">${esc(t.desk || t.kod)}</b><div class="small muted">${bdg(JTX[t.jenisTx] || [t.jenisTx, 'grey'])} ${esc(t.olehNama || '')}</div></td><td style="text-align:right;white-space:nowrap"><b>${esc(t.q)}</b></td></tr>`).join('')}</tbody></table>`
    : '<div class="empty" style="padding:20px">Tiada rekod.</div>';
}
function carta(B, lbl = ['Terima', 'Guna', 'Lupus'], warna = ['#10b981', '#f59e0b', '#ef4444']) {
  const W = 600, H = 170, max = Math.max(1, ...B.flatMap((b) => b.v)), bw = W / B.length, n = B[0] ? B[0].v.length : 1, w = (bw * 0.72) / n;
  return `<svg viewBox="0 0 ${W} ${H + 22}" class="inv-chart" role="img" aria-label="Carta bulanan">
    ${B.map((b, i) => `<g><title>${esc(b.l)}: ${b.v.map((v, j) => lbl[j] + ' ' + v).join(', ')}</title>${b.v.map((v, j) => `<rect x="${i * bw + bw * 0.14 + j * w}" y="${H - (v / max) * H}" width="${w - 2}" height="${(v / max) * H}" rx="3" fill="${warna[j]}"/>`).join('')}
      <text x="${i * bw + bw / 2}" y="${H + 16}" text-anchor="middle" font-size="11" fill="currentColor" opacity=".6">${esc(b.l)}</text></g>`).join('')}</svg>
    <div class="row small" style="gap:14px">${lbl.slice(0, n).map((l, j) => `<span><i class="pk-dot" style="--c:${warna[j]}"></i> ${l}</span>`).join('')}</div>`;
}

/* ============================ BUTIRAN ITEM ============================ */
async function butiranItem(kod, tahun) {
  const s0 = itemOf(kod);
  if (!s0) return toast('Item tidak dijumpai: ' + kod, 'bad');
  const d = dialog({ tajuk: s0.desk, badge: kod, saiz: 'lg', badan: '<div class="skel" style="height:300px"></div>' });
  let r;
  try { r = await api('inventori.item', { kod, tahun }); } catch (e) { $('.dlg-b', d).innerHTML = `<p>${esc(e.message)}</p>`; return; }
  const s = { ...s0, ...r.item }, maxB = Math.max(1, ...r.bulanan.map((b) => Math.max(b.qIn, b.qOut, b.qLupus)));
  $('.dlg-b', d).innerHTML = `<div class="inv-det">
    <div class="inv-det-f">${fotoHTML(s, 'besar')}${D.boleh.urus ? `<div class="row" style="gap:6px;margin-top:8px"><button class="btn sm" data-foto>${ic('camera')} ${fotoSrc(s) ? 'Tukar foto' : 'Tambah foto'}</button>${s.foto ? `<button class="btn sm ghost" data-buangfoto>${ic('trash')}</button>` : ''}</div>` : ''}</div>
    <div><div class="inv-big"><small>Baki semasa</small><b class="${s.baki <= 0 ? 'bad' : ''}">${esc(fq(s.baki, s))}</b>${s.isiPek > 1 ? `<span class="small muted">${s.baki} ${esc(s.unit)} · 1 ${esc(s.unitPek)} = ${s.isiPek} ${esc(s.unit)}</span>` : ''}${bar(s)}
      <div class="row" style="gap:6px">${s.aktif ? bdg(STOK[s.stok]) : '<span class="badge grey">Tidak aktif</span>'}${s.perluTempah ? `<span class="badge">Tempah ${esc(fq(s.kuantitiTempah, s))}</span>` : ''} ${katChip(s.kategori)}</div></div>
    <dl class="kv" style="margin-top:12px"><dt>Kod</dt><dd>${esc(s.kod)}</dd>${s.kodHospital ? `<dt>Kod Hospital</dt><dd>${esc(s.kodHospital)}</dd>` : ''}<dt>Lokasi</dt><dd>${esc(s.lokasi || '—')}</dd>
      <dt>Paras minimum</dt><dd>${s.effMin == null ? '—' : esc(fq(s.effMin, s))} <small class="muted">${s.min != null ? '(manual)' : s.minAuto != null ? '(automatik)' : ''}</small> ${D.boleh.ubahMin ? '<button class="btn sm ghost" data-min>Ubah</button>' : ''}</dd>
      <dt>Purata guna</dt><dd>${s.purata ? esc(fq(Math.round(s.purata), s)) + ' / bulan' : '—'}${s.lvMenokok != null ? ` <small class="muted">· menokok ${esc(fq(s.lvMenokok, s))} · maks ${esc(fq(s.lvMaks, s))}</small>` : ''}</dd>
      ${s.lupus12 ? `<dt>Dilupus (12 bln)</dt><dd>${esc(fq(s.lupus12, s))}</dd>` : ''}${s.catatan ? `<dt>Catatan</dt><dd>${esc(s.catatan)}</dd>` : ''}</dl></div></div>
    ${s.tidakPadan > 0 ? `<div class="note-box">${esc(fq(s.tidakPadan, s))} pengeluaran lama tidak sepadan dengan kelompok dan diagih ikut FEFO. Baki keseluruhan tidak terjejas.</div>` : ''}
    ${s.kurang > 0 ? `<div class="note-box" style="background:var(--bad-soft);color:var(--bad)">Baki negatif: pengeluaran melebihi penerimaan sebanyak ${esc(fq(s.kurang, s))}. Perlu semakan.</div>` : ''}
    <div class="h5">Baki ikut kelompok (FEFO)</div>
    ${s.kelompok.length ? `<table class="tbl"><thead><tr><th>Tarikh luput</th><th style="text-align:right">Diterima</th><th style="text-align:right">Baki</th><th>Status</th>${D.boleh.tulis ? '<th></th>' : ''}</tr></thead><tbody>${s.kelompok.map((b) => `<tr${b.baki <= 0 ? ' style="opacity:.5"' : ''}><td>${b.luput ? esc(dmy(b.luput)) : '<span class="muted">Tiada</span>'}</td><td style="text-align:right">${esc(fq(b.terima, s))}</td><td style="text-align:right"><b>${esc(fq(b.baki, s))}</b></td><td>${b.baki > 0 ? bdg(LUPUT[b.status]) : '<span class="small muted">Habis</span>'}</td>
      ${D.boleh.tulis ? `<td>${b.baki > 0 && ['luput', 'luput30'].includes(b.status) ? `<button class="btn sm bad" data-lupus="${esc(b.luput)}">${ic('trash')} Lupus</button>` : ''}</td>` : ''}</tr>`).join('')}</tbody></table>` : '<p class="muted small">Tiada penerimaan.</p>'}
    <div class="row" style="margin-top:18px"><div class="h5" style="margin:0;flex:1">Pergerakan bulanan ${esc(r.tahun)}</div><select class="in" id="dTh" style="width:auto">${D.tahun.map((y) => `<option ${y === r.tahun ? 'selected' : ''}>${y}</option>`).join('')}</select></div>
    <div class="inv-mini">${r.bulanan.map((b) => `<div title="${BULAN[b.m - 1]}: terima ${fq(b.qIn, s)}, guna ${fq(b.qOut, s)}, lupus ${fq(b.qLupus, s)}"><span style="height:${(b.qIn / maxB) * 100}%;background:#10b981"></span><span style="height:${(b.qOut / maxB) * 100}%;background:#f59e0b"></span><span style="height:${(b.qLupus / maxB) * 100}%;background:#ef4444"></span><small>${BULAN[b.m - 1][0]}</small></div>`).join('')}</div>
    <div class="h5">Sejarah transaksi${r.jumlahSejarah > r.sejarah.length ? ` (${r.sejarah.length} terkini daripada ${r.jumlahSejarah})` : ''}</div>
    <div class="scroll-x"><table class="tbl"><thead><tr><th>Tarikh</th><th>Jenis</th><th style="text-align:right">Kuantiti</th><th>Luput / kelompok</th><th>Oleh / catatan</th><th></th></tr></thead><tbody>${r.sejarah.map((t) => `<tr${t.status === 'DIBATALKAN' ? ' style="opacity:.5;text-decoration:line-through"' : ''}>
      <td class="small" style="white-space:nowrap">${esc(dmy(t.tarikh))}</td><td>${bdg(JTX[t.jenisTx] || [t.jenisTx, 'grey'])}${t.semakan ? ' <span class="badge warn" title="' + esc(t.semakan) + '">Semak</span>' : ''}</td><td style="text-align:right;white-space:nowrap"><b>${esc(fq(t.qty, s))}</b></td>
      <td class="small">${esc(t.luput ? (/^\d{4}-/.test(t.luput) ? dmy(t.luput) : t.luput) : '—')}</td><td class="small">${esc(t.olehNama)}${t.pembekal ? ` · ${esc(t.pembekal)}` : ''}${t.noDO ? ` · DO ${esc(t.noDO)}` : ''}${t.catatan ? `<div class="muted">${esc(t.catatan)}</div>` : ''}</td>
      <td>${t.boleh ? `<button class="btn ghost icon" data-tx="${esc(t.id)}" aria-label="Ubah">${ic('edit')}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Tiada transaksi.</td></tr>'}</tbody></table></div>`;
  const kaki = document.createElement('div');
  kaki.className = 'dlg-f';
  kaki.innerHTML = `${D.boleh.urus ? `<button class="btn" data-ubah>${ic('edit')}<span class="hide-s">Ubah item</span></button>` : ''}<button class="btn" data-label>${ic('print')}<span class="hide-s">Label</span></button><span class="spacer"></span>
    ${D.boleh.tulis && s.aktif ? `<button class="btn" data-r>${ic('plus')} Terima</button><button class="btn bad" data-l>${ic('trash')} Lupus</button><button class="btn pri" data-i>${ic('box')} Keluar</button>` : '<button class="btn" data-tutup>Tutup</button>'}`;
  d.appendChild(kaki);
  const on = (sel, fn) => { const b = $(sel, d); if (b) b.onclick = fn; };
  on('[data-ubah]', () => { d.close(); borangItem(s); });
  on('[data-label]', () => cetakLabel([s.kod]));
  on('[data-r]', () => { d.close(); borangTx('R', kod); });
  on('[data-i]', () => { d.close(); borangTx('I', kod); });
  on('[data-l]', () => { d.close(); borangTx('I', kod, { lupus: true }); });
  on('[data-min]', () => { d.close(); ubahMin(s); });
  on('[data-foto]', () => pilihFoto(s, () => { d.close(); butiranItem(kod); }));
  on('[data-buangfoto]', async () => { if (!(await sahkan('Buang foto item ini?', { ya: 'Buang', bahaya: true }))) return; try { await api('inventori.fotoSimpan', { kod }); d.close(); await muatSemula(); butiranItem(kod); } catch (err) { ralat(err); } });
  $('#dTh', d).onchange = (e) => { d.close(); butiranItem(kod, e.target.value); };
  $$('[data-lupus]', d).forEach((b) => (b.onclick = () => { d.close(); borangTx('I', kod, { lupus: true, kelompok: b.dataset.lupus }); }));
  $$('[data-tx]', d).forEach((b) => (b.onclick = () => { const t = r.sejarah.find((x) => x.id === b.dataset.tx); d.close(); borangUbahTx(t, s); }));
}

/* ---------- foto ---------- */
function pilihFoto(s, selepas) {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*'; inp.capture = 'environment';
  inp.onchange = async () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    try {
      const data = await kecilkanImej(f);
      await api('inventori.fotoSimpan', { kod: s.kod, data });
      toast('Foto disimpan', 'ok'); await muatSemula(); selepas && selepas();
    } catch (err) { ralat(err); }
  };
  inp.click();
}
async function kecilkanImej(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = () => no(new Error('Fail bukan imej yang sah.')); i.src = url; });
    for (const [maks, q] of [[520, 0.78], [440, 0.7], [360, 0.62], [300, 0.55], [240, 0.5]]) {
      const k = Math.min(1, maks / Math.max(img.width, img.height)), c = document.createElement('canvas');
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      const x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
      const d = c.toDataURL('image/jpeg', q);
      if (d.length <= 45000) return d;
    }
    throw new Error('Imej terlalu besar walaupun selepas dimampatkan.');
  } finally { URL.revokeObjectURL(url); }
}

/* ---------- borang item ---------- */
function borangItem(it) {
  const baru = !it;
  it = it || { kod: '', desk: '', unit: 'pcs', unitPek: '', isiPek: 1, kategori: kat[0] || (D.kategori[0] || {}).nilai || 'GUNASAMA', kodHospital: '', lokasi: '', min: null, catatan: '', aktif: true };
  const minPek = it.min != null && it.isiPek > 1 && it.min % it.isiPek === 0;
  const d = dialog({
    tajuk: baru ? 'Item baharu' : 'Ubah item', badge: baru ? '' : it.kod,
    badan: `<form id="fIt" autocomplete="off"><div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:0 14px">
      <label class="field"><span>Kod item *</span><input class="in" name="kod" value="${esc(it.kod)}" required ${baru ? '' : 'readonly style="background:var(--surface-2)"'}>${baru ? '<small>Kod tidak boleh diubah selepas disimpan.</small>' : ''}</label>
      <label class="field"><span>Kod Hospital / kod bar</span><input class="in" name="kodHospital" value="${esc(it.kodHospital)}" placeholder="pilihan"></label></div>
      <label class="field"><span>Deskripsi *</span><input class="in" name="desk" value="${esc(it.desk)}" required></label>
      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px">
        <label class="field"><span>Kategori *</span><select class="in" name="kategori">${D.kategori.map((k) => `<option value="${esc(k.nilai)}" ${it.kategori === k.nilai ? 'selected' : ''}>${esc(k.label)}</option>`).join('')}</select></label>
        <label class="field"><span>Lokasi</span><select class="in" name="lokasi"><option value="">—</option>${D.lokasi.map((l) => `<option ${it.lokasi === l.nilai ? 'selected' : ''}>${esc(l.nilai)}</option>`).join('')}</select></label></div>
      <fieldset class="inv-unit"><legend>Unit</legend><div class="grid" style="grid-template-columns:repeat(3,minmax(0,1fr));gap:0 12px">
        <label class="field"><span>Unit asas *</span><input class="in" name="unit" value="${esc(it.unit)}" required placeholder="pcs"></label>
        <label class="field"><span>Unit pek</span><input class="in" name="unitPek" value="${esc(it.unitPek)}" placeholder="cth box"></label>
        <label class="field"><span>Isi sepek</span><input class="in" type="number" min="1" name="isiPek" value="${it.isiPek > 1 ? it.isiPek : ''}" placeholder="cth 100"></label></div>
        <small class="muted">Stok disimpan dalam unit asas. Jika ada unit pek (cth 1 box = 100 pcs), staf boleh terima/keluar dalam box atau pcs.</small></fieldset>
      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px;margin-top:12px">
        <label class="field"><span>Paras minimum (manual)</span><div class="row" style="flex-wrap:nowrap;gap:6px"><input class="in" type="number" min="0" name="min" value="${it.min == null ? '' : minPek ? it.min / it.isiPek : it.min}" placeholder="kosong = automatik">
          <select class="in" name="minU" style="width:auto"><option value="asas">${esc(it.unit || 'unit')}</option>${it.isiPek > 1 || baru ? `<option value="pek" ${minPek ? 'selected' : ''}>${esc(it.unitPek || 'pek')}</option>` : ''}</select></div></label>
        <label class="field"><span>Catatan</span><input class="in" name="catatan" value="${esc(it.catatan)}"></label></div>
      <label class="switch"><input type="checkbox" name="aktif" ${it.aktif ? 'checked' : ''}> Item aktif</label></form>`,
    kaki: `<button class="btn" data-tutup>Batal</button><button class="btn pri" data-ok>Simpan</button>`
  });
  const f = $('#fIt', d);
  $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    try {
      await api('inventori.simpanItem', { id: baru ? '' : it.id, kod: f.kod.value.trim(), desk: f.desk.value.trim(), unit: f.unit.value.trim(), unitPek: f.unitPek.value.trim(), isiPek: f.isiPek.value,
        kategori: f.kategori.value, lokasi: f.lokasi.value, kodHospital: f.kodHospital.value.trim(), min: f.min.value, minDalamPek: f.minU.value === 'pek', catatan: f.catatan.value.trim(), aktif: f.aktif.checked });
      d.close(); toast('Item disimpan', 'ok'); await muatSemula();
    } catch (err) { ralat(err); }
  });
}
function ubahMin(s) {
  const pek = s.isiPek > 1, dlmPek = pek && s.min != null && s.min % s.isiPek === 0;
  const d = dialog({ tajuk: 'Paras minimum', badge: s.kod, saiz: 'sm',
    badan: `<p class="small muted" style="margin:0 0 10px">${esc(s.desk)}. Kosongkan untuk guna nilai automatik${s.minAuto != null ? ` (${esc(fq(s.minAuto, s))})` : ''}.</p>
      <div class="row" style="flex-wrap:nowrap"><input class="in" type="number" min="0" id="mn" value="${s.min == null ? '' : dlmPek ? s.min / s.isiPek : s.min}">${pek ? `<select class="in" id="mu" style="width:auto"><option value="pek" ${dlmPek ? 'selected' : ''}>${esc(s.unitPek)}</option><option value="asas" ${dlmPek ? '' : 'selected'}>${esc(s.unit)}</option></select>` : `<span>${esc(s.unit)}</span>`}</div>`,
    kaki: `<button class="btn" data-tutup>Batal</button><button class="btn pri" data-ok>Simpan</button>` });
  $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => { try { await api('inventori.paras', { kod: s.kod, min: $('#mn', d).value, dalamPek: pek && $('#mu', d).value === 'pek' }); d.close(); toast('Paras minimum disimpan', 'ok'); await muatSemula(); } catch (err) { ralat(err); } });
}

/* ---------- borang transaksi ---------- */
function pilihItemHTML(kod, label = 'Item *') {
  const L = D.items.filter((x) => x.aktif && dlmKat(x));
  return `<label class="field"><span>${label}</span><div class="row" style="flex-wrap:nowrap;gap:6px"><input class="in" name="item" list="dlItem" placeholder="Taip kod, nama atau imbas" value="${esc(kod ? `${kod} — ${(itemOf(kod) || {}).desk || ''}` : '')}">
    <button type="button" class="btn icon" data-imbas title="Imbas kod">${ic('scan')}</button></div>
    <datalist id="dlItem">${L.map((x) => `<option value="${esc(x.kod + ' — ' + x.desk)}">${esc(x.kodHospital)}</option>`).join('')}</datalist><small id="iInfo"></small></label>`;
}
const kodDari = (v) => { const k = String(v || '').split(' — ')[0].trim(); if (itemOf(k)) return k; const lc = k.toLowerCase(); const x = D.items.find((i) => i.kod.toLowerCase() === lc || (i.kodHospital && i.kodHospital.toLowerCase() === lc)); return x ? x.kod : ''; };

function borangTx(J, kod, o = {}) {
  if (!D.boleh.tulis) return;
  const lupus = !!o.lupus, rid = (crypto.randomUUID && crypto.randomUUID()) || String(Date.now() + Math.random());
  const d = dialog({
    tajuk: J === 'R' ? 'Terima stok' : lupus ? 'Lupus stok' : 'Keluarkan stok',
    badan: `<form id="fTx" autocomplete="off">${pilihItemHTML(kod)}
      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px">
        <label class="field"><span>Tarikh *</span><input class="in" type="date" name="tarikh" value="${hariIni()}" max="${hariIni()}" required></label>
        <label class="field"><span>Kuantiti *</span><div class="row" style="flex-wrap:nowrap;gap:6px"><input class="in" type="number" min="1" step="1" name="qty" required><select class="in" name="u" style="width:auto" hidden></select></div><small id="qInfo"></small></label></div>
      <label class="field"><span>${J === 'R' ? 'Tarikh luput' : 'Kelompok'}</span>${J === 'R' ? '<input class="in" type="date" name="luput">' : '<select class="in" name="luput"><option value="">Auto (FEFO — luput terawal dahulu)</option></select>'}</label>
      ${J === 'R' ? `<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px"><label class="field"><span>Pembekal</span><input class="in" name="pembekal" list="dlPem" maxlength="120"><datalist id="dlPem">${D.pembekal.map((p) => `<option value="${esc(p.nilai)}">`).join('')}</datalist></label>
        <label class="field"><span>No. DO / rujukan</span><input class="in" name="noDO" maxlength="60"></label></div>` : ''}
      <label class="field"><span>${lupus ? 'Sebab pelupusan *' : 'Catatan'}</span><input class="in" name="catatan" maxlength="300" placeholder="${J === 'R' ? 'pilihan' : lupus ? 'cth Telah luput / pek rosak / tercemar' : 'cth Sesi TPN / wad'}" ${lupus ? 'required' : ''}></label></form>`,
    kaki: `<button class="btn" data-tutup>Batal</button><button class="btn ${lupus ? 'bad' : 'pri'}" data-ok>${lupus ? 'Lupuskan' : 'Simpan'}</button>`
  });
  const f = $('#fTx', d);
  const kemas = () => {
    const s = itemOf(kodDari(f.item.value));
    $('#iInfo', d).innerHTML = s ? `Baki: <b>${esc(fq(s.baki, s))}</b>${s.lokasi ? ' · ' + esc(s.lokasi) : ''} · ${esc(katLabel(s.kategori))}` : '';
    f.u.hidden = !(s && s.isiPek > 1);
    f.u.innerHTML = s && s.isiPek > 1 ? `<option value="pek">${esc(s.unitPek)}</option><option value="asas">${esc(s.unit)}</option>` : '';
    if (s && s.isiPek <= 1) $('#qInfo', d).textContent = s.unit;
    if (J === 'I') f.luput.innerHTML = '<option value="">Auto (FEFO — luput terawal dahulu)</option>' + (s ? s.kelompok.filter((b) => b.baki > 0).map((b) => `<option value="${esc(b.luput)}" ${o.kelompok === b.luput ? 'selected' : ''}>${b.luput ? dmy(b.luput) : 'Tiada tarikh luput'} · baki ${esc(fq(b.baki, s))}${b.status === 'luput' ? ' (TELAH LUPUT)' : ''}</option>`).join('') : '');
    infoQ();
  };
  const infoQ = () => { const s = itemOf(kodDari(f.item.value)); if (s && s.isiPek > 1) $('#qInfo', d).textContent = f.qty.value ? `= ${(f.u.value === 'pek' ? f.qty.value * s.isiPek : f.qty.value)} ${s.unit}` : `1 ${s.unitPek} = ${s.isiPek} ${s.unit}`; };
  f.item.oninput = kemas; f.qty.oninput = infoQ; f.u.onchange = infoQ; kemas();
  if (lupus && o.kelompok !== undefined) { const s = itemOf(kod), b = s && s.kelompok.find((x) => x.luput === o.kelompok); if (b) { f.u.value = 'asas'; f.qty.value = b.baki; f.catatan.value = b.status === 'luput' ? 'Telah luput' : 'Hampir luput'; infoQ(); } }
  $('[data-imbas]', d).onclick = () => imbas((k) => { f.item.value = `${k} — ${itemOf(k).desk}`; kemas(); f.qty.focus(); });
  if (!kod) f.item.focus(); else f.qty.focus();
  $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    const k = kodDari(f.item.value);
    if (!k) return toast('Pilih item daripada senarai', 'bad');
    if (lupus && f.catatan.value.trim().length < 3) return toast('Nyatakan sebab pelupusan', 'bad');
    try {
      const r = await api('inventori.tambahTx', { jenis: J, jenisTx: lupus ? 'LUPUS' : 'GUNA', kod: k, tarikh: f.tarikh.value, kuantiti: f.qty.value, dalamPek: !f.u.hidden && f.u.value === 'pek',
        luput: f.luput.value, catatan: f.catatan.value.trim(), pembekal: f.pembekal ? f.pembekal.value.trim() : '', noDO: f.noDO ? f.noDO.value.trim() : '', reqId: rid });
      d.close(); toast(`${J === 'R' ? 'Diterima' : lupus ? 'Dilupuskan' : 'Dikeluarkan'} ${r.q} · baki ${r.bakiQ}`, 'ok'); await muatSemula();
    } catch (err) { ralat(err); }
  });
}

function borangUbahTx(t, s) {
  const J = t.jenis, pek = s && s.isiPek > 1 && t.qty % s.isiPek === 0;
  const kel = J === 'I' && s ? s.kelompok.filter((b) => b.luput).map((b) => b.luput) : [];
  if (J === 'I' && t.luput && !kel.includes(t.luput)) kel.push(t.luput);
  const d = dialog({
    tajuk: 'Ubah rekod ' + ((JTX[t.jenisTx] || [t.jenisTx])[0]).toLowerCase(), badge: t.id, saiz: 'sm',
    badan: `<p class="small muted" style="margin:0 0 12px">${esc(t.kod)} — ${esc((s || {}).desk || '')}</p>
      ${t.semakan ? `<div class="note-box small">Perlu semakan: ${esc(t.semakan)}</div>` : ''}
      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px">
        <label class="field"><span>Tarikh</span><input class="in" type="date" id="uT" value="${esc(t.tarikh)}" max="${hariIni()}"></label>
        <label class="field"><span>Kuantiti</span><div class="row" style="flex-wrap:nowrap;gap:6px"><input class="in" type="number" min="1" id="uQ" value="${pek ? t.qty / s.isiPek : t.qty}">${s && s.isiPek > 1 ? `<select class="in" id="uU" style="width:auto"><option value="pek" ${pek ? 'selected' : ''}>${esc(s.unitPek)}</option><option value="asas" ${pek ? '' : 'selected'}>${esc(s.unit)}</option></select>` : ''}</div></label></div>
      <label class="field"><span>${J === 'R' ? 'Tarikh luput' : 'Kelompok'}</span>${J === 'R' ? `<input class="in" type="date" id="uL" value="${esc(t.luput)}">` : `<select class="in" id="uL"><option value="">Auto (FEFO)</option>${kel.map((k) => `<option value="${esc(k)}" ${k === t.luput ? 'selected' : ''}>${esc(/^\d{4}-/.test(k) ? dmy(k) : k)}</option>`).join('')}</select>`}</label>
      ${J === 'R' ? `<div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px"><label class="field"><span>Pembekal</span><input class="in" id="uP" value="${esc(t.pembekal)}"></label><label class="field"><span>No. DO</span><input class="in" id="uD" value="${esc(t.noDO)}"></label></div>` : ''}
      <label class="field"><span>${t.jenisTx === 'LUPUS' ? 'Sebab pelupusan' : 'Catatan'}</span><input class="in" id="uC" value="${esc(t.catatan)}"></label>
      ${t.semakan ? '<label class="switch"><input type="checkbox" id="uS" checked> Tanda sudah disemak</label>' : ''}`,
    kaki: `<button class="btn bad" data-batal>Batalkan rekod</button><span class="spacer"></span><button class="btn" data-tutup>Tutup</button><button class="btn pri" data-ok>Simpan</button>`
  });
  $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    try {
      await api('inventori.ubahTx', { jenis: J, id: t.id, tarikh: $('#uT', d).value, kuantiti: $('#uQ', d).value, dalamPek: $('#uU', d) ? $('#uU', d).value === 'pek' : false, luput: $('#uL', d).value,
        catatan: $('#uC', d).value.trim(), pembekal: $('#uP', d) ? $('#uP', d).value.trim() : '', noDO: $('#uD', d) ? $('#uD', d).value.trim() : '', selesaiSemak: $('#uS', d) ? $('#uS', d).checked : false });
      d.close(); toast('Dikemas kini', 'ok'); await muatSemula();
    } catch (err) { ralat(err); }
  });
  $('[data-batal]', d).onclick = () => {
    const dd = dialog({ tajuk: 'Batalkan rekod ' + t.id, saiz: 'sm', badan: '<label class="field" style="margin:0"><span>Sebab pembatalan *</span><input class="in" id="sb" maxlength="200"></label><p class="small muted">Rekod tidak dipadam; ia ditanda dibatalkan dan tidak dikira dalam baki.</p>', kaki: '<button class="btn" data-tutup>Kembali</button><button class="btn bad" data-ok>Batalkan</button>' });
    $('[data-ok]', dd).onclick = (ev) => sibuk(ev.currentTarget, async () => {
      try { await api('inventori.batalTx', { jenis: J, id: t.id, sebab: $('#sb', dd).value.trim() }); dd.close(); d.close(); toast('Rekod dibatalkan', 'ok'); await muatSemula(); } catch (err) { ralat(err); }
    });
  };
}

/* ============================ TRANSAKSI ============================ */
const tapisTx = { jenis: 'I', jenisTx: '', q: '', dari: '', hingga: '', hal: 0, semak: false };
async function lTx(el) {
  const t = tapisTx;
  const pilih = [['R', '', 'Penerimaan'], ['I', 'GUNA', 'Penggunaan'], ['I', 'LUPUS', 'Pelupusan'], ['I', '', 'Semua keluaran']];
  el.innerHTML = `<div class="chips" style="margin-bottom:10px">${pilih.map(([j, x, n]) => `<button class="chip ${t.jenis === j && t.jenisTx === x ? 'on' : ''}" data-j="${j}" data-x="${x}">${n}</button>`).join('')}
      <button class="chip ${t.semak ? 'on' : ''}" data-semak>${ic('alert')} Perlu semakan</button></div>
    <div class="row" style="margin-bottom:12px"><div class="search" style="flex:1 1 240px">${ic('search')}<input class="in" id="tq" type="search" placeholder="Cari ID, item, catatan, pembekal, oleh" value="${esc(t.q)}"></div>
      <label class="row small" style="gap:6px;flex:none">Dari <input class="in" type="date" id="td" value="${t.dari}" style="width:auto"></label><label class="row small" style="gap:6px;flex:none">Hingga <input class="in" type="date" id="th" value="${t.hingga}" style="width:auto"></label>
      ${D.boleh.tulis ? `<button class="btn pri" id="tB">${ic('plus')} ${t.jenis === 'R' ? 'Terima' : t.jenisTx === 'LUPUS' ? 'Lupus' : 'Keluar'}</button>` : ''}</div>
    <div class="card scroll-x"><table class="tbl"><thead><tr><th>Tarikh</th><th>Item</th><th>Jenis</th><th style="text-align:right">Kuantiti</th><th>${t.jenis === 'R' ? 'Luput / pembekal' : 'Kelompok'}</th><th>Oleh / catatan</th><th></th></tr></thead><tbody id="tb"><tr><td colspan="7"><div class="skel" style="height:80px"></div></td></tr></tbody></table></div>
    <div class="row" style="margin-top:12px"><span class="small muted" id="tc"></span><span class="spacer"></span><button class="btn sm" id="tp">‹ Baru</button><button class="btn sm" id="tn">Lama ›</button></div>`;
  let rows = [];
  const muatT = async () => {
    try {
      const r = await api('inventori.tx', { jenis: t.jenis, jenisTx: t.jenisTx, q: t.q, dari: t.dari, hingga: t.hingga, halaman: t.hal, kategori: kat, semak: t.semak });
      rows = r.rows;
      $('#tb', el).innerHTML = rows.map((x) => `<tr class="click" data-buka="${esc(x.kod)}"${x.status === 'DIBATALKAN' ? ' style="opacity:.5"' : ''}><td class="small" style="white-space:nowrap">${esc(dmy(x.tarikh))}<div class="muted">${esc(x.id)}</div></td>
        <td><b>${esc(x.desk || x.kod)}</b><div class="small muted">${esc(x.kod)} ${x.kategori ? katChip(x.kategori) : ''}</div></td><td>${bdg(JTX[x.jenisTx] || [x.jenisTx, 'grey'])}${x.semakan ? ` <span class="badge warn" title="${esc(x.semakan)}">Semak</span>` : ''}</td>
        <td style="text-align:right;white-space:nowrap"><b>${esc(x.q)}</b></td>
        <td class="small">${esc(x.luput ? (/^\d{4}-/.test(x.luput) ? dmy(x.luput) : x.luput) : t.jenis === 'I' ? 'Auto (FEFO)' : '—')}${x.pembekal ? `<div class="muted">${esc(x.pembekal)}${x.noDO ? ' · DO ' + esc(x.noDO) : ''}</div>` : ''}</td>
        <td class="small">${esc(x.olehNama)}${x.status === 'DIBATALKAN' ? ' <span class="badge grey">Dibatalkan</span>' : ''}${x.catatan ? `<div class="muted">${esc(x.catatan)}</div>` : ''}</td>
        <td>${x.boleh ? `<button class="btn ghost icon" data-ubah="${esc(x.id)}" aria-label="Ubah">${ic('edit')}</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="7" class="muted">Tiada rekod.</td></tr>';
      $('#tc', el).textContent = `${r.jumlah} rekod · halaman ${t.hal + 1} / ${Math.max(1, Math.ceil(r.jumlah / r.saiz))}`;
      $('#tp', el).disabled = t.hal === 0; $('#tn', el).disabled = (t.hal + 1) * r.saiz >= r.jumlah;
    } catch (e) { ralat(e); }
  };
  $$('[data-j]', el).forEach((b) => (b.onclick = () => { t.jenis = b.dataset.j; t.jenisTx = b.dataset.x; t.hal = 0; lTx(el); }));
  $('[data-semak]', el).onclick = () => { t.semak = !t.semak; t.hal = 0; lTx(el); };
  $('#tq', el).oninput = debounce((e) => { t.q = e.target.value; t.hal = 0; muatT(); }, 300);
  $('#td', el).onchange = (e) => { t.dari = e.target.value; t.hal = 0; muatT(); };
  $('#th', el).onchange = (e) => { t.hingga = e.target.value; t.hal = 0; muatT(); };
  $('#tp', el).onclick = () => { t.hal = Math.max(0, t.hal - 1); muatT(); };
  $('#tn', el).onclick = () => { t.hal++; muatT(); };
  const tb = $('#tB', el); if (tb) tb.onclick = () => borangTx(t.jenis, '', { lupus: t.jenisTx === 'LUPUS' });
  el.onclick = (e) => {
    const u = e.target.closest('[data-ubah]');
    if (u) { e.stopPropagation(); const x = rows.find((y) => y.id === u.dataset.ubah); return borangUbahTx(x, itemOf(x.kod)); }
    const r = e.target.closest('[data-buka]'); if (r) butiranItem(r.dataset.buka);
  };
  muatT();
}

/* ============================ KIRAAN STOK ============================ */
async function lKiraan(el, id) {
  el.innerHTML = '<div class="skel" style="height:200px"></div>';
  let L;
  try { L = await api('inventori.kiraan', id ? { id } : {}); } catch (e) { el.innerHTML = `<div class="card empty"><p>${esc(e.message)}</p></div>`; return; }
  if (id) return lKiraanSatu(el, L);
  const aktif = L.find((k) => k.status === 'DRAF' || k.status === 'DIHANTAR');
  const ST = { DRAF: ['Draf', 'grey'], DIHANTAR: ['Menunggu pengesahan', 'warn'], DISAHKAN: ['Disahkan', 'ok'], DIBATALKAN: ['Dibatalkan', 'grey'] };
  el.innerHTML = `<section class="card pad"><div class="row"><div style="flex:1;min-width:220px"><b>Kiraan stok fizikal</b><p class="small muted" style="margin:4px 0 0">Kira stok sebenar di rak, isi angka, hantar. Admin mengesahkan dan sistem merekod pelarasan (+/−) bagi setiap beza.</p></div>
      ${aktif ? `<button class="btn pri" data-buka="${esc(aktif.id)}">${ic('list')} Teruskan kiraan aktif</button>` : `<button class="btn pri" id="kMula">${ic('plus')} Mula kiraan baharu</button>`}</div></section>
    <div class="card scroll-x" style="margin-top:14px"><table class="tbl"><thead><tr><th>Tarikh</th><th>Skop</th><th>Status</th><th>Diisi</th><th>Oleh</th><th>Disahkan</th></tr></thead><tbody>${L.map((k) => `<tr class="click" data-buka="${esc(k.id)}">
      <td class="small">${esc(dmy(k.tarikh))}<div class="muted">${esc(k.id)}</div></td><td class="small">${esc(k.skop)}</td><td>${bdg(ST[k.status] || [k.status, 'grey'])}</td><td class="small">${k.diisi} / ${k.bil}</td><td class="small">${esc(k.olehNama)}</td><td class="small">${esc(k.disahkanOleh)}${k.disahkanPada ? '<div class="muted">' + esc(masaRingkas(k.disahkanPada)) + '</div>' : ''}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Belum ada kiraan.</td></tr>'}</tbody></table></div>`;
  el.onclick = (e) => { const r = e.target.closest('[data-buka]'); if (r) lKiraan(el, r.dataset.buka); };
  const m = $('#kMula', el);
  if (m) m.onclick = () => {
    const d = dialog({ tajuk: 'Mula kiraan stok', saiz: 'sm',
      badan: `<p class="small muted" style="margin:0 0 12px">Skop kiraan: ${kat.length ? esc(kat.map(katLabel).join(', ')) : 'semua kategori'} (ikut penapis kategori di atas).</p>
        ${D.lokasi.length ? `<label class="field"><span>Lokasi</span><select class="in" id="kL"><option value="">Semua lokasi</option>${D.lokasi.map((l) => `<option>${esc(l.nilai)}</option>`).join('')}</select></label>` : ''}
        <label class="field" style="margin:0"><span>Catatan</span><input class="in" id="kC" placeholder="cth Kiraan bulanan November"></label>`,
      kaki: `<button class="btn" data-tutup>Batal</button><button class="btn pri" data-ok>Mula</button>` });
    $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
      try { const k = await api('inventori.kiraanMula', { kategori: kat, lokasi: $('#kL', d) ? $('#kL', d).value : '', catatan: $('#kC', d).value.trim() }); d.close(); lKiraanSatu(el, k); } catch (err) { ralat(err); }
    });
  };
}
function lKiraanSatu(el, k) {
  const boleh = k.status === 'DRAF' || (k.status === 'DIHANTAR' && D.boleh.admin);
  const rows = k.baris.map((b) => ({ ...b, s: itemOf(b.kod) || { kod: b.kod, desk: b.kod, unit: '', isiPek: 1 } })).sort((a, b) => (a.s.lokasi || '~').localeCompare(b.s.lokasi || '~') || a.s.desk.localeCompare(b.s.desk));
  const nPek = (b) => (b.s.isiPek > 1 && b.fizikal != null ? Math.floor(b.fizikal / b.s.isiPek) : '');
  const nAsas = (b) => (b.fizikal == null ? '' : b.s.isiPek > 1 ? b.fizikal % b.s.isiPek : b.fizikal);
  el.innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn ghost" id="kBalik">‹ Senarai kiraan</button><span style="flex:1"><b>${esc(k.id)}</b> · ${esc(dmy(k.tarikh))} · ${esc(k.skop)} <span class="badge">${esc(k.status)}</span></span>
      <button class="btn" id="kCetak">${ic('print')} Cetak borang</button></div>
    <div class="card scroll-x"><table class="tbl inv-kira"><thead><tr><th>Item</th><th>Lokasi</th><th style="text-align:right">Sistem</th><th>Kiraan fizikal</th><th style="text-align:right">Beza</th><th>Catatan</th></tr></thead><tbody>${rows.map((b) => `<tr data-k="${esc(b.kod)}">
      <td><b>${esc(b.s.desk)}</b><div class="small muted">${esc(b.kod)}</div></td><td class="small">${esc(b.s.lokasi || '—')}</td><td style="text-align:right;white-space:nowrap">${esc(fq(b.sistem, b.s))}</td>
      <td style="white-space:nowrap">${b.s.isiPek > 1 ? `<input class="in" type="number" min="0" data-p value="${nPek(b)}" ${boleh ? '' : 'disabled'}> <small>${esc(b.s.unitPek)}</small> + ` : ''}<input class="in" type="number" min="0" data-a value="${nAsas(b)}" ${boleh ? '' : 'disabled'}> <small>${esc(b.s.unit)}</small></td>
      <td style="text-align:right" data-beza></td><td><input class="in" data-c value="${esc(b.catatan || '')}" ${boleh ? '' : 'disabled'} placeholder="—"></td></tr>`).join('')}</tbody></table></div>
    <div class="row" style="margin-top:12px"><span class="small muted" id="kInfo"></span><span class="spacer"></span>
      ${boleh ? `<button class="btn" id="kSimpan">Simpan draf</button>` : ''}${k.status === 'DRAF' ? `<button class="btn pri" id="kHantar">${ic('check')} Hantar untuk pengesahan</button>` : ''}
      ${k.status === 'DIHANTAR' && D.boleh.admin ? `<button class="btn bad" id="kBatal">Batalkan</button><button class="btn pri" id="kSah">${ic('check')} Sahkan & rekod pelarasan</button>` : ''}
      ${k.status === 'DRAF' && D.boleh.admin ? `<button class="btn bad ghost" id="kBatal">Batalkan</button>` : ''}</div>`;
  const nilai = (tr) => { const s = itemOf(tr.dataset.k) || { isiPek: 1 }, p = $('[data-p]', tr), a = $('[data-a]', tr); if ((!p || p.value === '') && a.value === '') return null; return (p ? Number(p.value || 0) * s.isiPek : 0) + Number(a.value || 0); };
  const kira = () => {
    let diisi = 0, beza = 0;
    $$('tr[data-k]', el).forEach((tr) => {
      const b = rows.find((x) => x.kod === tr.dataset.k), v = nilai(tr), c = $('[data-beza]', tr);
      if (v === null) { c.innerHTML = '<span class="muted">—</span>'; return; }
      diisi++; const d = v - b.sistem; if (d) beza++;
      c.innerHTML = d ? `<b style="color:${d > 0 ? 'var(--ok)' : 'var(--bad)'}">${d > 0 ? '+' : ''}${esc(fq(d, b.s))}</b>` : '<span class="badge ok">Sama</span>';
    });
    $('#kInfo', el).textContent = `${diisi} / ${rows.length} item dikira · ${beza} berbeza`;
  };
  kira();
  el.oninput = debounce(kira, 120);
  el.onclick = null;
  const data = () => $$('tr[data-k]', el).map((tr) => ({ kod: tr.dataset.k, fizikal: nilai(tr), catatan: $('[data-c]', tr).value.trim() }));
  $('#kBalik', el).onclick = () => lKiraan(el);
  $('#kCetak', el).onclick = () => cetakJadual(`Borang Kiraan Stok ${k.id}`, `${dmy(k.tarikh)} · ${k.skop}`, ['Item', 'Kod', 'Lokasi', 'Sistem', 'Kiraan fizikal', 'Catatan'], rows.map((b) => [b.s.desk, b.kod, b.s.lokasi || '', fq(b.sistem, b.s), b.fizikal == null ? '' : fq(b.fizikal, b.s), b.catatan || '']));
  const on = (sel, fn) => { const b = $(sel, el); if (b) b.onclick = fn; };
  on('#kSimpan', (e) => sibuk(e.currentTarget, async () => { try { lKiraanSatu(el, await api('inventori.kiraanSimpan', { id: k.id, baris: data() })); toast('Draf disimpan', 'ok'); } catch (err) { ralat(err); } }));
  on('#kHantar', async (e) => { const b = e.currentTarget; if (!(await sahkan('Hantar kiraan ini untuk pengesahan admin?', { ya: 'Hantar' }))) return; sibuk(b, async () => { try { lKiraanSatu(el, await api('inventori.kiraanSimpan', { id: k.id, baris: data(), hantar: true })); toast('Kiraan dihantar', 'ok'); } catch (err) { ralat(err); } }); });
  on('#kSah', async (e) => {
    const b = e.currentTarget;
    if (!(await sahkan('Sahkan kiraan ini? Rekod pelarasan akan dicipta bagi setiap item yang berbeza.', { ya: 'Sahkan' }))) return;
    sibuk(b, async () => { try { await api('inventori.kiraanSimpan', { id: k.id, baris: data() }); const r = await api('inventori.kiraanSahkan', { id: k.id }); toast(`${r.pelarasan} pelarasan direkod`, 'ok'); await muat(); lKiraanSatu(el, r); } catch (err) { ralat(err); } });
  });
  on('#kBatal', async (e) => { const b = e.currentTarget; if (!(await sahkan('Batalkan kiraan ini?', { ya: 'Batalkan', bahaya: true }))) return; sibuk(b, async () => { try { lKiraanSatu(el, await api('inventori.kiraanSahkan', { id: k.id, batal: true })); } catch (err) { ralat(err); } }); });
}

/* ============================ URUS (lokasi, pembekal, label) ============================ */
function lUrus(el) {
  const senarai = (nama, tajukS, L, ket) => `<section class="card pad"><div class="row" style="margin-bottom:6px"><b style="flex:1">${tajukS}</b><button class="btn pri sm" data-s="${nama}">Simpan</button></div>
    <p class="small muted" style="margin:0 0 10px">${ket}</p><textarea class="in" data-t="${nama}" rows="7" placeholder="Satu setiap baris">${esc(L.map((x) => x.nilai).join('\n'))}</textarea></section>`;
  const L = items().filter((s) => s.aktif);
  el.innerHTML = `<div class="grid inv-g2" style="margin-top:0">${senarai('INVENTORI_LOKASI', 'Lokasi simpanan', D.lokasi, 'Satu lokasi setiap baris (cth Stor A / Rak 2, Bilik bersih, Peti sejuk).')}${senarai('INVENTORI_PEMBEKAL', 'Pembekal', D.pembekal, 'Senarai cadangan semasa merekod penerimaan.')}</div>
    <section class="card pad" style="margin-top:16px"><div class="row" style="margin-bottom:8px"><b style="flex:1">Cetak label pelekat (100 × 50 mm)</b><label class="switch small"><input type="checkbox" id="lSemua"> Pilih semua</label><button class="btn pri sm" id="lCetak">${ic('print')} Cetak label</button></div>
      <p class="small muted" style="margin:0 0 10px">Label mengandungi kod QR, kod bar, nama item, kod, lokasi & unit pek. Imbas label untuk terus membuka item. Tetapkan saiz kertas pencetak kepada 100 × 50 mm.</p>
      <div class="inv-lblpilih">${L.map((s) => `<label><input type="checkbox" value="${esc(s.kod)}"> ${esc(s.desk)} <small class="muted">${esc(s.kod)}</small></label>`).join('')}</div></section>`;
  $$('[data-s]', el).forEach((b) => (b.onclick = () => sibuk(b, async () => {
    try { await api('inventori.senarai', { senarai: b.dataset.s, item: $(`[data-t="${b.dataset.s}"]`, el).value.split('\n').map((x) => x.trim()).filter(Boolean) }); toast('Disimpan', 'ok'); await muatSemula(); } catch (err) { ralat(err); }
  })));
  $('#lSemua', el).onchange = (e) => $$('.inv-lblpilih input', el).forEach((c) => (c.checked = e.target.checked));
  $('#lCetak', el).onclick = () => { const k = $$('.inv-lblpilih input', el).filter((c) => c.checked).map((c) => c.value); if (!k.length) return toast('Pilih item', 'bad'); cetakLabel(k); };
}

/* ---------- label 100×50 mm ---------- */
async function cetakLabel(kods) {
  try { await Promise.all([muatSkrip(CDN.qr), muatSkrip(CDN.bar)]); } catch (e) { return ralat(e); }
  const el = document.createElement('div');
  el.id = 'cetak';
  el.className = 'lbl-wrap';
  el.innerHTML = kods.map((k) => {
    const s = itemOf(k); if (!s) return '';
    const qr = window.qrcode(0, 'M'); qr.addData('UPAR:INV:' + s.kod); qr.make();
    return `<div class="lbl"><div class="lbl-qr">${qr.createSvgTag({ cellSize: 3, margin: 0 })}</div>
      <div class="lbl-t"><b>${esc(s.desk)}</b><span>${esc(s.kod)}${s.kodHospital ? ' · ' + esc(s.kodHospital) : ''}</span>
        <span>${s.lokasi ? '📍 ' + esc(s.lokasi) : ''}${s.isiPek > 1 ? (s.lokasi ? ' · ' : '') + `1 ${esc(s.unitPek)} = ${s.isiPek} ${esc(s.unit)}` : ''}</span>
        <svg class="lbl-bar" data-kod="${esc(s.kodHospital || s.kod)}"></svg><small>${esc(katLabel(s.kategori))} · UPAR</small></div></div>`;
  }).join('');
  document.body.appendChild(el);
  $$('.lbl-bar', el).forEach((sv) => { try { window.JsBarcode(sv, sv.dataset.kod, { format: 'CODE128', height: 26, width: 1.1, displayValue: false, margin: 0 }); } catch (e) { sv.remove(); } });
  document.body.classList.add('mencetak', 'cetak-label');
  const habis = () => { el.remove(); document.body.classList.remove('mencetak', 'cetak-label'); removeEventListener('afterprint', habis); };
  addEventListener('afterprint', habis);
  setTimeout(() => print(), 120);
}

/* ---------- imbas kod bar / QR ---------- */
async function imbas(apabila) {
  let strim = null, henti = false, pembaca = null;
  const d = dialog({ tajuk: 'Imbas kod bar / QR', saiz: 'sm',
    badan: `<div class="imbas"><video playsinline muted></video><i></i></div><p class="small muted" id="imMsg" style="margin:10px 0 0">Halakan kamera ke label QR, kod bar Kod Hospital, atau kod pada kotak.</p>
      <div class="row" style="margin-top:10px;flex-wrap:nowrap"><input class="in" id="imK" placeholder="atau taip kod"><button class="btn" id="imOk">Cari</button></div>`,
    onClose: () => { henti = true; if (strim) strim.getTracks().forEach((t) => t.stop()); if (pembaca && pembaca.reset) pembaca.reset(); } });
  const jumpa = (teks) => {
    const t = String(teks || '').trim().replace(/^UPAR:INV:/, ''), k = kodDari(t);
    if (!k) { $('#imMsg', d).innerHTML = `<b style="color:var(--bad)">Kod "${esc(t)}" tidak sepadan dengan mana-mana item.</b>`; return false; }
    if (navigator.vibrate) navigator.vibrate(60);
    d.close(); apabila(k); return true;
  };
  $('#imOk', d).onclick = () => jumpa($('#imK', d).value);
  $('#imK', d).onkeydown = (e) => { if (e.key === 'Enter') jumpa(e.target.value); };
  const video = $('video', d);
  try {
    strim = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    video.srcObject = strim; await video.play();
  } catch (e) { $('#imMsg', d).textContent = 'Kamera tidak dapat dibuka (' + (e.message || e.name) + '). Taip kod di bawah.'; return; }
  if ('BarcodeDetector' in window) {
    const det = new window.BarcodeDetector();
    const ulang = async () => {
      if (henti) return;
      try { const r = await det.detect(video); if (r.length && jumpa(r[0].rawValue)) return; } catch (e) {}
      setTimeout(ulang, 250);
    };
    ulang();
  } else {
    try {
      await muatSkrip(CDN.zxing);
      pembaca = new window.ZXing.BrowserMultiFormatReader();
      pembaca.decodeFromVideoElementContinuously(video, (res) => { if (res && !henti) jumpa(res.getText()); });
    } catch (e) { $('#imMsg', d).textContent = 'Pengimbas tidak tersedia pada pelayar ini. Taip kod di bawah.'; }
  }
}

/* ============================ LAPORAN ============================ */
const lap = { jenis: 'baki', q: '', dari: '', hingga: '', tahun: '', status: '', kod: '', lokasi: '' };
let hasilLap = null;
function lLaporan(el) {
  const j = lap.jenis, perluTempoh = ['penerimaan', 'pengeluaran', 'lupus', 'pelarasan', 'item', 'bulanan'].includes(j), perluTahun = ['tahunan', 'analisis'].includes(j);
  el.innerHTML = `<section class="card pad"><div class="grid inv-lapf">
      <label class="field"><span>Laporan</span><select class="in" id="lJ">${LAPORAN.map(([k, n]) => `<option value="${k}" ${k === j ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      ${j === 'item' ? pilihItemHTML(lap.kod, 'Item') : `<label class="field"><span>Cari kod / deskripsi</span><input class="in" id="lQ" value="${esc(lap.q)}"></label>`}
      ${D.lokasi.length && j !== 'item' ? `<label class="field"><span>Lokasi</span><select class="in" id="lL"><option value="">Semua</option>${D.lokasi.map((l) => `<option ${lap.lokasi === l.nilai ? 'selected' : ''}>${esc(l.nilai)}</option>`).join('')}</select></label>` : ''}
      ${perluTempoh ? `<label class="field"><span>Dari</span><input class="in" type="date" id="lD" value="${lap.dari}"></label><label class="field"><span>Hingga</span><input class="in" type="date" id="lH" value="${lap.hingga}"></label>` : ''}
      ${perluTahun ? `<label class="field"><span>Tahun</span><select class="in" id="lT">${D.tahun.map((y) => `<option ${y === lap.tahun ? 'selected' : ''}>${y}</option>`).join('')}</select></label>` : ''}
      ${j === 'baki' || j === 'perancangan' ? `<label class="field"><span>Status</span><select class="in" id="lS"><option value="">Semua</option>${j === 'baki' ? Object.entries(STOK).map(([k, v]) => `<option value="${k}" ${lap.status === k ? 'selected' : ''}>${v[0]}</option>`).join('') : ''}<option value="tempah" ${lap.status === 'tempah' ? 'selected' : ''}>Perlu tempahan</option></select></label>` : ''}
    </div><div class="row"><button class="btn pri" id="lGo">${ic('list')} Jana laporan</button><span class="spacer"></span>
      <button class="btn" id="lPr" ${hasilLap ? '' : 'disabled'}>${ic('print')} Cetak</button><button class="btn" id="lXl" ${hasilLap && hasilLap.lajur.length ? '' : 'disabled'}>${ic('install')} Excel</button></div>
      <p class="small muted" style="margin:10px 0 0">${kat.length ? 'Kategori: ' + kat.map(katLabel).join(', ') : 'Semua kategori'}</p></section>
    <div id="lOut" style="margin-top:16px">${hasilLap ? paparLap(hasilLap) : ''}</div>`;
  const baca = () => {
    lap.jenis = $('#lJ', el).value;
    if ($('#lQ', el)) lap.q = $('#lQ', el).value.trim();
    if ($('[name=item]', el)) lap.kod = kodDari($('[name=item]', el).value);
    if ($('#lL', el)) lap.lokasi = $('#lL', el).value;
    if ($('#lD', el)) lap.dari = $('#lD', el).value;
    if ($('#lH', el)) lap.hingga = $('#lH', el).value;
    if ($('#lT', el)) lap.tahun = $('#lT', el).value;
    if ($('#lS', el)) lap.status = $('#lS', el).value;
  };
  $('#lJ', el).onchange = () => { baca(); hasilLap = null; lap.status = ''; lLaporan(el); };
  const im = $('[data-imbas]', el); if (im) im.onclick = () => imbas((k) => { $('[name=item]', el).value = `${k} — ${itemOf(k).desk}`; });
  $('#lGo', el).onclick = (e) => sibuk(e.currentTarget, async () => {
    baca();
    if (lap.jenis === 'item' && !lap.kod) return toast('Pilih item', 'bad');
    try { hasilLap = await api('inventori.laporan', { ...lap, kategori: kat }); lLaporan(el); } catch (err) { ralat(err); }
  });
  $('#lPr', el).onclick = () => (hasilLap.jenis === 'analisis' ? cetakHTML(hasilLap.tajuk, '', paparLap(hasilLap)) : cetakJadual(hasilLap.tajuk, hasilLap.subtajuk, hasilLap.lajur.map((c) => c.l), hasilLap.baris, hasilLap.kaki, hasilLap.lajur));
  $('#lXl', el).onclick = () => excelLap(hasilLap);
}
function paparLap(r) {
  if (r.jenis === 'analisis') {
    return `<section class="card pad"><b>${esc(r.tajuk)} — bilangan transaksi</b>${carta(r.bulanan.map((b) => ({ l: BULAN[b.m - 1], v: [b.nIn, b.nOut, b.nLupus] })))}
      <div class="h5">10 item paling banyak digunakan</div><table class="tbl"><thead><tr><th>#</th><th>Item</th><th style="text-align:right">Jumlah guna</th></tr></thead><tbody>${r.teratas.map((x, i) => `<tr><td>${i + 1}</td><td><b>${esc(x.desk)}</b> <span class="small muted">${esc(x.kod)}</span></td><td style="text-align:right"><b>${esc(x.q)}</b></td></tr>`).join('') || '<tr><td colspan="3" class="muted">Tiada penggunaan.</td></tr>'}</tbody></table></section>`;
  }
  return `<section class="card"><div class="pad" style="padding-bottom:8px"><b>${esc(r.tajuk)}</b><div class="small muted">${esc(r.subtajuk)} · ${r.baris.length} baris</div></div>
    <div class="scroll-x"><table class="tbl"><thead><tr>${r.lajur.map((c) => `<th${c.a ? ' style="text-align:right"' : ''}>${esc(c.l)}</th>`).join('')}</tr></thead>
    <tbody>${r.baris.slice(0, 1500).map((row) => `<tr>${row.map((v, i) => `<td${r.lajur[i].a ? ' style="text-align:right"' : ''}>${esc(r.lajur[i].l === 'Kategori' ? katLabel(v) : v)}</td>`).join('')}</tr>`).join('') || `<tr><td colspan="${r.lajur.length}" class="muted">Tiada data.</td></tr>`}</tbody></table></div>
    ${r.baris.length > 1500 ? '<p class="small muted pad">1500 baris pertama dipaparkan — guna Excel untuk semua.</p>' : ''}${r.kaki ? `<p class="small pad" style="margin:0"><b>${esc(r.kaki)}</b></p>` : ''}</section>`;
}
function jenamaTeks() { const j = (S.boot && S.boot.jenama) || {}; return [j.subjudul, j.jabatan].filter(Boolean).join(' · '); }
function cetakHTML(tajukC, sub, isi) {
  const el = document.createElement('div');
  el.id = 'cetak';
  el.innerHTML = `<div class="ct-h"><div><b>${esc(tajukC)}</b><small>${esc(jenamaTeks())}</small></div><small>${esc(sub || '')}${kat.length ? ' · ' + esc(kat.map(katLabel).join(', ')) : ''}</small></div>${isi}`;
  document.body.appendChild(el);
  document.body.classList.add('mencetak', 'cetak-tegak');
  const habis = () => { el.remove(); document.body.classList.remove('mencetak', 'cetak-tegak'); removeEventListener('afterprint', habis); };
  addEventListener('afterprint', habis);
  setTimeout(() => print(), 50);
}
function cetakJadual(tajukC, sub, lajur, baris, kaki, meta) {
  cetakHTML(tajukC, sub, `<table class="ct inv-ct"><thead><tr>${lajur.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${baris.map((row) => `<tr>${row.map((v, i) => `<td style="text-align:${meta && meta[i].a ? 'right' : 'left'}">${esc(meta && meta[i].l === 'Kategori' ? katLabel(v) : v)}</td>`).join('')}</tr>`).join('')}</tbody></table>${kaki ? `<p><b>${esc(kaki)}</b></p>` : ''}`);
}
function excelLap(r) {
  if (!r || !r.lajur.length) return;
  const td = 'border:1px solid #cbd5e1;font-size:10pt;';
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table style="border-collapse:collapse;font-family:Arial">
    <tr><td colspan="${r.lajur.length}" style="font-size:14pt;font-weight:bold">${esc(r.tajuk)}</td></tr><tr><td colspan="${r.lajur.length}" style="color:#64748b">${esc(r.subtajuk || '')} · ${esc(jenamaTeks())}</td></tr>
    <tr>${r.lajur.map((c) => `<th style="${td}background:#e0e7ff">${esc(c.l)}</th>`).join('')}</tr>
    ${r.baris.map((row) => `<tr>${row.map((v, i) => `<td style="${td}${r.lajur[i].a ? 'text-align:right' : ''}">${esc(r.lajur[i].l === 'Kategori' ? katLabel(v) : v)}</td>`).join('')}</tr>`).join('')}
    ${r.kaki ? `<tr><td colspan="${r.lajur.length}" style="font-weight:bold">${esc(r.kaki)}</td></tr>` : ''}</table></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' }));
  a.download = `Inventori-${r.jenis}-${hariIni()}.xls`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
