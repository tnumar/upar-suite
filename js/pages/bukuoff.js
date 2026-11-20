// Buku Off — rekod cuti pampasan (tugasan +, off −), baki, pengesahan penyelia, cetak buku.
import { S, tajuk, segarBoot } from '../app.js';
import { api } from '../api.js';
import { $, $$, esc, toast, ralat, sibuk, dialog, sahkan, simpan, ambil, inisial, debounce } from '../ui.js';
import { ic } from '../icons.js';

const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const BULAN_P = ['Januari', 'Februari', 'Mac', 'April', 'Mei', 'Jun', 'Julai', 'Ogos', 'September', 'Oktober', 'November', 'Disember'];
const JENIS = { OT: 'Tugasan (+)', OFF: 'Off (−)', AWAL: 'Baki awal (+)', NOTA: 'Nota', BATAL: 'Batal' };
const TAPIS = [['ALL', 'Semua'], ['OT', 'Tugasan (+)'], ['OFF', 'Off (−)'], ['WAIT', 'Menunggu / Draf'], ['TOLAK', 'Ditolak'], ['LAIN', 'Nota / Batal']];

const pad = (n) => String(n).padStart(2, '0');
const hariIni = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
const sgn = (j) => (j === 'OT' || j === 'AWAL' ? 1 : j === 'OFF' ? -1 : 0);
const eff = (r) => (r.status === 'DITOLAK' ? 0 : sgn(r.jenis));
function fmt(m, tanda) {
  m = Math.round(m || 0);
  const s = m < 0 ? '−' : tanda && m > 0 ? '+' : '';
  m = Math.abs(m);
  return `${s}${Math.floor(m / 60)}j${m % 60 ? ' ' + (m % 60) + 'm' : ''}`;
}
const dmy = (t) => { if (!t) return ''; const p = t.split('-'); return `${+p[2]}/${+p[1]}/${p[0]}`; };
const t12 = (t) => { if (!t) return ''; const [h, m] = t.split(':').map(Number); return `${h % 12 || 12}.${pad(m)}${h < 12 ? 'pg' : 'ptg'}`; };

let D = null, P = null, pilih = null, tapis = 'ALL', cari = '';
const me = () => S.me.stafId;
const stafOf = (id) => (D.staf.find((s) => s.id === id) || { id, nama: id, bolehUrus: false, bolehSah: false });
const hari = (m) => { const j = (D.tetapan.jamSehari || 9) * 60; if (m <= 0) return ''; const d = Math.floor(m / j), r = m % j; return `≈ ${d ? d + ' hari' : ''}${r ? (d ? ' ' : '') + fmt(r) : ''} (1 hari = ${D.tetapan.jamSehari || 9}j)`; };

/** Rekod staf dipilih, disusun ikut tarikh, dengan baki berjalan. */
function rekodStaf(id = pilih) {
  const R = D.rekod.filter((r) => r.stafId === id).sort((a, b) => (a.tarikh < b.tarikh ? -1 : a.tarikh > b.tarikh ? 1 : a.turutan - b.turutan));
  let b = 0;
  return R.map((r) => { b += eff(r) * r.minit; return { ...r, baki: b }; });
}

/* ============================ halaman ============================ */
export async function papar(page, rest) {
  tajuk('Buku Off');
  P = page;
  const v = rest[0] === 'sah' ? 'sah' : 'rekod';
  page.innerHTML = '<div class="skel" style="height:420px;margin-top:8px"></div>';
  try { D = await api('bukuoff.data'); simpan('cache.bukuoff', D); }
  catch (e) {
    D = ambil('cache.bukuoff', true);
    if (!D) { page.innerHTML = `<div class="card empty">${ic('alert')}<p>${esc(e.message)}</p></div>`; return; }
    toast('Luar talian — memaparkan data terakhir', 'bad');
  }
  if (!pilih || !D.staf.some((s) => s.id === pilih)) pilih = me();
  lukis(v);
  if (rest[0] === 'baru') borang(null, { tarikh: /^\d{4}-\d{2}-\d{2}$/.test(rest[1] || '') ? rest[1] : hariIni(), jenis: rest[1] ? 'OFF' : 'OT' });
}

function kiraSah() { return D.rekod.filter((r) => r.status === 'MENUNGGU' && stafOf(r.stafId).bolehSah).length; }

function lukis(v) {
  const bolehSah = D.staf.some((s) => s.bolehSah), n = kiraSah();
  P.innerHTML = `<div class="bo-top">
      ${D.staf.length > 1 ? `<label class="bo-staf">${ic('user')}<select class="in" id="bStaf" aria-label="Pilih staf">${D.staf.map((s) => `<option value="${esc(s.id)}" ${s.id === pilih ? 'selected' : ''}>${esc(s.nama)}${s.id === me() ? ' (saya)' : ''} · ${fmt(s.baki)}${s.menunggu ? ' · ' + s.menunggu + ' menunggu' : ''}</option>`).join('')}</select></label>` : ''}
      ${bolehSah ? `<div class="tabs"><button class="${v === 'rekod' ? 'on' : ''}" data-v="rekod">Rekod</button><button class="${v === 'sah' ? 'on' : ''}" data-v="sah">Pengesahan${n ? ` <span class="badge warn" style="margin-left:4px">${n}</span>` : ''}</button></div>` : ''}
      <span class="spacer"></span>
      <button class="btn" id="bCetak">${ic('print')}<span class="hide-s">Cetak buku</span></button>
      ${stafOf(pilih).bolehUrus ? `<button class="btn pri" id="bBaru">${ic('plus')}<span class="hide-s">Rekod baharu</span></button>` : ''}
    </div><div id="boV"></div>`;
  const s = $('#bStaf', P);
  if (s) s.onchange = () => { pilih = s.value; lukis('rekod'); };
  $$('[data-v]', P).forEach((b) => (b.onclick = () => { location.hash = b.dataset.v === 'sah' ? '#/bukuoff/sah' : '#/bukuoff'; }));
  $('#bCetak', P).onclick = cetakBuku;
  const bb = $('#bBaru', P); if (bb) bb.onclick = () => borang(null);
  (v === 'sah' && bolehSah ? lukisSah : lukisRekod)($('#boV', P));
}

/* ---------- rekod & baki ---------- */
function lukisRekod(el) {
  const s = stafOf(pilih), R = rekodStaf(), bal = R.length ? R[R.length - 1].baki : 0, lain = pilih !== me();
  let ot = 0, off = 0, tunggu = 0, tungguM = 0;
  R.forEach((r) => { if (eff(r) > 0) ot += r.minit; if (eff(r) < 0) off += r.minit; if (r.status === 'MENUNGGU') { tunggu++; tungguM += eff(r) * r.minit; } });
  const draf = R.filter((r) => r.status === 'DRAF').length;
  const syarat = String(D.tetapan.syarat || '').split('\n').map((x) => x.trim()).filter(Boolean);
  el.innerHTML = `
    <section class="bo-hero">
      <div class="bo-bal"><small>${lain ? 'Baki Off · ' + esc(s.nama) : 'Baki Off semasa'}</small>
        <b>${bal < 0 ? '−' : ''}${Math.floor(Math.abs(bal) / 60)}<i>j</i>${Math.abs(bal) % 60 ? ` ${Math.abs(bal) % 60}<i>m</i>` : ''}</b>
        <span>${esc(hari(bal) || 'Tiada baki off')}</span>
        ${s.penyeliaNama ? `<span class="bo-pen">${ic('shield')} Penyelia: ${esc(s.penyeliaNama)}</span>` : ''}</div>
      <svg class="bo-chart" viewBox="0 0 600 150" preserveAspectRatio="none" aria-label="Trend baki off">${carta(R)}</svg>
    </section>
    <div class="stats bo-stats">
      <div class="stat"><b style="color:var(--ot)">${fmt(ot)}</b><span>Jumlah tugasan</span></div>
      <div class="stat"><b style="color:var(--off)">${fmt(off)}</b><span>Off diambil</span></div>
      <div class="stat ${tunggu ? 'warn' : ''}"><b>${tunggu}</b><span>Menunggu${tunggu ? ' (' + fmt(tungguM, true) + ')' : ''}</span></div>
      <div class="stat"><b>${R.length}</b><span>Jumlah rekod</span></div>
    </div>
    ${draf && s.bolehUrus ? `<div class="note-box row" style="margin-top:14px"><span style="flex:1">📝 <b>${draf}</b> rekod draf belum dihantar kepada penyelia.</span><button class="btn sm pri" id="bHantar">Hantar untuk pengesahan</button></div>` : ''}
    <div class="row" style="margin:18px 0 10px"><div class="chips" style="flex:1 1 340px;min-width:0">${TAPIS.map(([k, n]) => `<button class="chip ${tapis === k ? 'on' : ''}" data-f="${k}">${n}</button>`).join('')}</div>
      <div class="search" style="flex:1 1 220px;max-width:420px">${ic('search')}<input class="in" id="bCari" type="search" placeholder="Cari perincian / tarikh" value="${esc(cari)}" style="height:40px"></div></div>
    <div class="card bo-list" id="bList"></div>
    ${syarat.length ? `<details class="card pad bo-syarat"><summary><b>Syarat cuti pampasan / off</b></summary><ol>${syarat.map((x) => `<li>${esc(x)}</li>`).join('')}</ol></details>` : ''}`;
  senarai();
  $$('[data-f]', el).forEach((b) => (b.onclick = () => { tapis = b.dataset.f; $$('[data-f]', el).forEach((x) => x.classList.toggle('on', x === b)); senarai(); }));
  $('#bCari', el).oninput = debounce((e) => { cari = e.target.value; senarai(); }, 150);
  const bh = $('#bHantar', el);
  if (bh) bh.onclick = (e) => sibuk(e.currentTarget, async () => {
    try { const r = await api('bukuoff.hantar', { stafId: pilih }); D = r.data; toast(r.msg, 'ok'); lukis('rekod'); segarBoot(); } catch (err) { ralat(err); }
  });
}

function carta(R) {
  const pts = R.filter((r) => eff(r) !== 0);
  if (pts.length < 2) return '';
  const W = 600, H = 150, pd = 10, t0 = +new Date(pts[0].tarikh), t1 = +new Date(pts[pts.length - 1].tarikh) || t0 + 1;
  const max = Math.max(...pts.map((p) => p.baki), 1), min = Math.min(0, ...pts.map((p) => p.baki));
  const X = (p) => pd + ((+new Date(p.tarikh) - t0) / (t1 - t0 || 1)) * (W - pd * 2);
  const Y = (v) => H - pd - ((v - min) / (max - min || 1)) * (H - pd * 2.5);
  let d = '';
  pts.forEach((p, i) => { d += i ? `H${X(p).toFixed(1)}V${Y(p.baki).toFixed(1)}` : `M${X(p).toFixed(1)} ${Y(p.baki).toFixed(1)}`; });
  const z = pts[pts.length - 1];
  return `<defs><linearGradient id="boG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".35"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient></defs>
    <path d="${d}V${H - pd}H${X(pts[0])}Z" fill="url(#boG)"/><path d="${d}" fill="none" stroke="#fff" stroke-width="2.5" vector-effect="non-scaling-stroke" stroke-linejoin="round"/>
    <circle cx="${X(z)}" cy="${Y(z.baki)}" r="4.5" fill="#f0abfc" stroke="#fff" stroke-width="2" vector-effect="non-scaling-stroke"/>`;
}

function lencana(r) {
  if (r.jenis === 'BATAL') return '<span class="badge grey">Batal</span>';
  if (r.jenis === 'NOTA') return '<span class="badge grey">Nota</span>';
  if (r.status === 'DRAF') return '<span class="badge">📝 Draf</span>';
  if (r.status === 'DITOLAK') return '<span class="badge bad">✕ Ditolak</span>';
  if (r.status === 'DISAHKAN') return `<span class="badge ok">✓ Sah ${esc(dmy(r.disahkan))}</span>`;
  if (r.status === 'MENUNGGU') return '<span class="badge warn">⏳ Menunggu</span>';
  return '';
}
function itemHTML(r, dgnNama) {
  const p = r.tarikh.split('-'), masa = r.masaMula ? `${t12(r.masaMula)} – ${t12(r.masaTamat)}` : '';
  const amt = eff(r) ? fmt(eff(r) * r.minit, true) : r.jenis === 'BATAL' || r.status === 'DITOLAK' ? fmt(r.minit) : '—';
  return `<button class="bo-it t-${esc(r.jenis)}${r.status === 'DITOLAK' ? ' t-tolak' : ''}" data-id="${esc(r.id)}">
    <span class="bo-dt"><b>${+p[2]}</b><i>${BULAN[+p[1] - 1]} ${p[0].slice(2)}</i></span>
    <span class="bo-mid"><b>${dgnNama ? esc(stafOf(r.stafId).nama) + ' · ' : ''}${esc(r.perincian)}</b><span>${masa ? `<span>${masa}</span>` : ''}${lencana(r)}</span></span>
    <span class="bo-amt"><b>${amt}</b>${r.baki !== undefined ? `<small>Baki ${fmt(r.baki)}</small>` : ''}</span></button>`;
}

function senarai() {
  const q = cari.trim().toLowerCase();
  const R = rekodStaf().reverse().filter((r) => {
    if (tapis === 'OT' && !(r.jenis === 'OT' || r.jenis === 'AWAL')) return false;
    if (tapis === 'OFF' && r.jenis !== 'OFF') return false;
    if (tapis === 'WAIT' && r.status !== 'MENUNGGU' && r.status !== 'DRAF') return false;
    if (tapis === 'TOLAK' && r.status !== 'DITOLAK') return false;
    if (tapis === 'LAIN' && !(r.jenis === 'NOTA' || r.jenis === 'BATAL')) return false;
    return !q || `${r.perincian} ${r.catatan} ${dmy(r.tarikh)}`.toLowerCase().includes(q);
  });
  const el = $('#bList', P);
  if (!R.length) { el.innerHTML = `<div class="empty">${ic('calendar')}<p style="margin:0">${D.rekod.some((r) => r.stafId === pilih) ? 'Tiada rekod sepadan.' : 'Tiada rekod lagi. Klik "Rekod baharu" untuk mula.'}</p></div>`; return; }
  const bersih = {};
  R.forEach((r) => { const k = r.tarikh.slice(0, 7); bersih[k] = (bersih[k] || 0) + eff(r) * r.minit; });
  let cur = '', html = '';
  R.forEach((r) => {
    const k = r.tarikh.slice(0, 7);
    if (k !== cur) { cur = k; html += `<div class="bo-mon">${BULAN_P[+k.slice(5) - 1]} ${k.slice(0, 4)}<span>bersih ${fmt(bersih[k], true)}</span></div>`; }
    html += itemHTML(r);
  });
  el.innerHTML = html;
  el.onclick = (e) => { const b = e.target.closest('[data-id]'); if (b) butiran(b.dataset.id); };
}

/* ---------- butiran / borang ---------- */
function butiran(id) {
  const r = rekodStaf().find((x) => x.id === id);
  if (!r) return;
  const s = stafOf(r.stafId), boleh = s.bolehUrus;
  const baris = [
    ['Staf', esc(s.nama)], ['Tarikh', esc(dmy(r.tarikh))], ['Jenis', esc(JENIS[r.jenis] || r.jenis)],
    ['Masa', r.masaMula ? `${t12(r.masaMula)} – ${t12(r.masaTamat)}` : '—'], ['Jumlah', `<b>${eff(r) ? fmt(eff(r) * r.minit, true) : fmt(r.minit)}</b>`],
    ['Baki selepas', fmt(r.baki)], ['Status', lencana(r) || '—'],
    r.oleh ? ['Disahkan oleh', esc(r.oleh) + (r.disahkan ? ' · ' + esc(dmy(r.disahkan)) : '')] : null,
    r.catatan ? ['Catatan', esc(r.catatan)] : null, r.catatanPenyelia ? ['Catatan penyelia', esc(r.catatanPenyelia)] : null
  ].filter(Boolean);
  const d = dialog({
    tajuk: r.perincian, badge: JENIS[r.jenis] || r.jenis, saiz: 'sm',
    badan: `<dl class="kv">${baris.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')}</dl>
      ${r.status === 'DISAHKAN' && !s.bolehSah ? '<p class="small muted" style="margin:12px 0 0">Mengubah rekod yang telah disahkan akan menghantarnya semula untuk pengesahan.</p>' : ''}`,
    kaki: boleh ? `${!(r.status === 'DISAHKAN' && !s.bolehSah) ? `<button class="btn bad" data-padam>${ic('trash')} Padam</button>` : ''}
      ${r.status === 'MENUNGGU' ? `<button class="btn" data-semula>${ic('mail')} Hantar semula</button>` : ''}<span class="spacer"></span>
      <button class="btn pri" data-ubah>${ic('edit')} Ubah</button>` : '<button class="btn" data-tutup>Tutup</button>'
  });
  const on = (sel, fn) => { const b = $(sel, d); if (b) b.onclick = fn; };
  on('[data-ubah]', () => { d.close(); borang(r); });
  on('[data-semula]', (e) => sibuk(e.currentTarget, async () => { try { toast((await api('bukuoff.hantarSemula', { id: r.id })).msg, 'ok'); } catch (err) { ralat(err); } }));
  on('[data-padam]', async (e) => {
    const b = e.currentTarget;
    if (!(await sahkan(`Padam rekod "${r.perincian}" (${dmy(r.tarikh)})?`, { ya: 'Padam', bahaya: true }))) return;
    sibuk(b, async () => { try { D = await api('bukuoff.padam', { id: r.id }); d.close(); toast('Rekod dipadam', 'ok'); lukis('rekod'); } catch (err) { ralat(err); } });
  });
}

function minitDari(a, b) {
  if (!a || !b) return null;
  const [h1, m1] = a.split(':').map(Number), [h2, m2] = b.split(':').map(Number);
  let x = h2 * 60 + m2 - (h1 * 60 + m1);
  if (x <= 0) x += 1440;
  return x;
}

function borang(r, awal = {}) {
  const s = stafOf(r ? r.stafId : pilih);
  let jenis = r ? r.jenis : awal.jenis || 'OT';
  const perincianLama = [...new Set(D.rekod.filter((x) => x.stafId === s.id).map((x) => x.perincian))].slice(-80);
  const d = dialog({
    tajuk: r ? 'Ubah rekod' : 'Rekod baharu', badge: s.id !== me() ? s.nama : '',
    badan: `<form id="fBo" autocomplete="off">
      <div class="seg" id="seg">${['OT', 'OFF'].map((j) => `<button type="button" data-j="${j}">${JENIS[j]}</button>`).join('')}
        <select class="in" id="jLain" aria-label="Jenis lain"><option value="">Lain-lain…</option>${['AWAL', 'NOTA', 'BATAL'].map((j) => `<option value="${j}">${JENIS[j]}</option>`).join('')}</select></div>
      <div class="chips" id="preset" style="flex-wrap:wrap;margin:12px 0 4px"></div>
      <div class="grid" style="grid-template-columns:minmax(0,1.2fr) minmax(0,1fr) minmax(0,1fr);gap:0 10px">
        <label class="field"><span>Tarikh</span><input class="in" type="date" name="tarikh" required value="${esc(r ? r.tarikh : awal.tarikh || hariIni())}"></label>
        <label class="field"><span>Masa mula</span><input class="in" type="time" name="mula" value="${esc(r ? r.masaMula : '')}"></label>
        <label class="field"><span>Masa tamat</span><input class="in" type="time" name="tamat" value="${esc(r ? r.masaTamat : '')}"></label></div>
      <div class="grid" style="grid-template-columns:minmax(0,1fr) minmax(0,1fr) minmax(0,2fr);gap:0 10px">
        <label class="field"><span>Jam</span><input class="in" type="number" min="0" max="744" name="jam" value="${r ? Math.floor(r.minit / 60) : ''}"></label>
        <label class="field"><span>Minit</span><input class="in" type="number" min="0" max="59" step="5" name="min" value="${r ? r.minit % 60 : ''}"></label>
        <div class="field"><span>Baki selepas</span><div class="bo-prev" id="prev">—</div></div></div>
      <label class="field"><span>Perincian *</span><input class="in" name="perincian" maxlength="200" required list="dlPer" value="${esc(r ? r.perincian : '')}" placeholder="cth TPN (P), Off pagi"><datalist id="dlPer">${perincianLama.map((p) => `<option value="${esc(p)}">`).join('')}</datalist></label>
      <label class="field"><span>Catatan</span><input class="in" name="catatan" maxlength="500" value="${esc(r ? r.catatan : '')}"></label>
      ${D.tetapan.notifikasi === 'MANUAL' ? '<p class="small muted" style="margin:0">Mod draf: rekod disimpan sebagai draf. Klik "Hantar untuk pengesahan" bila siap.</p>' : '<p class="small muted" style="margin:0">Tugasan & off dihantar terus kepada penyelia untuk pengesahan melalui emel.</p>'}
    </form>`,
    kaki: `<button class="btn" data-tutup>Batal</button><button class="btn pri" data-simpan>${D.tetapan.notifikasi === 'MANUAL' ? 'Simpan (draf)' : 'Simpan & hantar'}</button>`
  });
  const f = $('#fBo', d), seg = $('#seg', d), lainSel = $('#jLain', d);
  const minit = () => (parseInt(f.jam.value, 10) || 0) * 60 + (parseInt(f.min.value, 10) || 0);
  const pratonton = () => {
    let cur = rekodStaf(s.id).reduce((a, x) => a + (r && x.id === r.id ? 0 : eff(x) * x.minit), 0);
    cur += sgn(jenis) * minit();
    $('#prev', d).innerHTML = `<b style="color:${cur < 0 ? 'var(--bad)' : 'var(--ink)'}">${fmt(cur)}</b>`;
  };
  const kiraMasa = () => { const m = minitDari(f.mula.value, f.tamat.value); if (m != null) { f.jam.value = Math.floor(m / 60); f.min.value = m % 60; } pratonton(); };
  const setJenis = (j) => {
    jenis = j;
    $$('[data-j]', seg).forEach((b) => b.classList.toggle('on', b.dataset.j === j));
    lainSel.value = ['AWAL', 'NOTA', 'BATAL'].includes(j) ? j : ''; lainSel.classList.toggle('on', !!lainSel.value);
    const ps = (D.preset[j] || []);
    $('#preset', d).innerHTML = ps.map((p, i) => `<button type="button" class="chip" data-p="${i}">${esc(p.nilai)}${p.label ? `<small> ${esc(p.label)}</small>` : ''}</button>`).join('');
    pratonton();
  };
  seg.onclick = (e) => { const b = e.target.closest('[data-j]'); if (b) setJenis(b.dataset.j); };
  lainSel.onchange = () => setJenis(lainSel.value || 'OT');
  $('#preset', d).onclick = (e) => {
    const b = e.target.closest('[data-p]'); if (!b) return;
    const p = D.preset[jenis][+b.dataset.p], m = /(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})/.exec(p.label || '');
    f.perincian.value = p.nilai;
    if (m) { f.mula.value = m[1].padStart(5, '0'); f.tamat.value = m[2].padStart(5, '0'); kiraMasa(); }
  };
  f.mula.onchange = kiraMasa; f.tamat.onchange = kiraMasa;
  f.jam.oninput = pratonton; f.min.oninput = pratonton;
  setJenis(jenis);
  $('[data-simpan]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    if (!f.perincian.value.trim()) return toast('Isi perincian', 'bad');
    if (jenis !== 'NOTA' && !(minit() > 0)) return toast('Isi jumlah jam / minit', 'bad');
    try {
      const res = await api('bukuoff.simpan', { id: r ? r.id : '', stafId: s.id, tarikh: f.tarikh.value, jenis, perincian: f.perincian.value.trim(),
        masaMula: f.mula.value, masaTamat: f.tamat.value, minit: minit(), catatan: f.catatan.value.trim() });
      D = res.data; d.close(); toast(res.msg, /gagal|belum ada|tidak dihantar/i.test(res.msg) ? 'bad' : 'ok'); lukis('rekod'); segarBoot();
    } catch (err) { ralat(err); }
  });
}

/* ---------- pengesahan (penyelia / admin) ---------- */
function lukisSah(el) {
  const P2 = D.rekod.filter((r) => r.status === 'MENUNGGU' && stafOf(r.stafId).bolehSah).sort((a, b) => (a.tarikh < b.tarikh ? -1 : 1));
  const kump = {};
  P2.forEach((r) => (kump[r.stafId] = kump[r.stafId] || []).push(r));
  el.innerHTML = `${P2.length ? `<div class="row bo-sahbar"><label class="switch"><input type="checkbox" id="semua"> Pilih semua</label><span class="spacer"></span>
      <button class="btn bad" id="bTolak" disabled>${ic('x')} Tolak</button><button class="btn pri" id="bSah" disabled>${ic('check')} Sahkan</button></div>
    ${Object.keys(kump).map((id) => { const s = stafOf(id); return `<section class="card bo-grp"><div class="bo-grp-h"><span class="av sm">${esc(inisial(s.nama))}</span><div style="flex:1;min-width:0"><b>${esc(s.nama)}</b><div class="small muted">Baki semasa ${fmt(s.baki)} · ${kump[id].length} menunggu</div></div>
        <label class="switch" title="Pilih semua rekod staf ini"><input type="checkbox" data-grp="${esc(id)}"></label></div>
        ${kump[id].map((r) => `<label class="bo-sah"><input type="checkbox" data-sid="${esc(r.id)}" data-st="${esc(id)}">${itemHTML(r)}</label>`).join('')}</section>`; }).join('')}`
    : `<div class="card empty">${ic('check')}<p style="margin:0">Tiada rekod menunggu pengesahan anda.</p></div>`}
    ${D.peranan === 'ADMIN' ? `<section class="card pad" style="margin-top:16px"><h3 style="margin:0 0 6px;font-size:16px">Pindah seliaan</h3>
      <p class="small muted" style="margin:0 0 12px">Pindahkan semua staf seliaan seorang penyelia kepada penyelia lain (cth bila penyelia bertukar). Penyelia setiap staf juga boleh ditukar dalam Admin → Pengguna.</p>
      <div class="row"><select class="in" id="pDari" style="flex:1;min-width:180px"><option value="">Dari penyelia…</option>${D.penyelia.map((p) => `<option value="${esc(p.id)}">${esc(p.nama)}</option>`).join('')}</select>
      <select class="in" id="pKe" style="flex:1;min-width:180px"><option value="">Kepada penyelia…</option>${D.penyelia.map((p) => `<option value="${esc(p.id)}">${esc(p.nama)}</option>`).join('')}</select>
      <button class="btn" id="bPindah">Pindah</button></div></section>` : ''}`;
  const dipilih = () => $$('[data-sid]', el).filter((c) => c.checked).map((c) => c.dataset.sid);
  const kemas = () => { const n = dipilih().length; ['#bSah', '#bTolak'].forEach((k) => { const b = $(k, el); if (b) { b.disabled = !n; b.lastChild.textContent = (k === '#bSah' ? ' Sahkan' : ' Tolak') + (n ? ` (${n})` : ''); } }); };
  el.onclick = (e) => { if (e.target.closest('.bo-it')) { e.preventDefault(); const c = e.target.closest('.bo-sah').querySelector('input'); c.checked = !c.checked; kemas(); } };
  el.onchange = (e) => {
    if (e.target.id === 'semua') $$('[data-sid],[data-grp]', el).forEach((c) => (c.checked = e.target.checked));
    if (e.target.dataset.grp) $$(`[data-st="${CSS.escape(e.target.dataset.grp)}"]`, el).forEach((c) => (c.checked = e.target.checked));
    kemas();
  };
  const putus = (keputusan) => async (e) => {
    const ids = dipilih(), b = e.currentTarget;
    let catatan = '';
    if (keputusan === 'TOLAK') {
      catatan = await new Promise((res) => {
        const dd = dialog({ tajuk: `Tolak ${ids.length} rekod`, saiz: 'sm', badan: `<label class="field" style="margin:0"><span>Sebab penolakan *</span><textarea class="in" id="sebab" rows="3" maxlength="300"></textarea></label>`,
          kaki: `<button class="btn" data-tutup>Batal</button><button class="btn bad" data-ok>Tolak</button>`, onClose: () => res(dd._v || '') });
        $('[data-ok]', dd).onclick = () => { const v = $('#sebab', dd).value.trim(); if (!v) return toast('Nyatakan sebab', 'bad'); dd._v = v; dd.close(); };
      });
      if (!catatan) return;
    } else if (!(await sahkan(`Sahkan ${ids.length} rekod?`, { ya: 'Sahkan' }))) return;
    sibuk(b, async () => { try { const r = await api('bukuoff.putus', { ids, keputusan, catatan }); D = r.data; toast(r.msg, 'ok'); lukis('sah'); segarBoot(); } catch (err) { ralat(err); } });
  };
  if ($('#bSah', el)) { $('#bSah', el).onclick = putus('SAH'); $('#bTolak', el).onclick = putus('TOLAK'); }
  const bp = $('#bPindah', el);
  if (bp) bp.onclick = async (e) => {
    const dari = $('#pDari', el).value, ke = $('#pKe', el).value, b = e.currentTarget;
    if (!dari || !ke || dari === ke) return toast('Pilih dua penyelia yang berbeza', 'bad');
    if (!(await sahkan(`Pindahkan semua staf seliaan ${stafOf(dari).nama} kepada ${stafOf(ke).nama}?`, { ya: 'Pindah' }))) return;
    sibuk(b, async () => { try { const r = await api('bukuoff.pindah', { dari, ke }); D = r.data; toast(r.msg, 'ok'); lukis('sah'); } catch (err) { ralat(err); } });
  };
}

/* ---------- cetak buku ---------- */
function cetakBuku() {
  const s = stafOf(pilih), R = rekodStaf(), j = (S.boot && S.boot.jenama) || {};
  const el = document.createElement('div');
  el.id = 'cetak';
  el.innerHTML = `<div class="ct-h"><div><b>BUKU REKOD CUTI PAMPASAN</b><small>${esc([j.subjudul, j.jabatan].filter(Boolean).join(' · '))}</small></div><small>Dicetak ${esc(dmy(hariIni()))}</small></div>
    <p style="margin:0 0 6px">Nama: <b>${esc(s.nama)}</b> &nbsp; ID: <b>${esc(s.id)}</b>${s.jawatan ? ` &nbsp; Jawatan: <b>${esc(s.jawatan)}</b>` : ''}${s.penyeliaNama ? ` &nbsp; Penyelia: <b>${esc(s.penyeliaNama)}</b>` : ''}</p>
    <table class="ct bo-ct"><thead><tr><th style="width:20mm">Tarikh</th><th>Perincian tugasan / off</th><th style="width:30mm">Masa</th><th style="width:20mm">Σ Jam</th><th style="width:20mm">Baki off</th><th style="width:34mm">Penyelia</th></tr></thead>
    <tbody>${R.map((r) => `<tr class="${eff(r) > 0 ? 'p' : eff(r) < 0 ? 'm' : ''}"${r.jenis === 'BATAL' || r.status === 'DITOLAK' ? ' style="text-decoration:line-through"' : ''}>
      <td>${esc(dmy(r.tarikh))}</td><td style="text-align:left">${esc(r.perincian)}${r.catatan ? `<br><small>${esc(r.catatan)}</small>` : ''}</td><td>${r.masaMula ? t12(r.masaMula) + '–' + t12(r.masaTamat) : ''}</td>
      <td>${r.minit ? (eff(r) ? fmt(eff(r) * r.minit, true) : fmt(r.minit)) : ''}</td><td>${fmt(r.baki)}</td>
      <td>${r.status === 'DISAHKAN' ? '✓ ' + esc(dmy(r.disahkan)) : r.status === 'DITOLAK' ? 'Ditolak' : r.status === 'MENUNGGU' ? 'Menunggu' : r.status === 'DRAF' ? 'Draf' : ''}</td></tr>`).join('')}</tbody></table>
    <p style="margin-top:8px"><b>Baki akhir: ${fmt(R.length ? R[R.length - 1].baki : 0)}</b></p>`;
  document.body.appendChild(el);
  document.body.classList.add('mencetak', 'cetak-tegak');
  const habis = () => { el.remove(); document.body.classList.remove('mencetak', 'cetak-tegak'); removeEventListener('afterprint', habis); };
  addEventListener('afterprint', habis);
  setTimeout(() => print(), 50);
}

/* ============================ Halaman pengesahan awam (pautan emel) ============================ */
export async function paparSah(root, id, t) {
  root.innerHTML = `<div class="sah-pg"><header><img src="assets/logo.svg" alt=""><div><b>Pengesahan Cuti Pampasan</b><small>Buku Off · UPAR Suite</small></div></header><main class="card" id="sahK"><div class="skel" style="height:260px"></div></main></div>`;
  const k = $('#sahK', root);
  const papar = (x) => {
    const tunggu = x.status === 'MENUNGGU', jam = fmt(x.kesan || x.minit, !!x.kesan);
    k.innerHTML = `<div class="sah-amt"><span>${esc(JENIS[x.jenis] || x.jenis)}</span><b style="color:${x.kesan > 0 ? 'var(--ot)' : x.kesan < 0 ? 'var(--off)' : 'var(--ink)'}">${jam}</b></div>
      ${tunggu ? `<div class="sah-bk"><div><small>Baki sebelum</small><b>${fmt(x.bakiSebelum)}</b></div><i>→</i><div class="on"><small>Selepas disahkan</small><b>${fmt(x.bakiSelepas)}</b></div></div>` : ''}
      <dl class="kv"><dt>Staf</dt><dd>${esc(x.staf)}${x.jawatan ? `<br><small class="muted">${esc(x.jawatan)}</small>` : ''}</dd><dt>Tarikh</dt><dd>${esc(dmy(x.tarikh))}</dd>
        <dt>Perincian</dt><dd>${esc(x.perincian)}</dd>${x.masaMula ? `<dt>Masa</dt><dd>${t12(x.masaMula)} – ${t12(x.masaTamat)}</dd>` : ''}${x.catatan ? `<dt>Catatan</dt><dd>${esc(x.catatan)}</dd>` : ''}
        ${x.tunggu > 1 && tunggu ? `<dt>Lain-lain</dt><dd>${x.tunggu - 1} rekod lagi menunggu</dd>` : ''}</dl>
      ${tunggu ? `<label class="field"><span>Catatan (wajib jika tolak)</span><textarea class="in" id="sCat" rows="2" maxlength="300"></textarea></label>
        <div class="sah-btn"><button class="btn bad" data-k="TOLAK">${ic('x')} Tolak</button><button class="btn pri" data-k="SAH" style="background:var(--ok)">${ic('check')} Sahkan</button></div>`
      : `<div class="sah-st ${x.status === 'DISAHKAN' ? 'ok' : 'bad'}">${ic(x.status === 'DISAHKAN' ? 'check' : 'x')}<h2>${x.status === 'DISAHKAN' ? 'Telah disahkan' : x.status === 'DITOLAK' ? 'Telah ditolak' : esc(x.status)}</h2>
          <p>${esc(x.oleh || '')}${x.disahkan ? ' · ' + esc(dmy(x.disahkan)) : ''}</p>${x.catatanPenyelia ? `<p>"${esc(x.catatanPenyelia)}"</p>` : ''}</div>`}
      <p class="small muted" style="text-align:center;margin:18px 0 0"><a href="./#/bukuoff/sah" onclick="location.hash='#/bukuoff/sah';location.reload();return false">Buka UPAR Suite</a> untuk sahkan beramai-ramai.</p>`;
    $$('[data-k]', k).forEach((b) => (b.onclick = () => sibuk(b, async () => {
      const catatan = ($('#sCat', k).value || '').trim();
      if (b.dataset.k === 'TOLAK' && !catatan) return toast('Sila nyatakan sebab penolakan', 'bad');
      try { papar(await api('bukuoff.pautanPutus', { id, t, keputusan: b.dataset.k, catatan })); toast(b.dataset.k === 'SAH' ? 'Disahkan' : 'Ditolak', 'ok'); } catch (err) { ralat(err); }
    })));
  };
  try { papar(await api('bukuoff.pautan', { id, t }, { senyap: true })); }
  catch (e) { k.innerHTML = `<div class="sah-st bad">${ic('alert')}<h2>Pautan tidak sah</h2><p>${esc(e.message)}</p></div>`; }
}
