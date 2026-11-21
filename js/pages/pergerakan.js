// Pergerakan Staf — kalendar kongsi unit (konsep TimeTree): kalendar bulanan, grid unit, jadual saya.
import { S, tajuk } from '../app.js';
import { api } from '../api.js';
import { $, $$, esc, toast, ralat, sibuk, dialog, sahkan, simpan, ambil, namaPanggilan, inisial } from '../ui.js';
import { ic } from '../icons.js';

const BULAN = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const HARI_P = ['Ahd', 'Isn', 'Sel', 'Rab', 'Kha', 'Jum', 'Sab'];
const JENIS = { KERJA: 'Kerja / Shift', OFF: 'Off', CUTI: 'Cuti', LAIN: 'Lain-lain' };
const URUT_JENIS = ['KERJA', 'OFF', 'CUTI', 'LAIN'];
const WARNA_PASUKAN = ['#0ea5e9', '#ec4899', '#f59e0b', '#10b981', '#8b5cf6', '#ef4444', '#14b8a6', '#6366f1'];

/* ---------- tarikh (rentetan yyyy-MM-dd, waktu tempatan) ---------- */
const pad = (n) => String(n).padStart(2, '0');
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const keDate = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const tambahHari = (s, n) => { const d = keDate(s); d.setDate(d.getDate() + n); return iso(d); };
const tarikhP = (s) => { const d = keDate(s); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
const tarikhR = (s) => { const d = keDate(s); return `${d.getDate()} ${BULAN[d.getMonth()].slice(0, 3)}`; };
const namaBulan = (b) => { const [y, m] = b.split('-').map(Number); return `${BULAN[m - 1]} ${y}`; };
const hariIni = () => iso(new Date());
function masa12(hhmm) {
  if (!hhmm) return '';
  const [h, m] = hhmm.split(':').map(Number);
  return `${h % 12 || 12}:${pad(m)} ${h < 12 ? 'pg' : h < 14 ? 'tgh' : h < 19 ? 'ptg' : 'mlm'}`;
}
const waktu = (k) => (k.mula && k.tamat ? `${masa12(k.mula)} – ${masa12(k.tamat)}` : k.mula ? 'Mula ' + masa12(k.mula) : '');

/* ---------- keadaan ---------- */
const st = { bulan: hariIni().slice(0, 7), saya: false, pasukan: [], kod: '', ...pickTapis(ambil('perg.tapis', true)) };
function pickTapis(o) { return o ? { saya: !!o.saya, pasukan: Array.isArray(o.pasukan) ? o.pasukan : [], kod: o.kod || '' } : {}; }
const simpanTapis = () => simpan('perg.tapis', { saya: st.saya, pasukan: st.pasukan, kod: st.kod });
let D = null, V = 'kalendar', P = null, giliran = 0;
let kodMap = {}, kodUrut = {}, stafMap = {}, ikutTarikh = {}, cutiMap = {}, pasukanWarna = {};

const meId = () => String(S.me.stafId).toLowerCase();
const kodOf = (k) => kodMap[k] || { kod: k, label: k, jenis: 'LAIN', warna: '#94a3b8', mula: '', tamat: '', aktif: false };
const stafOf = (id) => stafMap[String(id).toLowerCase()] || { id, nama: id, pasukan: [], aktif: false };
const bolehUbah = (stafId) => D.boleh.semua || String(stafId).toLowerCase() === meId();

function indeks() {
  kodMap = {}; kodUrut = {}; stafMap = {}; ikutTarikh = {}; cutiMap = {}; pasukanWarna = {};
  D.kod.forEach((k, i) => { kodMap[k.kod] = k; kodUrut[k.kod] = i; });
  D.staf.forEach((s) => (stafMap[s.id.toLowerCase()] = s));
  D.entri.forEach((e) => (ikutTarikh[e.tarikh] = ikutTarikh[e.tarikh] || []).push(e));
  D.cuti.forEach((c) => (cutiMap[c.tarikh] = c.nama));
  D.pasukan.forEach((p, i) => (pasukanWarna[p.nilai] = WARNA_PASUKAN[i % WARNA_PASUKAN.length]));
  st.pasukan = st.pasukan.filter((p) => pasukanWarna[p]);
  if (st.kod && !kodMap[st.kod]) st.kod = '';
}
function lulusStaf(id) {
  const s = stafOf(id);
  if (st.saya && String(id).toLowerCase() !== meId()) return false;
  if (st.pasukan.length && !s.pasukan.some((p) => st.pasukan.includes(p))) return false;
  return true;
}
const lulus = (e) => lulusStaf(e.staf) && (!st.kod || e.kod === st.kod);
const tapisAktif = () => st.saya || st.pasukan.length || st.kod;
function urut(list) {
  return list.slice().sort((a, b) => {
    const ka = kodOf(a.kod), kb = kodOf(b.kod);
    return URUT_JENIS.indexOf(ka.jenis) - URUT_JENIS.indexOf(kb.jenis) || (kodUrut[a.kod] ?? 99) - (kodUrut[b.kod] ?? 99) || stafOf(a.staf).nama.localeCompare(stafOf(b.staf).nama);
  });
}
const titikPasukan = (s) => s.pasukan.map((p) => `<i class="pk-dot" style="--c:${pasukanWarna[p] || '#94a3b8'}" title="${esc(labelPasukan(p))}"></i>`).join('');
const labelPasukan = (v) => ((D && D.pasukan.find((p) => p.nilai === v)) || { label: v }).label;
const kc = (k, extra = '') => `<span class="kc" style="--c:${esc(kodOf(k).warna)}"${extra}>${esc(k)}</span>`;

/* ============================ halaman ============================ */
export async function papar(page, rest) {
  tajuk('Pergerakan Staf');
  P = page;
  V = ['grid', 'saya', 'urus'].includes(rest[0]) ? rest[0] : 'kalendar';
  page.innerHTML = `<div id="pgbar"></div><div id="pgv"><div class="skel" style="height:460px"></div></div>`;
  page.onclick = klik;
  page.onchange = (e) => { if (e.target.matches('[data-tapiskod]')) { st.kod = e.target.value; simpanTapis(); lukisSemua(); } };
  await muat();
}

async function muat() {
  const n = ++giliran, first = st.bulan + '-01', ck = 'cache.perg.' + st.bulan;
  if (D) lukisBar();
  try {
    const d = await api('pergerakan.data', { dari: tambahHari(first, -6), hingga: tambahHari(first, 41) });
    if (n !== giliran) return;
    D = d; simpan(ck, d);
  } catch (e) {
    if (n !== giliran) return;
    const c = ambil(ck, true);
    if (!c) { $('#pgv', P).innerHTML = `<div class="card empty">${ic('alert')}<p>${esc(e.message)}</p></div>`; return; }
    D = c; toast('Luar talian — memaparkan data terakhir yang disimpan', 'bad');
  }
  indeks();
  if (V === 'urus' && !D.boleh.urus) { location.hash = '#/pergerakan'; return; }
  lukisSemua();
}
function lukisSemua() { lukisBar(); lukis(); }

function lukisBar() {
  const bar = $('#pgbar', P);
  if (!bar) return;
  if (V === 'urus') {
    bar.innerHTML = `<div class="pg-top"><a class="btn ghost" href="#/pergerakan">‹ Kembali ke kalendar</a><h2 class="pg-h">Urus kod &amp; cuti umum</h2></div>`;
    return;
  }
  const pk = D ? D.pasukan : [];
  bar.innerHTML = `<div class="pg-top">
      <div class="pg-mon"><button class="btn ghost icon" data-bln="-1" aria-label="Bulan sebelum">${ic('chevL')}</button>
        <h2 class="pg-h">${esc(namaBulan(st.bulan))}</h2>
        <button class="btn ghost icon" data-bln="1" aria-label="Bulan seterusnya">${ic('chevR')}</button>
        ${st.bulan !== hariIni().slice(0, 7) ? `<button class="btn sm" data-bln="0">Hari ini</button>` : ''}</div>
      <div class="tabs" role="tablist">${[['kalendar', 'Kalendar'], ['grid', 'Grid unit'], ['saya', 'Jadual saya']].map(([k, n]) => `<button role="tab" class="${V === k ? 'on' : ''}" data-v="${k}">${n}</button>`).join('')}</div>
      <span class="spacer"></span>
      <div class="row pg-act">
        <button class="btn" data-kodinfo title="Maksud kod">${ic('info')}<span class="hide-s">Kod</span></button>
        ${D && D.boleh.urus ? `<a class="btn" href="#/pergerakan/urus" title="Senarai induk kod kerja/shift, cuti & off, serta cuti umum">${ic('cog')}<span class="hide-s">Urus kod</span></a>` : ''}
        <button class="btn" data-menu aria-label="Lagi">${ic('more')}</button>
        <button class="btn pri" data-tambah>${ic('plus')}<span class="hide-s">Tambah</span></button>
      </div></div>
    ${V !== 'saya' ? `<div class="chips pg-f">
      <button class="chip ${st.saya ? 'on' : ''}" data-saya>${ic('user')} Saya sahaja</button>
      ${pk.length ? '<span class="pg-sep"></span>' : ''}
      ${pk.map((p) => `<button class="chip ${st.pasukan.includes(p.nilai) ? 'on' : ''}" data-pk="${esc(p.nilai)}"><i class="pk-dot" style="--c:${pasukanWarna[p.nilai]}"></i>${esc(p.label)}</button>`).join('')}
      <span class="pg-sep"></span>
      <select class="in chip-sel" data-tapiskod aria-label="Tapis kod"><option value="">Semua kod</option>${(D ? D.kod : []).map((k) => `<option value="${esc(k.kod)}" ${st.kod === k.kod ? 'selected' : ''}>${esc(k.kod)} · ${esc(k.label)}</option>`).join('')}</select>
      ${tapisAktif() ? `<button class="chip ghost" data-reset>${ic('x')} Kosongkan</button>` : ''}
    </div>` : ''}`;
}

function lukis() {
  const el = $('#pgv', P);
  if (!el || !D) return;
  ({ kalendar: lukisKalendar, grid: lukisGrid, saya: lukisSaya, urus: lukisUrus })[V](el);
}

/* ---------- klik (delegasi) ---------- */
function klik(e) {
  const t = e.target.closest('button, [data-hari], [data-sel], [data-ent]');
  if (!t || !P.contains(t)) return;
  const ds = t.dataset;
  if (ds.bln !== undefined) return tukarBulan(Number(ds.bln));
  if (ds.v) { location.hash = ds.v === 'kalendar' ? '#/pergerakan' : '#/pergerakan/' + ds.v; return; }
  if (!D) return;
  if (ds.saya !== undefined) { st.saya = !st.saya; simpanTapis(); return lukisSemua(); }
  if (ds.pk) { st.pasukan = st.pasukan.includes(ds.pk) ? st.pasukan.filter((x) => x !== ds.pk) : [...st.pasukan, ds.pk]; simpanTapis(); return lukisSemua(); }
  if (ds.reset !== undefined) { st.saya = false; st.pasukan = []; st.kod = ''; simpanTapis(); return lukisSemua(); }
  if (ds.kodinfo !== undefined) return dialogKod();
  if (ds.menu !== undefined) return menuLagi();
  if (ds.tambah !== undefined) return borangTambah({ tarikh: V === 'kalendar' || V === 'grid' ? hariPilihan() : hariIni() });
  if (ds.salin !== undefined) return dialogSalin();
  if (ds.hari) return dialogHari(ds.hari);
  if (ds.sel) return dialogHari(ds.sel.split('|')[0], ds.sel.split('|')[1]);
  if (ds.ent) { const en = D.entri.find((x) => x.id === ds.ent); if (en) borangEdit(en); }
}
const hariPilihan = () => (hariIni().slice(0, 7) === st.bulan ? hariIni() : st.bulan + '-01');
function tukarBulan(n) {
  if (n === 0) st.bulan = hariIni().slice(0, 7);
  else { const d = keDate(st.bulan + '-01'); d.setMonth(d.getMonth() + n); st.bulan = iso(d).slice(0, 7); }
  muat();
}

/* ============================ Kalendar bulanan ============================ */
function lukisKalendar(el) {
  const mula = D.tetapan.mulaMinggu, hm = D.tetapan.hujungMinggu, first = st.bulan + '-01';
  const start = tambahHari(first, -((keDate(first).getDay() - mula + 7) % 7));
  const akhir = iso(new Date(keDate(first).getFullYear(), keDate(first).getMonth() + 1, 0));
  const kini = hariIni(), maks = matchMedia('(max-width: 640px)').matches ? 3 : 4;
  const sel = [];
  for (let t = start; t <= akhir || sel.length % 7; t = tambahHari(t, 1)) sel.push(t);
  const kepala = Array.from({ length: 7 }, (_, i) => (mula + i) % 7);
  el.innerHTML = `<div class="cal card" id="cal">
    <div class="cal-hd">${kepala.map((d) => `<div class="${hm.includes(d) ? 'hm' : ''}">${HARI_P[d]}</div>`).join('')}</div>
    <div class="cal-bd">${sel.map((t) => {
      const dow = keDate(t).getDay(), list = urut((ikutTarikh[t] || []).filter(lulus)), cu = cutiMap[t];
      const cls = ['cal-d', t.slice(0, 7) !== st.bulan && 'luar', hm.includes(dow) && 'hm', t === kini && 'kini', cu && 'cu'].filter(Boolean).join(' ');
      const chip = list.slice(0, list.length > maks ? maks - 1 : maks).map((e) => `<span class="ev" style="--c:${esc(kodOf(e.kod).warna)}"><b>${esc(e.kod)}</b><i>${esc(namaPanggilan(stafOf(e.staf).nama))}</i></span>`).join('');
      const lagi = list.length > maks ? `<span class="ev-more">+${list.length - maks + 1} lagi</span>` : '';
      return `<div class="${cls}" data-hari="${t}" role="button" tabindex="0" aria-label="${esc(tarikhP(t))}: ${list.length} rekod">
        <div class="cal-n"><span>${Number(t.slice(8))}</span>${cu ? `<em title="${esc(cu)}">${esc(cu)}</em>` : ''}</div>${chip}${lagi}</div>`;
    }).join('')}</div></div>
    <p class="small muted pg-hint">Klik tarikh untuk melihat senarai penuh atau menambah rekod. ${tapisAktif() ? '<b>Penapis aktif.</b>' : ''}</p>`;
  const cal = $('#cal', el);
  cal.onkeydown = (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.dataset.hari) { e.preventDefault(); dialogHari(e.target.dataset.hari); } };
  let x0 = null, y0 = null;
  cal.addEventListener('touchstart', (e) => { x0 = e.touches[0].clientX; y0 = e.touches[0].clientY; }, { passive: true });
  cal.addEventListener('touchend', (e) => {
    if (x0 == null) return;
    const dx = e.changedTouches[0].clientX - x0, dy = e.changedTouches[0].clientY - y0; x0 = null;
    if (Math.abs(dx) > 60 && Math.abs(dy) < 50) tukarBulan(dx < 0 ? 1 : -1);
  });
}

/* ---------- senarai satu hari (atau satu staf pada hari itu) ---------- */
function dialogHari(t, stafId) {
  const cu = cutiMap[t];
  const list = urut((ikutTarikh[t] || []).filter((e) => (stafId ? e.staf === stafId : lulus(e))));
  const kumpulan = [];
  list.forEach((e) => { const g = kumpulan.find((x) => x.kod === e.kod); g ? g.e.push(e) : kumpulan.push({ kod: e.kod, e: [e] }); });
  const tajukD = stafId ? stafOf(stafId).nama : tarikhP(t);
  const d = dialog({
    tajuk: tajukD, badge: stafId ? tarikhP(t) : cu ? 'Cuti umum' : '',
    badan: `${cu ? `<div class="cu-ban">${ic('calendar')} ${esc(cu)}</div>` : ''}
      ${!stafId && tapisAktif() ? '<p class="small muted" style="margin:0 0 10px">Penapis aktif — sebahagian rekod mungkin tersembunyi.</p>' : ''}
      ${kumpulan.length ? kumpulan.map((g) => {
        const k = kodOf(g.kod);
        return `<div class="hg"><div class="hg-h">${kc(g.kod)}<b>${esc(k.label)}</b>${waktu(k) ? `<small>${esc(waktu(k))}</small>` : ''}<span class="spacer"></span><span class="badge grey">${g.e.length}</span></div>
          <ul>${g.e.map((e) => { const s = stafOf(e.staf); return `<li><span class="av sm">${esc(inisial(s.nama))}</span>
            <div style="flex:1;min-width:0"><b>${esc(s.nama)}</b> ${titikPasukan(s)}${e.catatan ? `<div class="small muted">${esc(e.catatan)}</div>` : ''}</div>
            ${bolehUbah(e.staf) ? `<button class="btn ghost icon" data-edit="${esc(e.id)}" aria-label="Ubah">${ic('edit')}</button>` : ''}</li>`; }).join('')}</ul></div>`;
      }).join('') : `<div class="empty" style="padding:28px 8px">${ic('calendar')}<p style="margin:0">Tiada rekod pergerakan.</p></div>`}`,
    kaki: `<button class="btn" data-tutup>Tutup</button>${!stafId || bolehUbah(stafId) ? `<button class="btn pri" data-baru>${ic('plus')} Tambah</button>` : ''}`
  });
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-edit]');
    if (b) { const en = D.entri.find((x) => x.id === b.dataset.edit); d.close(); if (en) borangEdit(en); }
    if (e.target.closest('[data-baru]')) { d.close(); borangTambah({ tarikh: t, staf: stafId }); }
  });
}

/* ============================ Grid unit ============================ */
const hariBulan = () => { const [y, m] = st.bulan.split('-').map(Number); return Array.from({ length: new Date(y, m, 0).getDate() }, (_, i) => `${st.bulan}-${pad(i + 1)}`); };
function stafGrid() {
  const ada = new Set(D.entri.filter((e) => e.tarikh.startsWith(st.bulan)).map((e) => e.staf.toLowerCase()));
  return D.staf.filter((s) => (s.aktif || ada.has(s.id.toLowerCase())) && lulusStaf(s.id));
}
function selGrid(s, t) { return urut((ikutTarikh[t] || []).filter((e) => e.staf === s.id && (!st.kod || e.kod === st.kod))); }

function lukisGrid(el) {
  const hari = hariBulan(), hm = D.tetapan.hujungMinggu, kini = hariIni(), staf = stafGrid();
  const cls = (t) => [hm.includes(keDate(t).getDay()) && 'hm', cutiMap[t] && 'cu', t === kini && 'kini'].filter(Boolean).join(' ');
  const kerja = (t) => new Set((ikutTarikh[t] || []).filter((e) => kodOf(e.kod).jenis === 'KERJA' && lulusStaf(e.staf)).map((e) => e.staf)).size;
  el.innerHTML = staf.length ? `<div class="card rg-wrap"><table class="rg">
    <thead><tr><th class="st">Staf <small>${staf.length}</small></th>${hari.map((t) => `<th class="${cls(t)}" title="${esc(cutiMap[t] || '')}"><small>${HARI_P[keDate(t).getDay()]}</small>${Number(t.slice(8))}</th>`).join('')}</tr></thead>
    <tbody>${staf.map((s) => `<tr><th class="st"><b>${esc(s.nama)}</b>${titikPasukan(s)}</th>${hari.map((t) => {
      const l = selGrid(s, t);
      return `<td class="${cls(t)}${bolehUbah(s.id) || l.length ? ' ok' : ''}" data-sel="${esc(t + '|' + s.id)}">${l.map((e) => kc(e.kod, e.catatan ? ` title="${esc(e.catatan)}"` : '')).join('')}</td>`;
    }).join('')}</tr>`).join('')}</tbody>
    <tfoot><tr><th class="st">Bertugas (kod kerja)</th>${hari.map((t) => `<td class="${cls(t)}">${kerja(t) || ''}</td>`).join('')}</tr></tfoot></table></div>
    <p class="small muted pg-hint">Klik petak untuk lihat, tambah atau ubah. Petak berlorek = hujung minggu; merah = cuti umum.</p>`
    : `<div class="card empty">${ic('users')}<p>Tiada staf sepadan dengan penapis.</p></div>`;
  const kiniTh = $('th.kini', el);
  if (kiniTh) { const w = $('.rg-wrap', el); w.scrollLeft = Math.max(0, kiniTh.offsetLeft - 220); }
}

/* ============================ Jadual saya ============================ */
function lukisSaya(el) {
  const mine = urut(D.entri.filter((e) => e.staf.toLowerCase() === meId() && e.tarikh.startsWith(st.bulan))).sort((a, b) => (a.tarikh < b.tarikh ? -1 : a.tarikh > b.tarikh ? 1 : 0));
  const kira = {};
  mine.forEach((e) => (kira[e.kod] = (kira[e.kod] || 0) + 1));
  const ikutHari = [];
  mine.forEach((e) => { const g = ikutHari.find((x) => x.t === e.tarikh); g ? g.e.push(e) : ikutHari.push({ t: e.tarikh, e: [e] }); });
  const kini = hariIni();
  el.innerHTML = `<div class="row" style="margin:4px 0 12px"><div class="chips" style="flex:1;flex-wrap:wrap">${Object.keys(kira).sort((a, b) => (kodUrut[a] ?? 99) - (kodUrut[b] ?? 99)).map((k) => `<span class="sum-k">${kc(k)} <b>${kira[k]}</b> ${esc(kodOf(k).label)}</span>`).join('') || '<span class="muted small">Tiada rekod bulan ini.</span>'}</div>
      <button class="btn" data-salin>${ic('copy')} Salin minggu lepas</button></div>
    ${ikutHari.length ? `<div class="card saya">${ikutHari.map((g) => {
      const d = keDate(g.t);
      return `<div class="sy-r ${g.t === kini ? 'kini' : ''} ${g.t < kini ? 'lepas' : ''}"><div class="sy-d"><b>${d.getDate()}</b><small>${HARI_P[d.getDay()]}</small></div>
        <div class="sy-e">${cutiMap[g.t] ? `<div class="small" style="color:var(--bad);font-weight:700">${esc(cutiMap[g.t])}</div>` : ''}${g.e.map((e) => { const k = kodOf(e.kod); return `<button class="sy-i" data-ent="${esc(e.id)}">${kc(e.kod)}<span><b>${esc(k.label)}</b>${waktu(k) ? ` · ${esc(waktu(k))}` : ''}${e.catatan ? `<small>${esc(e.catatan)}</small>` : ''}</span>${ic('edit', 'muted')}</button>`; }).join('')}</div></div>`;
    }).join('')}</div>`
    : `<div class="card empty">${ic('calendar')}<p>Anda belum mengisi jadual bagi ${esc(namaBulan(st.bulan))}.</p><button class="btn pri" data-tambah>${ic('plus')} Isi jadual</button></div>`}`;
}

function mulaMinggu(t) { return tambahHari(t, -((keDate(t).getDay() - D.tetapan.mulaMinggu + 7) % 7)); }
function dialogSalin() {
  const ini = mulaMinggu(hariIni()), pilihan = [[ini, 'Minggu ini'], [tambahHari(ini, 7), 'Minggu depan']];
  const julat = (s) => `${tarikhR(s)} – ${tarikhR(tambahHari(s, 6))}`;
  const d = dialog({
    tajuk: 'Salin jadual minggu lepas', saiz: 'sm',
    badan: `<p class="small muted" style="margin:0 0 12px">Semua kod anda pada minggu sebelumnya disalin ke minggu dipilih. Rekod yang sama tidak diduakan.</p>
      ${pilihan.map(([s, n], i) => `<label class="opt"><input type="radio" name="ke" value="${s}" ${i === 0 ? 'checked' : ''}><span><b>${n}</b><small>Salin ${julat(tambahHari(s, -7))} → ${julat(s)}</small></span></label>`).join('')}`,
    kaki: `<button class="btn" data-tutup>Batal</button><button class="btn pri" data-ok>Salin</button>`
  });
  $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    try {
      const r = await api('pergerakan.salin', { stafId: S.me.stafId, ke: $('input[name=ke]:checked', d).value });
      d.close(); toast(r.ditambah ? `${r.ditambah} rekod disalin` : 'Tiada rekod baharu untuk disalin', r.ditambah ? 'ok' : ''); muat();
    } catch (err) { ralat(err); }
  });
}

/* ============================ Borang tambah / ubah ============================ */
function pemilihKod(dipilih, berbilang) {
  const aktif = D.kod.filter((k) => k.aktif || dipilih.includes(k.kod));
  return URUT_JENIS.map((j) => {
    const ks = aktif.filter((k) => k.jenis === j);
    return ks.length ? `<div class="kp-g"><small>${esc(JENIS[j])}</small><div class="kp-l">${ks.map((k) => `<button type="button" class="kp ${dipilih.includes(k.kod) ? 'on' : ''}" data-k="${esc(k.kod)}" style="--c:${esc(k.warna)}" aria-pressed="${dipilih.includes(k.kod)}">
      <b>${esc(k.kod)}</b><span>${esc(k.label)}${waktu(k) ? `<small>${esc(waktu(k))}</small>` : ''}</span></button>`).join('')}</div></div>` : '';
  }).join('') + `<div class="row" style="gap:8px"><button type="button" class="btn sm" data-kodbaru>${ic('plus')} Kod tiada dalam senarai? Tambah kod baharu</button>${D.boleh.urus ? `<a class="btn sm ghost" href="#/pergerakan/urus" data-tutup>${ic('cog')} Urus senarai kod</a>` : ''}</div>`
    + (berbilang ? '' : '');
}
function pasangPemilih(d, berbilang, dipilih) {
  const kotak = $('[data-kp]', d);
  const lukisP = () => { kotak.innerHTML = pemilihKod(dipilih, berbilang); };
  lukisP();
  kotak.onclick = (e) => {
    const b = e.target.closest('.kp');
    if (b) {
      const k = b.dataset.k;
      if (berbilang) { const i = dipilih.indexOf(k); i >= 0 ? dipilih.splice(i, 1) : dipilih.push(k); }
      else { dipilih.splice(0, dipilih.length, k); }
      lukisP(); kotak.dispatchEvent(new Event('kodberubah'));
    }
    if (e.target.closest('[data-kodbaru]')) borangKodBaru((k) => { if (!berbilang) dipilih.length = 0; dipilih.push(k); lukisP(); kotak.dispatchEvent(new Event('kodberubah')); });
  };
}

function borangTambah({ tarikh, staf } = {}) {
  const semua = D.boleh.semua, sid = staf || S.me.stafId, hm = D.tetapan.hujungMinggu;
  const dipilih = [];
  const d = dialog({
    tajuk: 'Tambah pergerakan', saiz: '',
    badan: `<form id="fp" autocomplete="off">
      ${semua ? `<label class="field"><span>Staf</span><select class="in" name="staf">${D.staf.filter((s) => s.aktif).map((s) => `<option value="${esc(s.id)}" ${s.id.toLowerCase() === sid.toLowerCase() ? 'selected' : ''}>${esc(s.nama)}${s.id.toLowerCase() === meId() ? ' (saya)' : ''}</option>`).join('')}</select></label>`
        : `<div class="field"><span>Staf</span><div class="row"><span class="av sm">${esc(inisial(S.me.nama))}</span><b>${esc(S.me.nama)}</b></div></div>`}
      <div class="grid g2" style="gap:0 14px;grid-template-columns:1fr 1fr">
        <label class="field"><span>Dari</span><input class="in" type="date" name="dari" value="${tarikh}" required></label>
        <label class="field"><span>Hingga</span><input class="in" type="date" name="hingga" value="${tarikh}" required></label></div>
      <label class="switch" data-lgk hidden style="margin:-4px 0 14px"><input type="checkbox" name="langkau" checked> Langkau hujung minggu (${hm.map((h) => HARI[h]).join(', ') || '—'})</label>
      <div class="field"><span>Kod <small style="font-weight:500">— boleh pilih lebih daripada satu</small></span><div data-kp></div></div>
      <label class="field"><span>Catatan (pilihan)</span><input class="in" name="catatan" maxlength="300" placeholder="cth Kursus di Kota Bharu"></label>
      </form>`,
    kaki: `<span class="small muted" data-ring style="margin-right:auto"></span><button class="btn" data-tutup>Batal</button><button class="btn pri" data-simpan>Simpan</button>`
  });
  const f = $('#fp', d);
  const ring = () => {
    const a = f.dari.value, b = f.hingga.value || a;
    if (a && b < a) f.hingga.value = a;
    const n = a ? Math.round((keDate(f.hingga.value || a) - keDate(a)) / 864e5) + 1 : 0;
    $('[data-lgk]', d).hidden = !(n > 1 && hm.length);
    let m = n;
    if (n > 1 && hm.length && f.langkau.checked) { m = 0; for (let i = 0; i < n; i++) if (!hm.includes(keDate(tambahHari(a, i)).getDay())) m++; }
    $('[data-ring]', d).textContent = dipilih.length && n ? `${dipilih.join(' + ')} · ${m} hari` : '';
  };
  f.oninput = ring;
  pasangPemilih(d, true, dipilih);
  $('[data-kp]', d).addEventListener('kodberubah', ring);
  ring();
  $('[data-simpan]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    if (!dipilih.length) return toast('Pilih sekurang-kurangnya satu kod', 'bad');
    if (!f.dari.value) return toast('Pilih tarikh', 'bad');
    const stafId = semua ? f.staf.value : S.me.stafId;
    const lgk = !$('[data-lgk]', d).hidden && f.langkau.checked;
    try {
      const r = await api('pergerakan.simpan', { stafId, dari: f.dari.value, hingga: f.hingga.value || f.dari.value, kod: dipilih, catatan: f.catatan.value.trim(), langkauHari: lgk ? hm : [] });
      d.close();
      toast(`${r.ditambah} rekod ditambah${r.dilangkau ? ` · ${r.dilangkau} sudah wujud` : ''}`, 'ok');
      if (dipilih.some((k) => kodOf(k).jenis === 'OFF') && S.ada('bukuoff') && stafId.toLowerCase() === meId()) tawarBukuOff(f.dari.value);
      muat();
    } catch (err) { ralat(err); }
  });
}

function tawarBukuOff(tarikh) {
  const d = dialog({
    tajuk: 'Rekod juga dalam Buku Off?', saiz: 'sm',
    badan: `<p style="margin:0">Jadual OFF telah disimpan. Untuk menolak baki OFF, rekod juga permohonan dalam <b>Buku Off</b> (tetap melalui pengesahan penyelia).</p>`,
    kaki: `<button class="btn" data-tutup>Tidak perlu</button><a class="btn pri" href="#/bukuoff/baru/${esc(tarikh)}" data-tutup>${ic('calendar')} Buka Buku Off</a>`
  });
  return d;
}

function borangEdit(en) {
  if (!bolehUbah(en.staf)) return dialogHari(en.tarikh, en.staf);
  const dipilih = [en.kod], s = stafOf(en.staf);
  const d = dialog({
    tajuk: s.nama, badge: tarikhP(en.tarikh), saiz: '',
    badan: `<div class="field"><span>Kod</span><div data-kp></div></div>
      <label class="field"><span>Catatan</span><input class="in" name="catatan" maxlength="300" value="${esc(en.catatan)}"></label>
      ${en.oleh ? `<p class="small muted" style="margin:0">Direkod oleh ${esc(en.oleh)}</p>` : ''}`,
    kaki: `<button class="btn bad" data-padam>${ic('trash')} Padam</button><span class="spacer"></span><button class="btn" data-tutup>Batal</button><button class="btn pri" data-simpan>Simpan</button>`
  });
  pasangPemilih(d, false, dipilih);
  $('[data-simpan]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    try { await api('pergerakan.kemaskini', { id: en.id, kod: dipilih[0], catatan: $('[name=catatan]', d).value.trim() }); d.close(); toast('Dikemas kini', 'ok'); muat(); }
    catch (err) { ralat(err); }
  });
  $('[data-padam]', d).onclick = async (e) => {
    const b = e.currentTarget;
    if (!(await sahkan(`Padam ${en.kod} pada ${tarikhP(en.tarikh)} (${s.nama})?`, { ya: 'Padam', bahaya: true }))) return;
    sibuk(b, async () => { try { await api('pergerakan.padam', { id: en.id }); d.close(); toast('Dipadam', 'ok'); muat(); } catch (err) { ralat(err); } });
  };
}

/* ---------- kod ---------- */
function borangKodBaru(selepas) {
  const d = dialog({
    tajuk: 'Kod baharu', saiz: 'sm',
    badan: `<form id="fk" autocomplete="off"><div class="grid" style="grid-template-columns:110px 1fr;gap:0 12px">
      <label class="field"><span>Kod *</span><input class="in" name="kod" maxlength="10" required placeholder="cth X4" style="text-transform:uppercase"></label>
      <label class="field"><span>Maksud *</span><input class="in" name="label" maxlength="60" required placeholder="cth Shift X4"></label></div>
      <label class="field"><span>Jenis</span><select class="in" name="jenis">${URUT_JENIS.map((j) => `<option value="${j}">${esc(JENIS[j])}</option>`).join('')}</select></label>
      <div class="grid" style="grid-template-columns:1fr 1fr 70px;gap:0 12px">
        <label class="field"><span>Mula</span><input class="in" type="time" name="mula"></label>
        <label class="field"><span>Tamat</span><input class="in" type="time" name="tamat"></label>
        <label class="field"><span>Warna</span><input type="color" name="warna" value="#0d9488" style="width:100%;height:42px;border:0;background:none"></label></div>
      <p class="small muted" style="margin:0">Kod baharu boleh digunakan oleh semua staf. Admin boleh mengubah atau memadamnya kemudian.</p></form>`,
    kaki: `<button class="btn" data-tutup>Batal</button><button class="btn pri" data-ok>Tambah kod</button>`
  });
  const f = $('#fk', d);
  $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    try {
      const kod = f.kod.value.trim().toUpperCase();
      D.kod = await api('pergerakan.kod.tambah', { kod, label: f.label.value.trim(), jenis: f.jenis.value, mula: f.mula.value, tamat: f.tamat.value, warna: f.warna.value });
      indeks(); d.close(); toast('Kod ' + kod + ' ditambah', 'ok');
      selepas && selepas(kod); lukisBar();
    } catch (err) { ralat(err); }
  });
}

function dialogKod() {
  const d = dialog({
    tajuk: 'Maksud kod pergerakan',
    badan: URUT_JENIS.map((j) => {
      const ks = D.kod.filter((k) => k.jenis === j && k.aktif);
      return ks.length ? `<div class="h5" style="margin-top:4px">${esc(JENIS[j])}</div><div class="kod-leg">${ks.map((k) => `<div>${kc(k.kod)}<span><b>${esc(k.label)}</b>${waktu(k) ? `<small>${esc(waktu(k))}</small>` : ''}</span></div>`).join('')}</div>` : '';
    }).join('') + (D.pasukan.length ? `<div class="h5">Pasukan</div><div class="chips" style="flex-wrap:wrap">${D.pasukan.map((p) => `<span class="sum-k"><i class="pk-dot" style="--c:${pasukanWarna[p.nilai]}"></i>${esc(p.label)}</span>`).join('')}</div>` : ''),
    kaki: `<button class="btn" data-baru>${ic('plus')} Kod baharu</button>${D.boleh.urus ? `<a class="btn" href="#/pergerakan/urus" data-tutup>${ic('cog')} Urus kod</a>` : ''}<span class="spacer"></span><button class="btn pri" data-tutup>Tutup</button>`
  });
  $('[data-baru]', d).onclick = () => { d.close(); borangKodBaru(() => {}); };
}

/* ---------- menu lagi: cetak, excel, urus ---------- */
function menuLagi() {
  const d = dialog({
    tajuk: 'Lagi', saiz: 'sm',
    badan: `<div class="menu-l">
      <button data-m="cetak">${ic('print')}<span><b>Cetak jadual bulanan</b><small>A4 melintang · ${esc(namaBulan(st.bulan))}${tapisAktif() ? ' · ikut penapis' : ''}</small></span></button>
      <button data-m="excel">${ic('install')}<span><b>Eksport ke Excel</b><small>Fail .xls dengan warna kod</small></span></button>
      ${D.boleh.urus ? `<button data-m="urus">${ic('cog')}<span><b>Urus kod &amp; cuti umum</b><small>Tambah, ubah, padam kod; isi cuti umum secara pukal</small></span></button>` : ''}
    </div>`
  });
  d.addEventListener('click', (e) => {
    const b = e.target.closest('[data-m]');
    if (!b) return;
    d.close();
    if (b.dataset.m === 'cetak') cetak();
    if (b.dataset.m === 'excel') excel();
    if (b.dataset.m === 'urus') location.hash = '#/pergerakan/urus';
  });
}

function nadaCerah(hex, p = 0.78) {
  const n = parseInt(hex.slice(1), 16), c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => Math.round(v + (255 - v) * p));
  return '#' + c.map((v) => v.toString(16).padStart(2, '0')).join('');
}
function ketTapis() {
  const t = [];
  if (st.saya) t.push('Saya sahaja');
  if (st.pasukan.length) t.push(st.pasukan.map(labelPasukan).join(', '));
  if (st.kod) t.push('Kod ' + st.kod);
  return t.join(' · ');
}
function legenda() { return D.kod.filter((k) => k.aktif).map((k) => ({ k, w: waktu(k) })); }
function jenamaTeks() { const j = (S.boot && S.boot.jenama) || {}; return [j.subjudul, j.jabatan].filter(Boolean).join(' · '); }

function cetak() {
  const hari = hariBulan(), hm = D.tetapan.hujungMinggu, staf = stafGrid();
  const cls = (t) => [hm.includes(keDate(t).getDay()) && 'hm', cutiMap[t] && 'cu'].filter(Boolean).join(' ');
  const el = document.createElement('div');
  el.id = 'cetak';
  el.innerHTML = `<div class="ct-h"><div><b>Jadual Pergerakan Staf — ${esc(namaBulan(st.bulan))}</b><small>${esc(jenamaTeks())}</small></div>
      <small>${ketTapis() ? 'Penapis: ' + esc(ketTapis()) + ' · ' : ''}Dicetak ${esc(tarikhP(hariIni()))}</small></div>
    <table class="ct"><thead><tr><th class="st">Nama staf</th>${hari.map((t) => `<th class="${cls(t)}">${HARI_P[keDate(t).getDay()].slice(0, 2)}<br>${Number(t.slice(8))}</th>`).join('')}</tr></thead>
    <tbody>${staf.map((s) => `<tr><th class="st">${esc(s.nama)}</th>${hari.map((t) => {
      const l = selGrid(s, t);
      return `<td class="${cls(t)}" style="${l.length ? `background:${nadaCerah(kodOf(l[0].kod).warna)}` : ''}">${l.map((e) => esc(e.kod)).join('<br>')}</td>`;
    }).join('')}</tr>`).join('')}</tbody></table>
    <div class="ct-leg">${legenda().map(({ k, w }) => `<span><b style="background:${nadaCerah(k.warna)}">${esc(k.kod)}</b> ${esc(k.label)}${w ? ' (' + esc(w) + ')' : ''}</span>`).join('')}
      ${hari.filter((t) => cutiMap[t]).map((t) => `<span><b class="cu">${Number(t.slice(8))}</b> ${esc(cutiMap[t])}</span>`).join('')}</div>`;
  document.body.appendChild(el);
  document.body.classList.add('mencetak');
  const habis = () => { el.remove(); document.body.classList.remove('mencetak'); removeEventListener('afterprint', habis); };
  addEventListener('afterprint', habis);
  setTimeout(() => { print(); setTimeout(() => { if (document.body.classList.contains('mencetak') && !matchMedia('print').matches) habis(); }, 1500); }, 50);
}

function excel() {
  const hari = hariBulan(), hm = D.tetapan.hujungMinggu, staf = stafGrid();
  const latar = (t) => (cutiMap[t] ? '#fde2e2' : hm.includes(keDate(t).getDay()) ? '#eef0f6' : '#ffffff');
  const td = 'border:1px solid #cbd5e1;text-align:center;font-size:9pt;';
  const rows = staf.map((s) => `<tr><td style="border:1px solid #cbd5e1;font-weight:bold;white-space:nowrap">${esc(s.nama)}</td><td style="border:1px solid #cbd5e1">${esc(s.pasukan.map(labelPasukan).join(', '))}</td>${hari.map((t) => {
    const l = selGrid(s, t);
    return `<td style="${td}background:${l.length ? nadaCerah(kodOf(l[0].kod).warna, 0.7) : latar(t)};font-weight:bold">${l.map((e) => esc(e.kod)).join(' / ')}</td>`;
  }).join('')}</tr>`).join('');
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8">
    <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${esc(namaBulan(st.bulan))}</x:Name><x:WorksheetOptions><x:Print><x:ValidPrinterInfo/><x:PaperSizeIndex>9</x:PaperSizeIndex></x:Print><x:PageSetup><x:Layout x:Orientation="Landscape"/></x:PageSetup><x:FreezePanes/><x:SplitHorizontal>3</x:SplitHorizontal><x:SplitVertical>2</x:SplitVertical></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]--></head>
    <body><table style="border-collapse:collapse;font-family:Arial">
    <tr><td colspan="${hari.length + 2}" style="font-size:14pt;font-weight:bold">Jadual Pergerakan Staf — ${esc(namaBulan(st.bulan))}</td></tr>
    <tr><td colspan="${hari.length + 2}" style="color:#64748b">${esc(jenamaTeks())}${ketTapis() ? ' · Penapis: ' + esc(ketTapis()) : ''}</td></tr>
    <tr><th style="${td}background:#e0e7ff">Nama staf</th><th style="${td}background:#e0e7ff">Pasukan</th>${hari.map((t) => `<th style="${td}background:${cutiMap[t] ? '#fca5a5' : '#e0e7ff'}">${HARI_P[keDate(t).getDay()]}<br>${Number(t.slice(8))}</th>`).join('')}</tr>
    ${rows}
    <tr><td></td></tr><tr><td colspan="4" style="font-weight:bold">Maksud kod</td></tr>
    ${legenda().map(({ k, w }) => `<tr><td style="${td}background:${nadaCerah(k.warna, 0.7)};font-weight:bold">${esc(k.kod)}</td><td colspan="3">${esc(k.label)}${w ? ' (' + esc(w) + ')' : ''}</td></tr>`).join('')}
    ${hari.filter((t) => cutiMap[t]).map((t) => `<tr><td style="${td}background:#fde2e2">${esc(t.split('-').reverse().join('/'))}</td><td colspan="3">${esc(cutiMap[t])}</td></tr>`).join('')}
    </table></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' }));
  a.download = `Pergerakan-Staf-${st.bulan}.xls`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  toast('Fail Excel dimuat turun', 'ok');
}

/* ============================ Urus kod & cuti umum (ADMIN) ============================ */
async function lukisUrus(el) {
  let kod = D.kod.map((k) => ({ ...k }));
  let cuti = [];
  el.innerHTML = '<div class="skel" style="height:300px"></div>';
  try { cuti = await api('pergerakan.cuti'); } catch (e) { ralat(e); }
  const baris = (k, i) => `<tr data-i="${i}">
    <td data-l="Kod"><input class="in" data-f="kod" value="${esc(k.kod)}" maxlength="10" style="width:84px;text-transform:uppercase;font-weight:800;color:${esc(k.warna)}"></td>
    <td data-l="Maksud"><input class="in" data-f="label" value="${esc(k.label)}" maxlength="60" style="min-width:150px"></td>
    <td data-l="Jenis"><select class="in" data-f="jenis">${URUT_JENIS.map((j) => `<option value="${j}" ${k.jenis === j ? 'selected' : ''}>${esc(JENIS[j])}</option>`).join('')}</select></td>
    <td data-l="Mula"><input class="in" type="time" data-f="mula" value="${esc(k.mula)}"></td>
    <td data-l="Tamat"><input class="in" type="time" data-f="tamat" value="${esc(k.tamat)}"></td>
    <td data-l="Warna"><input type="color" data-f="warna" value="${esc(k.warna)}" style="width:44px;height:40px;border:0;background:none"></td>
    <td data-l="Aktif"><label class="switch"><input type="checkbox" data-f="aktif" ${k.aktif ? 'checked' : ''}></label></td>
    <td class="tk-aksi" style="white-space:nowrap"><button class="btn ghost icon" data-up aria-label="Naikkan">↑</button><button class="btn ghost icon" data-del aria-label="Padam">${ic('trash')}</button></td></tr>`;
  const teksCuti = (l) => l.map((c) => `${c.tarikh}  ${c.nama}`).join('\n');
  el.innerHTML = `<div class="grid" style="gap:16px">
    <section class="card pad"><div class="row" style="margin-bottom:6px"><h3 style="margin:0;font-size:16px;flex:1">Kod pergerakan</h3>
      <button class="btn sm" data-kadd>${ic('plus')} Kod</button><button class="btn pri sm" data-ksave>Simpan kod</button></div>
      <p class="small muted" style="margin:0 0 12px">Maksud kod dipaparkan kepada semua staf. Nyahaktif kod yang tidak lagi digunakan (rekod lama kekal). Kod yang dipadam masih kelihatan kelabu pada rekod lama.</p>
      <div class="scroll-x"><table class="tbl tbl-kad"><thead><tr><th>Kod</th><th>Maksud</th><th>Jenis</th><th>Mula</th><th>Tamat</th><th>Warna</th><th>Aktif</th><th></th></tr></thead><tbody data-kb>${kod.map(baris).join('')}</tbody></table></div></section>
    <section class="card pad"><div class="row" style="margin-bottom:6px"><h3 style="margin:0;font-size:16px;flex:1">Cuti umum</h3><span class="badge grey" data-cn>${cuti.length} tarikh</span><button class="btn pri sm" data-csave>Simpan cuti umum</button></div>
      <p class="small muted" style="margin:0 0 10px">Tampal atau taip <b>banyak baris sekaligus</b> — satu cuti setiap baris. Format diterima:
        <code>2027-01-01 Tahun Baru</code> · <code>01/02/2027, Hari Wilayah</code> · <code>20/03/2027 hingga 21/03/2027 Hari Raya Aidilfitri</code>. Boleh tampal terus dari Excel (tarikh ⇥ nama). Baris bermula # diabaikan.</p>
      <textarea class="in mono" data-ct rows="14" spellcheck="false" placeholder="2027-01-01  Tahun Baru&#10;29/01/2027  Tahun Baru Cina&#10;20/03/2027 hingga 21/03/2027  Hari Raya Aidilfitri">${esc(teksCuti(cuti))}</textarea></section></div>`;
  const kb = $('[data-kb]', el);
  const baca = () => $$('tr[data-i]', kb).map((tr) => ({
    kod: $('[data-f=kod]', tr).value.trim().toUpperCase(), label: $('[data-f=label]', tr).value.trim(), jenis: $('[data-f=jenis]', tr).value,
    mula: $('[data-f=mula]', tr).value, tamat: $('[data-f=tamat]', tr).value, warna: $('[data-f=warna]', tr).value, aktif: $('[data-f=aktif]', tr).checked
  }));
  const semula = () => { kb.innerHTML = kod.map(baris).join(''); };
  el.onclick = async (e) => {
    if (e.target.closest('[data-kadd]')) { kod = baca(); kod.push({ kod: '', label: '', jenis: 'KERJA', mula: '', tamat: '', warna: '#0d9488', aktif: true }); semula(); $$('[data-f=kod]', kb).pop().focus(); }
    const up = e.target.closest('[data-up]');
    if (up) { kod = baca(); const i = Number(up.closest('tr').dataset.i); if (i > 0) { [kod[i - 1], kod[i]] = [kod[i], kod[i - 1]]; semula(); } }
    const del = e.target.closest('[data-del]');
    if (del) {
      kod = baca(); const i = Number(del.closest('tr').dataset.i);
      if (kod[i].kod && !(await sahkan(`Padam kod ${kod[i].kod}? Rekod lama yang menggunakan kod ini akan dipaparkan kelabu. Lebih selamat: nyahaktifkan sahaja.`, { ya: 'Padam', bahaya: true }))) return;
      kod.splice(i, 1); semula();
    }
    const ks = e.target.closest('[data-ksave]');
    if (ks) sibuk(ks, async () => {
      try { D.kod = await api('pergerakan.kod.simpan', { item: baca().filter((k) => k.kod) }); kod = D.kod.map((k) => ({ ...k })); indeks(); semula(); toast('Kod disimpan', 'ok'); }
      catch (err) { ralat(err); }
    });
    const cs = e.target.closest('[data-csave]');
    if (cs) sibuk(cs, async () => {
      try { cuti = await api('pergerakan.cuti.simpan', { teks: $('[data-ct]', el).value }); $('[data-ct]', el).value = teksCuti(cuti); $('[data-cn]', el).textContent = cuti.length + ' tarikh'; toast('Cuti umum disimpan', 'ok'); }
      catch (err) { ralat(err); }
    });
  };
  kb.oninput = (e) => { if (e.target.dataset.f === 'warna') $('[data-f=kod]', e.target.closest('tr')).style.color = e.target.value; };
}
