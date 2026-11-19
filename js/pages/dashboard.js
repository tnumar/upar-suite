// Dashboard — papan kerja preskripsi TPN / IVA / Kemo (Diterima → Penyaringan → Dalam Makmal → Sedia Diambil).
// Luar talian dahulu: perubahan disimpan dalam barisan tempatan dan diselaraskan dengan pelayan.
import { S, tajuk } from '../app.js';
import { api } from '../api.js';
import { $, $$, esc, toast, ralat, sibuk, dialog, sahkan, simpan, ambil, debounce } from '../ui.js';
import { ic } from '../icons.js';

export const PERINGKAT = ['Diterima', 'Penyaringan', 'Dalam Makmal', 'Sedia Diambil'];
const KATA = ['Mula saring', 'Masuk makmal', 'Sedia diambil'];
export const AKHIR = 3;
export const JENIS = ['TPN', 'IVA', 'KEMO'];
export const LABEL = { TPN: 'TPN', IVA: 'IVA', KEMO: 'Kemo' };
const PRIO = { Biasa: 0, Segera: 1, STAT: 2 };
const HARI = ['Ahad', 'Isnin', 'Selasa', 'Rabu', 'Khamis', 'Jumaat', 'Sabtu'];
const BULAN = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogo', 'Sep', 'Okt', 'Nov', 'Dis'];
const NEO = 'Neonate', SED_KAT = ['Dewasa', 'Pediatrik'];

export const pad = (n) => String(n).padStart(2, '0');
export const dkey = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const hariIni = () => dkey(new Date());
export const hm = (ms) => { const d = new Date(ms); return `${pad(d.getHours())}:${pad(d.getMinutes())}`; };
const parseKey = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
export const atTime = (k, t) => { const [y, m, d] = k.split('-').map(Number); const [h, mi] = t.split(':').map(Number); return new Date(y, m - 1, d, h, mi).getTime(); };
export const tarikhP = (k) => { const d = parseKey(k); return `${HARI[d.getDay()]}, ${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`; };
const tarikhR = (k) => { const d = parseKey(k); return `${d.getDate()} ${BULAN[d.getMonth()]}`; };
const tambahHari = (k, n) => { const d = parseKey(k); d.setDate(d.getDate() + n); return dkey(d); };
export const fmtDur = (min) => { min = Math.round(min); if (min < 60) return min + ' min'; const h = Math.floor(min / 60), m = min % 60; return m ? `${h}j ${pad(m)}m` : `${h}j`; };
const uid = () => 'p-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

/* ---------- logik masa (dikongsi dengan kiosk) ---------- */
export function alat(D) {
  const dayType = (k) => { const o = D.hari[k]; if (o) return o.t; return D.tetapan.hujungMinggu.includes(parseKey(k).getDay()) ? 'cuti' : 'kerja'; };
  const cutoffHM = (type, k) => D.tetapan.sasaran[type][dayType(k)];
  const cutoffMs = (it) => atTime(it.date, cutoffHM(it.type, it.date));
  const berkenaan = (it) => it.recAt < cutoffMs(it);
  const stageT = (it, s) => { if (s === 0) return it.recAt; const e = it.log.find((l) => l.s === s); return e ? e.t : undefined; };
  const tat = (it) => { const t = stageT(it, AKHIR); return t ? (t - it.recAt) / 60000 : null; };
  const tepat = (it) => { const t = stageT(it, AKHIR); return t !== undefined && t <= cutoffMs(it); };
  const lewat = (it, now) => now > it.eta || (berkenaan(it) && now > cutoffMs(it));
  const etaInfo = (it, now) => { const d = (it.eta - now) / 60000; if (d < 0) return { cls: 'late', text: 'Lewat ' + fmtDur(-d) }; return { cls: d <= D.tetapan.amaranMinit ? 'soon' : 'ok', text: (d < 1 ? '<1 min' : fmtDur(d)) + ' lagi' }; };
  return { dayType, cutoffHM, cutoffMs, berkenaan, stageT, tat, tepat, lewat, etaInfo };
}
const isNeo = (it) => it.type === 'TPN' && it.cat === NEO;
const neoTxt = (it) => [it.qstd && `<b>${it.qstd}</b> STD`, it.qnstd && `<b>${it.qnstd}</b> NSTD`, it.qstr && `<b>${it.qstr}</b> Starter`].filter(Boolean).join(' · ');
const kemoTxt = (it) => [it.npt && `<b>${it.npt}</b> pesakit`, it.ncase && `<b>${it.ncase}</b> kes`].filter(Boolean).join(' · ');
export const utama = (it) => (it.type === 'KEMO' ? kemoTxt(it) || '(tiada butiran)' : isNeo(it) ? neoTxt(it) || '(tiada kuantiti)' : esc(it.desc) || (it.type === 'IVA' && it.cat ? esc(it.cat) : '(tiada keterangan)'));
export const tagJenis = (it) => `<span class="dtag t-${it.type.toLowerCase()}">${LABEL[it.type]}${it.cat ? ' · ' + esc(it.cat) : ''}</span>`;
export const tagPrio = (it) => (it.prio === 'STAT' ? '<span class="dtag p-stat">STAT</span>' : it.prio === 'Segera' ? '<span class="dtag p-urgent">Segera</span>' : '');
export const susun = (A, col) => (col === AKHIR ? (a, b) => A.stageT(b, AKHIR) - A.stageT(a, AKHIR) : (a, b) => PRIO[b.prio] - PRIO[a.prio] || a.eta - b.eta || a.recAt - b.recAt);

/* ---------- keadaan & penyelarasan ---------- */
let D = ambil('cache.dashboard', true), P = null, Q = ambil('dash.q', true) || [], ui = { tarikh: hariIni(), view: ambil('dash.view') || 'papan', jenis: 'ALL', q: '' };
let pemasa = null, kiraan = null, sedangSync = false, tunda = null, adaRalat = false;
const simpanQ = () => simpan('dash.q', Q);
const boleh = () => D && (D.peranan === 'ADMIN' || D.peranan === 'STAF');
function rekod() {
  const m = new Map((D ? D.preskripsi : []).map((p) => [p.id, p]));
  Q.forEach((o) => { if (o.t === 'p') { const l = m.get(o.d.id); if (!l || o.d.upd >= l.upd) m.set(o.d.id, o.d); } });
  return [...m.values()].filter((p) => !p.del);
}
function hariEfektif() { const h = { ...(D ? D.hari : {}) }; Q.forEach((o) => { if (o.t === 'h') h[o.d.tarikh] = { t: o.d.jenis, upd: o.d.upd }; }); return h; }
const DD = () => ({ ...D, hari: hariEfektif() });
function tolak(op) {
  if (op.t === 'p') Q = Q.filter((o) => !(o.t === 'p' && o.d.id === op.d.id));
  if (op.t === 'h') Q = Q.filter((o) => !(o.t === 'h' && o.d.tarikh === op.d.tarikh));
  Q.push(op); simpanQ(); lukis(); jadualSync(400);
}
function jadualSync(ms) { clearTimeout(tunda); tunda = setTimeout(sync, ms); }
async function sync() {
  if (sedangSync) return jadualSync(1500);
  sedangSync = true;
  const hantar = Q.slice();
  try {
    const r = await api('dashboard.sync', { tarikh: ui.tarikh, ops: hantar }, { senyap: false });
    Q = Q.filter((o) => !hantar.includes(o)); simpanQ();
    D = r; simpan('cache.dashboard', D); adaRalat = false;
    if (r.ditolak && r.ditolak.length) toast(r.ditolak.length + ' perubahan ditolak pelayan: ' + r.ditolak[0].ralat, 'bad');
  } catch (e) { adaRalat = true; if (e.code !== 'OFFLINE') ralat(e); }
  sedangSync = false;
  if (P && P.isConnected) lukis();
}

/* ============================ halaman ============================ */
export async function papar(page, rest) {
  tajuk('Dashboard');
  P = page;
  if (rest[0] === 'baru') setTimeout(() => D && boleh() && borang(null), 400);
  if (['papan', 'wad', 'log', 'laporan'].includes(rest[0])) ui.view = rest[0];
  if (!D) page.innerHTML = '<div class="skel" style="height:420px;margin-top:8px"></div>';
  else lukis();
  await sync();
  clearInterval(pemasa); clearInterval(kiraan);
  pemasa = setInterval(() => { if (!P.isConnected) return clearInterval(pemasa); if (document.visibilityState === 'visible') sync(); }, 20000);
  kiraan = setInterval(() => { if (!P.isConnected) return clearInterval(kiraan); kemasKiraan(); }, 30000);
}

function itemHari() {
  const kini = hariIni();
  return rekod().filter((i) => i.date === ui.tarikh || (ui.tarikh === kini && i.date < kini && i.status >= 0 && i.status < AKHIR));
}
function padan(it) {
  if (ui.jenis !== 'ALL' && it.type !== ui.jenis) return false;
  if (!ui.q) return true;
  const h = [it.ward, it.bed, it.ext, it.desc, it.cat, it.type, it.note, it.prio].join(' ').toLowerCase();
  return ui.q.toLowerCase().split(/\s+/).filter(Boolean).every((w) => h.includes(w));
}

function lukis() {
  if (!D || !P) return;
  const A = alat(DD()), base = itemHari().filter((i) => i.status >= 0), dt = A.dayType(ui.tarikh), now = Date.now();
  const views = [['papan', 'Papan'], ['wad', 'Ikut wad'], ['log', 'Log'], ['laporan', 'Laporan']];
  P.innerHTML = `<div class="db-top">
      <div class="db-date"><button class="btn ghost icon" data-hari="-1" aria-label="Hari sebelum">${ic('chevL')}</button><div><b>${esc(tarikhP(ui.tarikh))}</b>
        <button class="db-dt ${dt}" data-dt ${boleh() ? '' : 'disabled'} title="Klik untuk tukar jenis hari">${dt === 'kerja' ? 'Hari bekerja' : 'Hari cuti'}</button></div>
        <button class="btn ghost icon" data-hari="1" aria-label="Hari seterusnya">${ic('chevR')}</button>${ui.tarikh !== hariIni() ? '<button class="btn sm" data-hari="0">Hari ini</button>' : ''}</div>
      <div class="tabs">${views.map(([k, n]) => `<button class="${ui.view === k ? 'on' : ''}" data-view="${k}">${n}</button>`).join('')}</div>
      <span class="spacer"></span>
      <span class="db-sync ${Q.length ? 'pending' : adaRalat ? 'err' : ''}" title="${Q.length ? Q.length + ' perubahan belum diselaraskan' : 'Diselaraskan'}">${ic('sync')}${Q.length ? `<b>${Q.length}</b>` : ''}</span>
      ${D.peranan === 'ADMIN' ? `<button class="btn" data-wad title="Urus nama wad">${ic('pin')}<span class="hide-s">Wad</span></button>` : ''}
      ${boleh() ? `<button class="btn" data-tutup>${ic('check')}<span class="hide-s">Tutup hari</span></button><button class="btn pri" data-baru>${ic('plus')}<span class="hide-s">Preskripsi</span></button>` : ''}
    </div>
    ${ui.view !== 'laporan' ? `<div class="db-sum">${ringkasan(base, A, now)}</div>
    <div class="row db-alat"><div class="chips">${[['ALL', 'Semua'], ...JENIS.map((t) => [t, LABEL[t]])].map(([k, n]) => `<button class="chip ${ui.jenis === k ? 'on' : ''}" data-jenis="${k}">${n} <i>${k === 'ALL' ? base.length : base.filter((i) => i.type === k).length}</i></button>`).join('')}</div>
      <div class="search" style="flex:1 1 200px">${ic('search')}<input class="in" id="dq" type="search" placeholder="Cari wad, katil, sediaan" value="${esc(ui.q)}"></div>
      <button class="btn" data-xls title="Eksport Excel hari ini">${ic('install')}<span class="hide-s">Excel</span></button></div>` : ''}
    <div id="dbV"></div>`;
  const v = $('#dbV', P);
  if (ui.view === 'laporan') lLaporan(v);
  else {
    const semua = itemHari(), list = semua.filter(padan);
    if (!semua.length) v.innerHTML = `<div class="card empty">${ic('board')}<h3 style="color:var(--ink);margin:0 0 6px">${ui.tarikh === hariIni() ? 'Belum ada preskripsi hari ini' : 'Tiada rekod pada tarikh ini'}</h3><p style="margin:0 0 14px">Tambah preskripsi yang diterima. Setiap satu bergerak dari Diterima hingga Sedia Diambil.</p>${boleh() ? `<button class="btn pri" data-baru>${ic('plus')} Preskripsi baharu</button>` : ''}</div>`;
    else if (ui.view === 'log') v.innerHTML = logHTML(list, A);
    else { const l2 = list.filter((i) => i.status >= 0); v.innerHTML = !l2.length ? '<p class="muted">Tiada padanan.</p>' : ui.view === 'wad' ? wadHTML(l2, A, now) : papanHTML(l2, A, now); }
  }
  ikat();
}

function ringkasan(base, A, now) {
  let h = JENIS.map((t) => {
    const a = base.filter((i) => i.type === t), siap = a.filter((i) => i.status === AKHIR), lw = a.filter((i) => i.status < AKHIR && A.lewat(i, now)).length;
    const app = siap.filter(A.berkenaan), okN = app.filter(A.tepat).length, pct = a.length ? Math.round((siap.length / a.length) * 100) : 0;
    return `<div class="db-s s-${t.toLowerCase()}"><div class="sl"><i></i>${LABEL[t]}</div><div class="sv"><b>${siap.length}</b><span>/ ${a.length}</span><small>sedia diambil</small></div>
      <div class="db-bar"><i style="width:${pct}%"></i></div><div class="sm">Sasaran ${A.cutoffHM(t, ui.tarikh)}${app.length ? ` · ${Math.round((okN / app.length) * 100)}% dalam sasaran` : ''}${lw ? ` · <em>${lw} lewat</em>` : ''}</div>
      ${t === 'KEMO' && a.length ? `<div class="sm"><b>${a.reduce((s, i) => s + i.npt, 0)}</b> pesakit · <b>${a.reduce((s, i) => s + i.ncase, 0)}</b> kes</div>` : ''}
      ${t === 'TPN' && a.some(isNeo) ? `<div class="sm">Neonate: <b>${a.reduce((s, i) => s + i.qstd, 0)}</b> STD · <b>${a.reduce((s, i) => s + i.qnstd, 0)}</b> NSTD · <b>${a.reduce((s, i) => s + i.qstr, 0)}</b> Starter</div>` : ''}</div>`;
  }).join('');
  const siap = base.filter((i) => i.status === AKHIR), pend = base.filter((i) => i.status < AKHIR);
  const avg = siap.length ? siap.reduce((s, i) => s + A.tat(i), 0) / siap.length : null, lw = pend.filter((i) => A.lewat(i, now)).length;
  return h + `<div class="db-s"><div class="sl"><i></i>Purata TAT</div><div class="sv"><b>${avg !== null ? fmtDur(avg) : '—'}</b></div><div class="db-bar"><i style="width:0"></i></div><div class="sm">Menunggu ${pend.length}${lw ? ` · <em>${lw} lewat</em>` : ''}</div></div>`;
}
function tgt(it, A, now) {
  if (it.status < 0 || !A.berkenaan(it)) return '';
  const c = A.cutoffMs(it), h = hm(c);
  if (it.status === AKHIR) { const ok = A.stageT(it, AKHIR) <= c; return `<span class="tg ${ok ? 'ok' : 'late'}">${ok ? 'Dalam' : 'Lewat'} sasaran ${h}</span>`; }
  return `<span class="tg ${now > c || it.eta > c ? 'late' : ''}">Sasaran sebelum ${h}</span>`;
}
export function kadHTML(it, A, now, opt = {}) {
  const siap = it.status === AKHIR, ei = siap ? null : A.etaInfo(it, now), kemo = it.type === 'KEMO';
  const pl = kemo ? kemoTxt(it) : isNeo(it) ? neoTxt(it) : '', carry = it.date < (opt.tarikh || ui.tarikh);
  const masa = siap ? `<span>Sedia diambil <b>${hm(A.stageT(it, AKHIR))}</b></span><span>TAT <b>${fmtDur(A.tat(it))}</b></span>`
    : `<span>Diterima <b>${hm(it.recAt)}</b></span><span>ETA <b>${hm(it.eta)}</b></span><span class="cd ${ei.cls}" data-cd="${esc(it.id)}">${ei.text}</span>`;
  const t = tgt(it, A, now);
  return `<article class="db-card${!siap && ei.cls === 'late' ? ' late' : ''}${siap ? ' done' : ''}" ${opt.ro ? '' : `data-buka="${esc(it.id)}" tabindex="0"`}>
    <div class="r1">${tagJenis(it)}${tagPrio(it)}${carry ? `<span class="dtag carry">Tertunggak ${tarikhR(it.date)}</span>` : ''}</div>
    <div class="wd"><b>${esc(it.ward || '(tiada wad)')}</b>${kemo ? (it.ext ? `<span>Ext ${esc(it.ext)}</span>` : '') : it.bed ? `<span>Katil ${esc(it.bed)}</span>` : ''}</div>
    ${pl ? `<div class="pt">${pl}</div>` : ''}${it.desc && !isNeo(it) && !kemo ? `<div class="ds">${esc(it.desc)}</div>` : ''}
    <div class="tm">${masa}${t ? `<span class="fl">${t}</span>` : ''}</div>
    ${opt.ro || !boleh() ? '' : `<div class="ac">${it.status > 0 ? `<button class="btn sm ghost" data-undur="${esc(it.id)}" title="Undur ke ${PERINGKAT[it.status - 1]}">←</button>` : ''}${it.status < AKHIR ? `<button class="btn sm pri" data-maju="${esc(it.id)}">${KATA[it.status]} →</button>` : ''}</div>`}</article>`;
}
export function langkah(n) { return `<div class="db-steps">${PERINGKAT.map((_, i) => `<i${i <= n ? ' class="f"' : ''}></i>`).join('')}</div>`; }
export function papanHTML(items, A, now, opt = {}) {
  return `<div class="db-board">${PERINGKAT.map((nm, i) => { const col = items.filter((x) => x.status === i).sort(susun(A, i));
    return `<section class="db-col${i === AKHIR ? ' done' : ''}"><header><div><h3>${nm}</h3><span class="badge grey">${col.length}</span></div>${langkah(i)}</header><div class="stack">${col.length ? col.map((c) => kadHTML(c, A, now, opt)).join('') : '<p class="muted small" style="text-align:center;margin:14px 0">Tiada</p>'}</div></section>`; }).join('')}</div>`;
}
export function wadHTML(items, A, now, opt = {}) {
  const g = new Map();
  items.forEach((it) => { const k = (it.ward || '(tiada wad)').toLowerCase(); if (!g.has(k)) g.set(k, { nama: it.ward || '(tiada wad)', arr: [] }); g.get(k).arr.push(it); });
  const grp = [...g.values()].map((x) => { const pend = x.arr.filter((i) => i.status < AKHIR); x.pend = pend.length; x.eta = pend.length ? Math.min(...pend.map((i) => i.eta)) : Infinity; return x; })
    .sort((a, b) => (a.pend > 0 ? 0 : 1) - (b.pend > 0 ? 0 : 1) || a.eta - b.eta || a.nama.localeCompare(b.nama, 'ms', { numeric: true }));
  return `<div class="db-wards">${grp.map((x) => { const siap = x.arr.length - x.pend;
    return `<section class="card db-wg${x.pend === 0 ? ' complete' : ''}"><div class="db-wgh"><h3>${esc(x.nama)}</h3><span>${x.pend === 0 ? `Semua sedia diambil (${siap})` : `${siap} / ${x.arr.length} sedia diambil`}</span></div>
      ${x.arr.slice().sort((a, b) => (a.status === AKHIR) - (b.status === AKHIR) || susun(A, 0)(a, b)).map((it) => { const fin = it.status === AKHIR, ei = fin ? null : A.etaInfo(it, now);
        return `<div class="db-wr${fin ? ' fin' : ''}" ${opt.ro ? '' : `data-buka="${esc(it.id)}"`}><div>${tagJenis(it)}</div><div class="mid"><b>${utama(it)}</b><small>${it.type === 'KEMO' ? (it.ext ? 'Ext ' + esc(it.ext) : '') : it.bed ? 'Katil ' + esc(it.bed) : ''}</small></div>
          <div class="st"><span>${PERINGKAT[it.status]}</span>${langkah(it.status)}${fin ? `<span class="tg ok">Sedia diambil ${hm(A.stageT(it, AKHIR))}</span>` : `<span class="cd ${ei.cls}" data-cd="${esc(it.id)}" data-wr>ETA ${hm(it.eta)} · ${ei.text}</span>`}</div></div>`; }).join('')}</section>`; }).join('')}</div>`;
}
function logHTML(items, A) {
  const sel = (it, s) => { const t = A.stageT(it, s); return `<td>${t ? hm(t) : '<span class="muted">—</span>'}</td>`; };
  const oleh = (it) => [...new Set(it.log.map((l) => l.by).filter(Boolean))].join(', ');
  return `<div class="card scroll-x"><table class="tbl db-log"><thead><tr><th>Jenis</th><th>Wad / katil</th><th>Sediaan</th><th>Keutamaan</th><th>Status</th><th>Diterima</th><th>Saring</th><th>Makmal</th><th>Sedia</th><th>TAT</th><th>Sasaran</th><th>Staf</th></tr></thead><tbody>
    ${items.slice().sort((a, b) => a.recAt - b.recAt).map((it) => { const t = A.tat(it), ok = it.status === AKHIR && A.berkenaan(it) ? (A.tepat(it) ? '<span class="tg ok">Dalam</span>' : '<span class="tg late">Lewat</span>') : '<span class="muted">—</span>';
      return `<tr class="click${it.status < 0 ? ' void' : ''}" data-buka="${esc(it.id)}"><td>${tagJenis(it)}</td><td><b>${esc(it.ward)}</b>${it.type === 'KEMO' ? (it.ext ? ' / Ext ' + esc(it.ext) : '') : it.bed ? ' / ' + esc(it.bed) : ''}</td><td class="small">${utama(it)}</td><td class="small">${esc(it.prio)}</td>
        <td class="small">${it.status < 0 ? 'Dibatalkan' : PERINGKAT[it.status]}</td>${sel(it, 0)}${sel(it, 1)}${sel(it, 2)}${sel(it, 3)}<td>${t !== null ? fmtDur(t) : '<span class="muted">—</span>'}</td><td>${ok}</td><td class="small muted">${esc(oleh(it))}</td></tr>`; }).join('')}</tbody></table></div>`;
}
function kemasKiraan() {
  if (!D || !P || !P.isConnected) return;
  const A = alat(DD()), now = Date.now(), m = new Map(rekod().map((i) => [i.id, i]));
  $$('[data-cd]', P).forEach((el) => { const it = m.get(el.dataset.cd); if (!it || it.status >= AKHIR) return; const ei = A.etaInfo(it, now); el.className = 'cd ' + ei.cls; el.textContent = el.hasAttribute('data-wr') ? `ETA ${hm(it.eta)} · ${ei.text}` : ei.text; const c = el.closest('.db-card'); if (c) c.classList.toggle('late', ei.cls === 'late'); });
}

function ikat() {
  P.onclick = (e) => {
    const b = e.target.closest('button, [data-buka]');
    if (!b) return;
    const d = b.dataset;
    if (d.hari !== undefined) { ui.tarikh = d.hari === '0' ? hariIni() : tambahHari(ui.tarikh, Number(d.hari)); lukis(); sync(); return; }
    if (d.view) { ui.view = d.view; simpan('dash.view', ui.view); lukis(); return; }
    if (d.jenis) { ui.jenis = d.jenis; lukis(); return; }
    if (d.dt !== undefined) { const j = alat(DD()).dayType(ui.tarikh) === 'kerja' ? 'cuti' : 'kerja'; tolak({ t: 'h', d: { tarikh: ui.tarikh, jenis: j, upd: Date.now() } }); toast(`Ditanda ${j === 'kerja' ? 'hari bekerja' : 'hari cuti'}`); return; }
    if (d.baru !== undefined) return borang(null);
    if (d.tutup !== undefined) return tutupHari();
    if (d.xls !== undefined) return excelHari();
    if (d.wad !== undefined) return urusWad();
    if (d.maju) { e.stopPropagation(); return tukarStatus(d.maju, 1); }
    if (d.undur) { e.stopPropagation(); return tukarStatus(d.undur, -1); }
    if (d.buka) { const it = rekod().find((x) => x.id === d.buka); if (it) borang(it); }
  };
  P.onkeydown = (e) => { if (e.key === 'Enter' && e.target.dataset && e.target.dataset.buka) { const it = rekod().find((x) => x.id === e.target.dataset.buka); if (it) borang(it); } };
  const q = $('#dq', P);
  if (q) q.oninput = debounce((e) => { ui.q = e.target.value; const pos = e.target.selectionStart; lukis(); const n = $('#dq', P); n.focus(); n.setSelectionRange(pos, pos); }, 250);
}

function tukarStatus(id, arah) {
  const it0 = rekod().find((x) => x.id === id); if (!it0) return;
  const it = JSON.parse(JSON.stringify(it0)), n = it.status + arah;
  if (n < 0 || n > AKHIR) return;
  if (arah > 0) { it.log = it.log.filter((l) => l.s !== n); it.log.push({ s: n, t: Date.now() }); }
  else it.log = it.log.filter((l) => l.s <= n);
  it.status = n; it.upd = Date.now();
  tolak({ t: 'p', d: it });
  toast(`${it.ward || 'Preskripsi'}: ${PERINGKAT[n]}`);
}

/* ---------- borang preskripsi ---------- */
function borang(it) {
  if (!boleh() && !it) return;
  const baru = !it, sn = D.senarai, A = alat(DD());
  const jenis0 = it ? it.type : ui.jenis !== 'ALL' ? ui.jenis : 'TPN';
  const ro = !boleh();
  const d = dialog({
    tajuk: baru ? 'Preskripsi baharu' : 'Kemas kini preskripsi', badge: it ? `${PERINGKAT[Math.max(0, it.status)]}${it.status < 0 ? ' · Dibatalkan' : ''}` : '',
    badan: `<form id="fP" autocomplete="off"><div class="seg db-seg">${JENIS.map((t) => `<button type="button" data-t="${t}" class="${t === jenis0 ? 'on' : ''}">${LABEL[t]}</button>`).join('')}</div>
      <div class="grid" style="grid-template-columns:repeat(2,minmax(0,1fr));gap:0 12px;margin-top:12px">
        <label class="field nk"><span>Kategori</span><select class="in" name="cat"></select></label>
        <label class="field nk"><span>Keutamaan</span><select class="in" name="prio">${Object.keys(PRIO).map((p) => `<option ${it && it.prio === p ? 'selected' : ''}>${p}</option>`).join('')}</select></label>
        <label class="field"><span>Wad *</span><input class="in" name="ward" list="dlWad" required value="${esc(it ? it.ward : '')}"><datalist id="dlWad">${sn.wad.map((w) => `<option value="${esc(w)}">`).join('')}</datalist></label>
        <label class="field fBed"><span>Katil</span><input class="in" name="bed" value="${esc(it ? it.bed : '')}"></label>
        <label class="field ko"><span>Extension</span><input class="in" name="ext" value="${esc(it ? it.ext : '')}"></label>
        <label class="field ko"><span>Jumlah pesakit *</span><input class="in" type="number" min="0" name="npt" value="${it && it.npt ? it.npt : ''}"></label>
        <label class="field ko"><span>Jumlah kes *</span><input class="in" type="number" min="0" name="ncase" value="${it && it.ncase ? it.ncase : ''}"></label>
        <label class="field dw"><span>Sediaan *</span><select class="in" name="descSel"><option value="">Pilih sediaan</option>${[...new Set([...sn.sediaanDewasa, ...(it && it.desc && !sn.sediaanDewasa.includes(it.desc) ? [it.desc] : [])])].map((s) => `<option ${it && it.desc === s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></label>
        <label class="field dt"><span>Sediaan</span><input class="in" name="desc" value="${esc(it ? it.desc : '')}"></label>
        <label class="field no"><span>Neonatal STD</span><input class="in" type="number" min="0" name="qstd" value="${it && it.qstd ? it.qstd : ''}"></label>
        <label class="field no"><span>Neonatal NSTD</span><input class="in" type="number" min="0" name="qnstd" value="${it && it.qnstd ? it.qnstd : ''}"></label>
        <label class="field no"><span>Starter</span><input class="in" type="number" min="0" name="qstr" value="${it && it.qstr ? it.qstr : ''}"></label>
        <label class="field"><span>Diterima (masa)</span><input class="in" type="time" name="rec" value="${it ? hm(it.recAt) : ui.tarikh === hariIni() ? hm(Date.now()) : '08:00'}"></label>
        <label class="field nk2"><span>Nota</span><input class="in" name="note" value="${esc(it ? it.note : '')}"></label></div>
      ${it ? `<div class="h5">Rekod peringkat</div><ol class="db-tl">${PERINGKAT.map((nm, s) => { const t = A.stageT(it, s), e = it.log.find((l) => l.s === s); return `<li class="${t ? 'on' : ''}"><b>${nm}</b><span>${t ? hm(t) : '—'}</span><small>${esc((e && e.by) || '')}</small></li>`; }).join('')}</ol>` : ''}</form>`,
    kaki: ro ? '<button class="btn" data-tutup>Tutup</button>' : `${it ? (it.status >= 0 ? '<button class="btn" data-batal>Batal preskripsi</button>' : '<button class="btn" data-pulih>Pulihkan</button>') + (D.peranan === 'ADMIN' || it.oleh === S.me.stafId ? `<button class="btn bad ghost" data-padam>${ic('trash')}</button>` : '') : ''}
      <span class="spacer"></span>${baru ? '<button class="btn" data-lagi>Simpan & baharu</button>' : ''}<button class="btn pri" data-ok>Simpan</button>`
  });
  const f = $('#fP', d);
  let jenis = jenis0;
  const isiKat = (cur) => { const l = [...(sn[jenis] || [])]; if (cur && !l.includes(cur)) l.push(cur); f.cat.innerHTML = l.map((c) => `<option ${c === cur ? 'selected' : ''}>${esc(c)}</option>`).join(''); };
  const terap = () => {
    const k = jenis === 'KEMO', neo = jenis === 'TPN' && f.cat.value === NEO, iva = jenis === 'IVA', dw = jenis === 'TPN' && SED_KAT.includes(f.cat.value);
    $$('.nk', d).forEach((e) => (e.hidden = k));
    $$('.ko', d).forEach((e) => (e.hidden = !k));
    $$('.no', d).forEach((e) => (e.hidden = !neo));
    $('.fBed', d).hidden = k || neo || iva;
    $('.dw', d).hidden = !dw;
    $('.dt', d).hidden = k || neo || iva || dw;
    $('.nk2', d).hidden = k || neo;
  };
  isiKat(it && it.type === jenis ? it.cat : '');
  terap();
  if (ro) $$('input,select,button[data-t]', f).forEach((x) => (x.disabled = true));
  $('.db-seg', d).onclick = (e) => { const b = e.target.closest('[data-t]'); if (!b || ro) return; jenis = b.dataset.t; $$('[data-t]', d).forEach((x) => x.classList.toggle('on', x === b)); isiKat(''); terap(); };
  f.cat.onchange = terap;
  const simpanP = async (lagi) => {
    const k = jenis === 'KEMO', neo = jenis === 'TPN' && f.cat.value === NEO, iva = jenis === 'IVA', dw = jenis === 'TPN' && SED_KAT.includes(f.cat.value);
    const ward = f.ward.value.trim().replace(/\s+/g, ' ');
    if (!ward) return toast('Isi wad', 'bad');
    const qn = (n) => (neo ? Math.max(0, parseInt(f[n].value, 10) || 0) : 0);
    if (neo && !(qn('qstd') || qn('qnstd') || qn('qstr'))) return toast('Isi sekurang-kurangnya satu kuantiti Neonate', 'bad');
    if (k && !(f.npt.value && f.ncase.value)) return toast('Isi jumlah pesakit dan kes', 'bad');
    if (dw && !f.descSel.value) return toast('Pilih sediaan', 'bad');
    const tarikh = it ? it.date : ui.tarikh, recAt = atTime(tarikh, f.rec.value || '08:00');
    let eta = recAt + (D.tetapan.tempoh[jenis] || 0) * 60000;
    if (it && it.recAt === recAt && it.type === jenis) eta = it.eta;
    const kanon = D.senarai.wad.find((w) => w.toLowerCase() === ward.toLowerCase()) || ward;
    const v = { type: jenis, cat: k ? '' : f.cat.value, prio: k ? 'Biasa' : f.prio.value, ward: kanon, bed: k || neo || iva ? '' : f.bed.value.trim(), ext: k ? f.ext.value.trim() : '',
      npt: k ? Math.max(0, parseInt(f.npt.value, 10) || 0) : 0, ncase: k ? Math.max(0, parseInt(f.ncase.value, 10) || 0) : 0, qstd: qn('qstd'), qnstd: qn('qnstd'), qstr: qn('qstr'),
      desc: k || neo || iva ? '' : dw ? f.descSel.value : f.desc.value.trim(), note: k || neo ? '' : f.note.value.trim(), recAt, eta };
    const rec = it ? { ...JSON.parse(JSON.stringify(it)), ...v } : { id: uid(), date: tarikh, ...v, status: 0, log: [{ s: 0, t: recAt }], del: false };
    if (it) { const l0 = rec.log.find((l) => l.s === 0); if (l0) l0.t = recAt; }
    rec.upd = Date.now();
    tolak({ t: 'p', d: rec });
    if (!D.senarai.wad.some((w) => w.toLowerCase() === ward.toLowerCase())) { D.senarai.wad.push(ward); api('dashboard.tambahWad', { wad: ward }).catch(() => {}); }
    if (lagi) { ['bed', 'desc', 'note', 'npt', 'ncase', 'qstd', 'qnstd', 'qstr'].forEach((n) => (f[n].value = '')); f.descSel.value = ''; f.prio.value = 'Biasa'; if (ui.tarikh === hariIni()) f.rec.value = hm(Date.now()); toast('Disimpan. Sedia untuk preskripsi seterusnya.', 'ok'); }
    else { d.close(); toast(it ? 'Dikemas kini' : 'Preskripsi disimpan', 'ok'); }
  };
  const on = (s, fn) => { const b = $(s, d); if (b) b.onclick = fn; };
  on('[data-ok]', () => simpanP(false));
  on('[data-lagi]', () => simpanP(true));
  on('[data-batal]', () => { const r = { ...JSON.parse(JSON.stringify(it)), status: -1, upd: Date.now() }; tolak({ t: 'p', d: r }); d.close(); toast('Preskripsi dibatalkan'); });
  on('[data-pulih]', () => { const r = JSON.parse(JSON.stringify(it)); r.status = Math.max(0, ...r.log.map((l) => l.s)); r.upd = Date.now(); tolak({ t: 'p', d: r }); d.close(); toast('Preskripsi dipulihkan'); });
  on('[data-padam]', async () => { if (!(await sahkan('Padam preskripsi ini?', { ya: 'Padam', bahaya: true }))) return; tolak({ t: 'p', d: { ...JSON.parse(JSON.stringify(it)), del: true, upd: Date.now() } }); d.close(); toast('Preskripsi dipadam'); });
}

/* ---------- tutup hari ---------- */
export function dialogTutup(senarai, apabila) {
  const d = dialog({
    tajuk: 'Tutup hari', saiz: 'lg',
    badan: senarai.length ? `<p class="small muted" style="margin:0 0 10px">${senarai.length} sediaan belum selesai. Pilih tindakan bagi setiap satu. <b>Sedia Diambil</b> direkod pada masa sekarang (mempengaruhi TAT). <b>Batal</b> jika tidak diteruskan. <b>Kekal</b> untuk dibawa ke hari esok.</p>
      <div class="row" style="margin-bottom:10px;gap:6px"><span class="small muted">Tetapkan semua:</span><button type="button" class="btn sm" data-semua="keep">Kekal</button><button type="button" class="btn sm" data-semua="done">Sedia Diambil</button><button type="button" class="btn sm" data-semua="void">Batal</button></div>
      <div class="db-close">${senarai.map((i) => `<div>${tagJenis(i)}<span><b>${esc(i.ward || '—')}</b> · ${utama(i)}<small>${PERINGKAT[i.status]} · ${i.date === hariIni() ? 'diterima ' + hm(i.recAt) : tarikhR(i.date) + ' ' + hm(i.recAt)}</small></span>
        <select class="in" data-id="${esc(i.id)}"><option value="keep">Kekal</option><option value="done">Sedia Diambil</option><option value="void">Batal</option></select></div>`).join('')}</div>`
      : '<p style="margin:0">Semua sediaan sudah selesai. Tiada apa perlu ditutup.</p>',
    kaki: `<button class="btn" data-tutup>Kembali</button>${senarai.length ? '<button class="btn pri" data-ok>Sahkan</button>' : ''}`
  });
  d.addEventListener('click', (e) => { const b = e.target.closest('[data-semua]'); if (b) $$('select[data-id]', d).forEach((s) => (s.value = b.dataset.semua)); });
  const ok = $('[data-ok]', d);
  if (ok) ok.onclick = (e) => { const k = {}; $$('select[data-id]', d).forEach((s) => (k[s.dataset.id] = s.value)); sibuk(e.currentTarget, async () => { await apabila(k); d.close(); }); };
}
function tutupHari() {
  const kini = hariIni();
  const l = rekod().filter((i) => i.status >= 0 && i.status < AKHIR && i.date <= kini).sort((a, b) => a.recAt - b.recAt);
  dialogTutup(l, async (k) => {
    const now = Date.now(); let dn = 0, vd = 0;
    l.forEach((i) => {
      const x = k[i.id]; if (!x || x === 'keep') return;
      const r = JSON.parse(JSON.stringify(i));
      if (x === 'done') { r.log = r.log.filter((g) => g.s !== AKHIR); r.log.push({ s: AKHIR, t: now }); r.status = AKHIR; dn++; } else { r.status = -1; vd++; }
      r.upd = now; Q = Q.filter((o) => !(o.t === 'p' && o.d.id === r.id)); Q.push({ t: 'p', d: r });
    });
    simpanQ(); lukis(); jadualSync(100);
    if (dn || vd) toast([dn && dn + ' ditanda Sedia Diambil', vd && vd + ' dibatalkan'].filter(Boolean).join(', '), 'ok');
  });
}

/* ---------- eksport hari ---------- */
function excelHari() {
  const A = alat(DD()), L = rekod().filter((i) => i.date === ui.tarikh).sort((a, b) => a.recAt - b.recAt);
  const head = ['Tarikh', 'Jenis', 'Kategori', 'Wad', 'Katil', 'Sediaan', 'Extension', 'Jumlah pesakit', 'Jumlah kes', 'Neonatal STD', 'Neonatal NSTD', 'Starter', 'Keutamaan', 'Status', 'Diterima', 'Penyaringan', 'Dalam Makmal', 'Sedia Diambil', 'TAT (min)', 'Sasaran', 'Dalam sasaran', 'Staf', 'Nota'];
  const rows = L.map((it) => { const t = (s) => (A.stageT(it, s) ? hm(A.stageT(it, s)) : ''), tt = A.tat(it);
    return [it.date, it.type, it.cat, it.ward, it.bed, it.desc, it.ext, it.npt || '', it.ncase || '', it.qstd || '', it.qnstd || '', it.qstr || '', it.prio, it.status < 0 ? 'Dibatalkan' : PERINGKAT[it.status], t(0), t(1), t(2), t(3), tt !== null ? Math.round(tt) : '', A.berkenaan(it) ? hm(A.cutoffMs(it)) : '', it.status === AKHIR && A.berkenaan(it) ? (A.tepat(it) ? 'Ya' : 'Tidak') : '', [...new Set(it.log.map((l) => l.by).filter(Boolean))].join(', '), it.note]; });
  muatTurunXls(`Dashboard-UPAR-${ui.tarikh}`, `Dashboard UPAR — ${tarikhP(ui.tarikh)}`, head, rows);
}
function muatTurunXls(fail, tajukX, head, rows) {
  const td = 'border:1px solid #cbd5e1;font-size:10pt;';
  const html = `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel"><head><meta charset="utf-8"></head><body><table style="border-collapse:collapse;font-family:Arial">
    <tr><td colspan="${head.length}" style="font-size:14pt;font-weight:bold">${esc(tajukX)}</td></tr><tr>${head.map((h) => `<th style="${td}background:#e0e7ff">${esc(h)}</th>`).join('')}</tr>
    ${rows.map((r) => `<tr>${r.map((v) => `<td style="${td}">${esc(v)}</td>`).join('')}</tr>`).join('')}</table></body></html>`;
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob(['﻿' + html], { type: 'application/vnd.ms-excel' }));
  a.download = fail + '.xls'; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/* ---------- laporan ---------- */
const lp = { dari: hariIni().slice(0, 8) + '01', hingga: hariIni(), jenis: '' };
let hasil = null;
function lLaporan(el) {
  el.innerHTML = `<section class="card pad"><div class="row"><label class="row small" style="gap:6px">Dari <input class="in" type="date" id="lD" value="${lp.dari}" style="width:auto"></label>
      <label class="row small" style="gap:6px">Hingga <input class="in" type="date" id="lH" value="${lp.hingga}" style="width:auto"></label>
      <select class="in" id="lJ" style="width:auto"><option value="">Semua jenis</option>${JENIS.map((t) => `<option value="${t}" ${lp.jenis === t ? 'selected' : ''}>${LABEL[t]}</option>`).join('')}</select>
      <div class="chips"><button class="chip" data-p="hari">Hari ini</button><button class="chip" data-p="bulan">Bulan ini</button><button class="chip" data-p="tahun">Tahun ini</button></div>
      <span class="spacer"></span><button class="btn pri" id="lGo">${ic('list')} Jana</button><button class="btn" id="lPr" ${hasil ? '' : 'disabled'}>${ic('print')}</button><button class="btn" id="lXl" ${hasil ? '' : 'disabled'}>${ic('install')}</button></div></section>
    <div id="lOut" style="margin-top:16px">${hasil ? lapHTML(hasil) : ''}</div>`;
  const jana = (e) => sibuk(e && e.currentTarget, async () => { lp.dari = $('#lD', el).value; lp.hingga = $('#lH', el).value; lp.jenis = $('#lJ', el).value; try { hasil = await api('dashboard.laporan', lp); lLaporan(el); } catch (err) { ralat(err); } });
  $('#lGo', el).onclick = jana;
  $$('[data-p]', el).forEach((b) => (b.onclick = () => { const t = hariIni(); lp.hingga = t; lp.dari = b.dataset.p === 'hari' ? t : b.dataset.p === 'bulan' ? t.slice(0, 8) + '01' : t.slice(0, 5) + '01-01'; $('#lD', el).value = lp.dari; $('#lH', el).value = lp.hingga; jana(); }));
  $('#lPr', el).onclick = () => { const c = document.createElement('div'); c.id = 'cetak'; c.innerHTML = `<div class="ct-h"><div><b>Laporan Dashboard UPAR</b><small>${esc(hasil.dari)} hingga ${esc(hasil.hingga)}</small></div></div>${lapHTML(hasil)}`; document.body.appendChild(c); document.body.classList.add('mencetak', 'cetak-tegak'); const h = () => { c.remove(); document.body.classList.remove('mencetak', 'cetak-tegak'); removeEventListener('afterprint', h); }; addEventListener('afterprint', h); setTimeout(() => print(), 50); };
  $('#lXl', el).onclick = () => {
    const r = hasil, rows = [];
    r.jenis.forEach((j) => rows.push(['Jenis', LABEL[j.jenis], j.jumlah, j.siap, j.purataTat ?? '', j.peratus ?? '', j.pesakit, j.kes, j.std, j.nstd, j.starter]));
    r.wad.forEach((w) => rows.push(['Wad', w.wad, w.jumlah, w.TPN, w.IVA, w.KEMO]));
    r.lewat.forEach((x) => rows.push(['Lewat', ...x]));
    muatTurunXls(`Laporan-Dashboard-${r.dari}-${r.hingga}`, `Laporan Dashboard UPAR ${r.dari} hingga ${r.hingga}`, ['Bahagian', 'Nama', 'Jumlah', 'Siap / TPN', 'Purata TAT / IVA', '% sasaran / Kemo', 'Pesakit', 'Kes', 'STD', 'NSTD', 'Starter'], rows);
  };
}
function lapHTML(r) {
  const maxH = Math.max(1, ...r.harian.map((h) => h.TPN + h.IVA + h.KEMO));
  return `<div class="inv-stats" style="margin-bottom:14px"><div class="stat"><b>${r.jumlah}</b><span>Jumlah preskripsi</span></div><div class="stat"><b>${r.purataTat !== null ? fmtDur(r.purataTat) : '—'}</b><span>Purata TAT</span></div><div class="stat ${r.peratusSasaran !== null && r.peratusSasaran < 80 ? 'warn' : 'ok'}"><b>${r.peratusSasaran !== null ? r.peratusSasaran + '%' : '—'}</b><span>Dalam sasaran</span></div><div class="stat ${r.lewat.length ? 'bad' : ''}"><b>${r.lewat.length}</b><span>Lewat sasaran</span></div></div>
    <div class="grid inv-g2" style="margin-top:0">${r.jenis.map((j) => `<section class="card pad db-lj s-${j.jenis.toLowerCase()}"><b>${LABEL[j.jenis]}</b><div class="row" style="gap:18px;margin:8px 0"><span><b style="font-size:22px">${j.jumlah}</b> preskripsi</span><span>TAT <b>${j.purataTat !== null ? fmtDur(j.purataTat) : '—'}</b></span><span><b>${j.peratus !== null ? j.peratus + '%' : '—'}</b> dalam sasaran</span></div>
      ${j.jenis === 'KEMO' ? `<p class="small" style="margin:0"><b>${j.pesakit}</b> pesakit · <b>${j.kes}</b> kes</p>` : ''}${j.jenis === 'TPN' && j.std + j.nstd + j.starter ? `<p class="small" style="margin:0">Neonate: <b>${j.std}</b> STD · <b>${j.nstd}</b> NSTD · <b>${j.starter}</b> Starter</p>` : ''}
      <p class="small muted" style="margin:6px 0 0">${Object.entries(j.kategori).map(([k, n]) => `${esc(k)} ${n}`).join(' · ') || '—'}</p></section>`).join('')}</div>
    ${r.harian.length > 1 ? `<section class="card pad" style="margin-top:16px"><b>Preskripsi harian</b><div class="db-hc">${r.harian.map((h) => `<div title="${esc(h.tarikh)}: TPN ${h.TPN}, IVA ${h.IVA}, Kemo ${h.KEMO}"><span style="height:${(h.KEMO / maxH) * 100}%" class="k"></span><span style="height:${(h.IVA / maxH) * 100}%" class="i"></span><span style="height:${(h.TPN / maxH) * 100}%" class="t"></span></div>`).join('')}</div>
      <div class="row small" style="gap:14px"><span><i class="pk-dot" style="--c:var(--db-tpn)"></i> TPN</span><span><i class="pk-dot" style="--c:var(--db-iva)"></i> IVA</span><span><i class="pk-dot" style="--c:var(--db-kemo)"></i> Kemo</span></div></section>` : ''}
    <div class="grid inv-g2"><section class="card"><div class="inv-h"><b>Ikut wad</b></div><table class="tbl"><thead><tr><th>Wad</th><th style="text-align:right">TPN</th><th style="text-align:right">IVA</th><th style="text-align:right">Kemo</th><th style="text-align:right">Jumlah</th></tr></thead><tbody>${r.wad.map((w) => `<tr><td>${esc(w.wad)}</td><td style="text-align:right">${w.TPN}</td><td style="text-align:right">${w.IVA}</td><td style="text-align:right">${w.KEMO}</td><td style="text-align:right"><b>${w.jumlah}</b></td></tr>`).join('') || '<tr><td colspan="5" class="muted">Tiada data.</td></tr>'}</tbody></table></section>
      <section class="card"><div class="inv-h"><b>Lewat sasaran</b><span class="badge bad">${r.lewat.length}</span></div><table class="tbl"><thead><tr><th>Tarikh</th><th>Jenis</th><th>Wad</th><th style="text-align:right">TAT</th></tr></thead><tbody>${r.lewat.map((x) => `<tr><td class="small">${esc(x[0])}</td><td>${esc(LABEL[x[1]] || x[1])}${x[2] ? ' · ' + esc(x[2]) : ''}</td><td>${esc(x[3])}</td><td style="text-align:right">${fmtDur(x[4])}</td></tr>`).join('') || '<tr><td colspan="4" class="muted">Tiada.</td></tr>'}</tbody></table></section></div>`;
}

/* ---------- urus wad (ADMIN) ---------- */
function urusWad() {
  const W = D.senarai.wad, opt = W.map((w) => `<option>${esc(w)}</option>`).join('');
  const d = dialog({ tajuk: 'Urus nama wad', saiz: 'sm',
    badan: `<p class="small muted" style="margin:0 0 12px">Satukan nama wad yang sama (cth "3S" → "3 Selatan"). Semua preskripsi dengan nama lama dikemas kini dan nama lama dibuang daripada senarai.</p>
      <label class="field"><span>Nama lama</span><select class="in" id="wD">${opt}</select></label>
      <label class="field"><span>Gantikan dengan</span><input class="in" id="wK" list="dlW2" placeholder="Pilih atau taip nama rasmi"><datalist id="dlW2">${W.map((w) => `<option value="${esc(w)}">`).join('')}</datalist></label>
      <p class="small muted" style="margin:0">Senarai penuh wad juga boleh diedit dalam Admin → Senarai Rujukan → DASH_WAD.</p>`,
    kaki: '<button class="btn" data-tutup>Tutup</button><button class="btn pri" data-ok>Satukan</button>' });
  $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
    const dari = $('#wD', d).value, ke = $('#wK', d).value.trim();
    if (!ke || ke === dari) return toast('Pilih nama baharu yang berbeza', 'bad');
    try { const r = await api('dashboard.satukanWad', { dari, ke }); toast(`${r.dikemaskini} preskripsi dikemas kini`, 'ok'); d.close(); await sync(); } catch (err) { ralat(err); }
  });
}
