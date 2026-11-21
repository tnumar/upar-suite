// Panel Admin: semua tetapan boleh diubah tanpa kod.
import { S, tajuk, segarBoot } from '../app.js';
import { api, kemasCache, lupaCache } from '../api.js';
import { $, $$, esc, toast, ralat, sibuk, dialog, sahkan, salin, debounce, masaRingkas } from '../ui.js';
import { ic } from '../icons.js';
import { seni } from '../art.js';
import { SENARIO, KUMPULAN } from '../uat-senario.js';

const TAB = [
  { k: 'staf', nama: 'Pengguna & Peranan', ic: 'users' },
  { k: 'jenama', nama: 'Jenama', ic: 'palette' },
  { k: 'tetapan', nama: 'Tetapan', ic: 'cog' },
  { k: 'senarai', nama: 'Senarai Rujukan', ic: 'list' },
  { k: 'kodpergerakan', nama: 'Kod Pergerakan & Cuti Umum', ic: 'calendar' },
  { k: 'motivasi', nama: 'Kata Motivasi', ic: 'quote' },
  { k: 'templat', nama: 'Templat Emel', ic: 'mail' },
  { k: 'peranti', nama: 'Peranti Kiosk', ic: 'tv' },
  { k: 'audit', nama: 'Log Audit', ic: 'log' },
  { k: 'migrasi', nama: 'Sandaran & Migrasi', ic: 'db' },
  { k: 'uat', nama: 'Keputusan UAT', ic: 'check' }
];
const MODUL = [
  ['suite', 'Admin Suite', ['ADMIN']], ['formulari', 'Formulari', ['EDITOR', 'PEMBACA']], ['bukuoff', 'Buku Off', ['ADMIN', 'PENYELIA', 'STAF']],
  ['inventori', 'Inventori', ['ADMIN', 'PENGURUS', 'STAF', 'PEMBACA']], ['dashboard', 'Dashboard', ['ADMIN', 'STAF', 'PEMBACA']], ['guttae', 'Guttae', ['ADMIN', 'STAF', 'PEMBACA']],
  ['pergerakan', 'Pergerakan Staf', ['ADMIN', 'PENYELIA', 'STAF']]
];
const pasukanList = () => (S.boot && S.boot.senarai && S.boot.senarai.pasukan) || [];
const labelPasukan = (v) => (pasukanList().find((p) => p.nilai === v) || { label: v }).label;
const JENAMA = ['NAMA_APP', 'SUBJUDUL', 'NAMA_JABATAN', 'WARNA_UTAMA', 'LOGO_URL'];

export async function papar(page, rest) {
  tajuk('Admin');
  const k = TAB.find((t) => t.k === rest[0]) ? rest[0] : 'staf';
  page.innerHTML = `<div class="admin-nav chips">${TAB.map((t) => `<a class="chip ${t.k === k ? 'on' : ''}" href="#/admin/${t.k}" style="display:inline-flex;align-items:center;gap:6px">${esc(t.nama)}</a>`).join('')}</div><div id="adm"></div>`;
  const el = $('#adm', page);
  el.innerHTML = '<div class="skel" style="height:240px"></div>';
  if (k === 'kodpergerakan') { location.hash = '#/pergerakan/urus'; return; }
  try { await ({ staf, jenama, tetapan, senarai, motivasi, templat, peranti, audit, migrasi, uat })[k](el); }
  catch (e) { el.innerHTML = `<div class="empty">${ic('alert')}<p>${esc(e.message)}</p></div>`; }
}

/* ================= Pengguna & Peranan ================= */
async function staf(el) {
  let list = await api('admin.staf', {}, { cache: true });
  const lukis = () => {
    const q = ($('#qs', el) || {}).value || '';
    const t = q.toLowerCase();
    const rows = list.filter((u) => !t || [u.stafId, u.nama, u.emel, u.jawatan, ...(u.pasukan || []).map(labelPasukan)].join(' ').toLowerCase().includes(t));
    $('#tb', el).innerHTML = rows.map((u) => `<tr class="click" data-id="${esc(u.stafId)}">
      <td><b>${esc(u.nama)}</b><div class="small muted">${esc(u.stafId)}${u.jawatan ? ' · ' + esc(u.jawatan) : ''}</div>${(u.pasukan || []).map((p) => `<span class="badge grey" style="margin:4px 4px 0 0">${esc(labelPasukan(p))}</span>`).join('')}</td>
      <td class="small">${esc(u.emel) || '<span class="muted">—</span>'}</td>
      <td>${MODUL.filter(([m]) => u.peranan[m]).map(([m, n]) => `<span class="badge ${m === 'suite' ? 'bad' : ''}" style="margin:0 4px 4px 0">${esc(n)}: ${esc(u.peranan[m])}</span>`).join('') || '<span class="muted small">Tiada</span>'}</td>
      <td>${u.aktif ? '<span class="badge ok">Aktif</span>' : '<span class="badge grey">Tidak aktif</span>'}${u.tukarPin ? ' <span class="badge warn">PIN sementara</span>' : ''}</td>
      <td class="small muted">${esc(masaRingkas(u.logMasukAkhir)) || 'Belum'}</td></tr>`).join('');
    $('#cnt', el).textContent = rows.length + ' / ' + list.length + ' staf';
  };
  el.innerHTML = `<div class="row" style="margin-bottom:12px"><div class="search" style="flex:1;min-width:220px">${ic('search')}<input class="in" id="qs" type="search" placeholder="Cari nama, ID, emel"></div>
    <button class="btn pri" id="bTambah">${ic('plus')} Staf baharu</button></div>
    <p class="small muted" id="cnt" style="margin:0 0 8px"></p>
    <div class="card scroll-x"><table class="tbl"><thead><tr><th>Staf</th><th>Emel</th><th>Peranan</th><th>Status</th><th>Log masuk akhir</th></tr></thead><tbody id="tb"></tbody></table></div>`;
  lukis();
  $('#qs', el).oninput = debounce(lukis, 120);
  $('#bTambah', el).onclick = () => borang(null);
  $('#tb', el).onclick = (e) => { const r = e.target.closest('[data-id]'); if (r) borang(list.find((u) => u.stafId === r.dataset.id)); };

  function borang(u) {
    const baru = !u; u = u || { stafId: '', nama: '', emel: '', jawatan: '', unit: 'UPAR', aktif: true, penyeliaId: '', peranan: { formulari: 'PEMBACA', bukuoff: 'STAF', pergerakan: 'STAF' }, pasukan: [] };
    const pen = list.filter((x) => x.aktif && x.stafId !== u.stafId && ['ADMIN', 'PENYELIA'].includes(x.peranan.bukuoff));
    const d = dialog({
      tajuk: baru ? 'Staf baharu' : u.nama, saiz: 'lg',
      badan: `<form id="fs" autocomplete="off"><div class="grid g2" style="gap:0 14px">
        <label class="field"><span>ID staf *</span><input class="in" name="stafId" value="${esc(u.stafId)}" required placeholder="cth 0209/07" ${baru ? '' : 'readonly style="background:var(--surface-2);color:var(--muted)"'}>${baru ? '<small>ID tidak boleh diubah selepas disimpan.</small>' : ''}</label>
        <label class="field"><span>Nama penuh *</span><input class="in" name="nama" value="${esc(u.nama)}" required></label>
        <label class="field"><span>Emel</span><input class="in" name="emel" type="email" value="${esc(u.emel)}"><small>PIN & notifikasi dihantar ke emel ini.</small></label>
        <label class="field"><span>Jawatan</span><input class="in" name="jawatan" value="${esc(u.jawatan)}"></label>
        <label class="field"><span>Unit</span><input class="in" name="unit" value="${esc(u.unit)}"></label>
        <label class="field"><span>Penyelia (Buku Off)</span><select class="in" name="penyeliaId"><option value="">— Tiada —</option>${pen.map((p) => `<option value="${esc(p.stafId)}" ${p.stafId === u.penyeliaId ? 'selected' : ''}>${esc(p.nama)}</option>`).join('')}</select></label>
      </div>
      <div class="field"><span>Pasukan</span><div class="chips" style="flex-wrap:wrap">${pasukanList().map((p) => `<label class="chip ${(u.pasukan || []).includes(p.nilai) ? 'on' : ''}" style="display:inline-flex;align-items:center;gap:6px"><input type="checkbox" data-pk value="${esc(p.nilai)}" ${(u.pasukan || []).includes(p.nilai) ? 'checked' : ''} style="display:none">${esc(p.label)}</label>`).join('') || '<span class="small muted">Tiada pasukan. Tambah dalam Senarai Rujukan → PASUKAN.</span>'}</div>
        <small>Untuk penapis pasukan dalam Pergerakan Staf. Boleh pilih lebih daripada satu.</small></div>
      <div class="h5">Peranan bagi setiap modul</div>
      <div class="role-grid">${MODUL.map(([m, n, rs]) => `<label class="field" style="margin:0"><span>${esc(n)}</span><select class="in" data-r="${m}"><option value="">Tiada akses</option>${rs.map((r) => `<option ${u.peranan[m] === r ? 'selected' : ''}>${r}</option>`).join('')}</select></label>`).join('')}</div>
      <div style="margin-top:18px"><label class="switch"><input type="checkbox" name="aktif" ${u.aktif ? 'checked' : ''}> Akaun aktif</label></div>
      </form>`,
      kaki: `${baru ? '' : `<button class="btn" data-reset>${ic('key')} Reset PIN</button><span class="spacer"></span>`}<button class="btn" data-tutup>Batal</button><button class="btn pri" data-simpan>Simpan</button>`
    });
    const f = $('#fs', d);
    $$('[data-pk]', d).forEach((c) => (c.onchange = () => c.parentElement.classList.toggle('on', c.checked)));
    $('[data-simpan]', d).onclick = (e) => sibuk(e.currentTarget, async () => {
      const peranan = {}; $$('[data-r]', d).forEach((s) => (peranan[s.dataset.r] = s.value));
      try {
        lupaCache('admin.staf'); const r = await api('admin.staf.simpan', { stafIdLama: baru ? '' : u.stafId, stafId: f.stafId.value.trim(), nama: f.nama.value.trim(), emel: f.emel.value.trim(), jawatan: f.jawatan.value.trim(), unit: f.unit.value.trim(), penyeliaId: f.penyeliaId.value, aktif: f.aktif.checked, peranan, pasukan: $$('[data-pk]', d).filter((c) => c.checked).map((c) => c.value) });
        list = r.staf; lukis(); d.close(); toast('Disimpan', 'ok');
        if (r.pin) tunjukPin(f.nama.value, f.stafId.value, r.pin, r.emelDihantar);
        if (!baru && u.stafId === S.me.stafId) segarBoot();
      } catch (err) { ralat(err); }
    });
    const rs = $('[data-reset]', d);
    if (rs) rs.onclick = async (e) => {
      const b = e.currentTarget;
      if (!(await sahkan(`Reset PIN ${u.nama}? Semua sesi log masuk staf ini akan ditamatkan.`, { ya: 'Reset PIN' }))) return;
      sibuk(b, async () => { try { const r = await api('admin.staf.resetPin', { stafId: u.stafId }); d.close(); tunjukPin(u.nama, u.stafId, r.pin, r.emelDihantar); list = await api('admin.staf'); kemasCache('admin.staf', {}, list); lukis(); } catch (err) { ralat(err); } });
    };
  }
}

function tunjukPin(nama, id, pin, emel) {
  const link = location.origin + location.pathname;
  const mesej = `Salam ${nama},\n\nAkaun UPAR Suite anda:\nPautan: ${link}\nID: ${id}\nPIN sementara: ${pin}\n\nSila tukar PIN selepas log masuk pertama.`;
  const d = dialog({
    tajuk: 'PIN sementara', saiz: 'sm',
    badan: `<p style="margin:0">${esc(nama)} (${esc(id)})</p><div class="pin-show">${esc(pin)}</div>
      <p class="small ${emel ? '' : 'muted'}" style="margin:0">${emel ? '✓ PIN telah dihantar ke emel staf.' : 'Emel tidak dihantar. Salin mesej dan hantar kepada staf secara peribadi.'}</p>`,
    kaki: `<button class="btn" data-salin>${ic('copy')} Salin mesej</button><button class="btn pri" data-tutup>Selesai</button>`
  });
  $('[data-salin]', d).onclick = () => salin(mesej, 'Mesej disalin');
}

/* ================= Jenama & Tetapan ================= */
async function borangTetapan(el, tapis, tajukBahagian, selepas) {
  const rows = (await api('admin.tetapan', {}, { cache: true })).filter(tapis);
  el.innerHTML = `<form class="card pad" id="ft" style="max-width:820px"><h3 style="margin:0 0 16px;font-size:16px">${esc(tajukBahagian)}</h3>
    ${rows.map((r) => `<label class="field"><span>${esc(r.kunci)}${r.modul ? ` <span class="badge grey">${esc(r.modul)}</span>` : ''}</span>
      ${r.kunci === 'WARNA_UTAMA' ? `<div class="row"><input type="color" name="${esc(r.kunci)}_c" value="${esc(r.nilai || '#4f46e5')}" style="width:52px;height:42px;border:0;background:none"><input class="in" style="flex:1" name="${esc(r.kunci)}" value="${esc(r.nilai)}"></div>`
        : /_SYARAT$/.test(r.kunci) ? `<textarea class="in" name="${esc(r.kunci)}" rows="4">${esc(r.nilai)}</textarea>`
        : r.kunci === 'INV_KAEDAH_PARAS' ? `<select class="in" name="${esc(r.kunci)}">${['AUTO', 'MANUAL'].map((v) => `<option ${r.nilai === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`
        : r.kunci === 'BUKUOFF_NOTIFIKASI' ? `<select class="in" name="${esc(r.kunci)}">${['AUTO', 'MANUAL'].map((v) => `<option ${r.nilai === v ? 'selected' : ''}>${v}</option>`).join('')}</select>`
        : /^(YA|TIDAK)$/.test(r.nilai) ? `<select class="in" name="${esc(r.kunci)}"><option ${r.nilai === 'YA' ? 'selected' : ''}>YA</option><option ${r.nilai === 'TIDAK' ? 'selected' : ''}>TIDAK</option></select>`
        : `<input class="in" name="${esc(r.kunci)}" value="${esc(r.nilai)}">`}
      <small>${esc(r.keterangan)}</small></label>`).join('')}
    ${tajukBahagian === 'Jenama' ? `<div class="field"><span>Pratonton logo</span><img id="pv" src="${esc(rows.find((r) => r.kunci === 'LOGO_URL').nilai || 'assets/logo.svg')}" style="width:72px;height:72px;border-radius:18px" alt=""></div>` : ''}
    <button class="btn pri" type="submit">Simpan</button></form>`;
  const f = $('#ft', el);
  f.addEventListener('input', (e) => {
    if (e.target.type === 'color') f.elements[e.target.name.replace(/_c$/, '')].value = e.target.value;
    if (e.target.name === 'LOGO_URL' && $('#pv', el)) $('#pv', el).src = e.target.value || 'assets/logo.svg';
  });
  f.onsubmit = (e) => {
    e.preventDefault();
    const nilai = {}; rows.forEach((r) => (nilai[r.kunci] = f.elements[r.kunci].value.trim()));
    sibuk(f.querySelector('[type=submit]'), async () => { try { await api('admin.tetapan.simpan', { nilai }); lupaCache('admin.tetapan'); toast('Tetapan disimpan', 'ok'); selepas && selepas(); } catch (err) { ralat(err); } });
  };
}
const jenama = (el) => borangTetapan(el, (r) => JENAMA.includes(r.kunci), 'Jenama', async () => { await segarBoot(); location.reload(); });
const tetapan = (el) => borangTetapan(el, (r) => !JENAMA.includes(r.kunci), 'Tetapan sistem');

/* ================= Senarai Rujukan ================= */
async function senarai(el) {
  const rows = await api('admin.senarai', {}, { cache: true });
  const nama = [...new Set(rows.map((r) => r.senarai))].sort();
  el.innerHTML = `<p class="muted small" style="margin:0 0 12px">Senarai pilihan (dropdown) yang digunakan dalam modul. Ubah label, susunan atau nyahaktif item tanpa kod.
      <b>PASUKAN</b> = tag pasukan staf (Pergerakan Staf). Kod pergerakan &amp; cuti umum diurus dalam <a href="#/pergerakan/urus">Pergerakan Staf → Urus kod &amp; cuti umum</a>.</p>
    <div class="grid g2" style="align-items:start">${nama.map((n) => {
      const it = rows.filter((r) => r.senarai === n).sort((a, b) => a.susunan - b.susunan);
      return `<form class="card pad" data-s="${esc(n)}"><div class="row" style="margin-bottom:10px"><b>${esc(n)}</b></div>
        <div data-items>${it.map(barisSenarai).join('')}</div>
        <div class="row" style="margin-top:8px"><button type="button" class="btn sm" data-add>${ic('plus')} Item</button><span class="spacer"></span><button class="btn pri sm" type="submit">Simpan</button></div></form>`;
    }).join('')}</div>`;
  el.addEventListener('click', (e) => {
    if (e.target.closest('[data-add]')) e.target.closest('form').querySelector('[data-items]').insertAdjacentHTML('beforeend', barisSenarai({ nilai: '', label: '', aktif: true }));
    const up = e.target.closest('[data-up]'); if (up) { const r = up.closest('.ed-ing'); if (r.previousElementSibling) r.parentNode.insertBefore(r, r.previousElementSibling); }
  });
  el.addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    const item = $$('.ed-ing', f).map((r) => ({ nilai: $('[data-f=n]', r).value.trim(), label: $('[data-f=l]', r).value.trim(), aktif: $('[data-f=a]', r).checked })).filter((x) => x.nilai);
    sibuk(f.querySelector('[type=submit]'), async () => { try { await api('admin.senarai.simpan', { senarai: f.dataset.s, item }); lupaCache('admin.senarai'); toast('Disimpan', 'ok'); segarBoot(); } catch (err) { ralat(err); } });
  });
}
const barisSenarai = (r) => `<div class="ed-ing" style="grid-template-columns:1fr 1.4fr auto 36px"><input class="in" data-f="n" value="${esc(r.nilai)}" placeholder="Nilai"><input class="in" data-f="l" value="${esc(r.label)}" placeholder="Label paparan">
  <label class="switch" title="Aktif"><input type="checkbox" data-f="a" ${r.aktif ? 'checked' : ''}></label><button type="button" class="btn ghost icon" data-up aria-label="Naikkan">↑</button></div>`;

/* ================= Kata Motivasi ================= */
async function motivasi(el) {
  let rows = await api('admin.motivasi', {}, { cache: true });
  const lukis = () => {
    el.innerHTML = `<div class="row" style="margin-bottom:12px"><p class="muted small" style="margin:0;flex:1">${rows.filter((r) => r.aktif).length} kata aktif. Satu kata dipaparkan setiap hari (sama untuk semua staf). Imej kosong = ilustrasi terbina.</p>
      <button class="btn" id="bAdd">${ic('plus')} Kata baharu</button><button class="btn pri" id="bSave">Simpan semua</button></div>
      <div class="card scroll-x"><table class="tbl"><thead><tr><th style="width:90px">Imej</th><th>Kata</th><th style="width:80px">Bahasa</th><th>Sumber</th><th>URL imej</th><th>Aktif</th><th></th></tr></thead>
      <tbody>${rows.map((r, i) => `<tr data-i="${i}"><td><div style="width:80px;height:44px;border-radius:8px;overflow:hidden">${r.imej ? `<img src="${esc(r.imej)}" style="width:100%;height:100%;object-fit:cover" alt="">` : seni(i)}</div></td>
        <td><textarea class="in" data-f="teks" rows="2" style="min-height:44px;min-width:240px">${esc(r.teks)}</textarea></td>
        <td><select class="in" data-f="bahasa"><option ${r.bahasa === 'BM' ? 'selected' : ''}>BM</option><option ${r.bahasa === 'BI' ? 'selected' : ''}>BI</option></select></td>
        <td><input class="in" data-f="sumber" value="${esc(r.sumber)}" style="min-width:120px"></td>
        <td><input class="in" data-f="imej" value="${esc(r.imej)}" placeholder="https://..." style="min-width:140px"></td>
        <td><label class="switch"><input type="checkbox" data-f="aktif" ${r.aktif ? 'checked' : ''}></label></td>
        <td><button class="btn ghost icon" data-del aria-label="Padam">${ic('trash')}</button></td></tr>`).join('')}</tbody></table></div>`;
    $('#bAdd', el).onclick = () => { baca(); rows.unshift({ id: '', teks: '', bahasa: 'BM', sumber: '', imej: '', aktif: true }); lukis(); };
    $('#bSave', el).onclick = (e) => sibuk(e.currentTarget, async () => { baca(); try { rows = await api('admin.motivasi.simpan', { item: rows.filter((r) => r.teks.trim()) }); lupaCache('admin.motivasi'); toast('Disimpan', 'ok'); lukis(); } catch (err) { ralat(err); } });
    el.querySelector('tbody').onclick = (e) => { const b = e.target.closest('[data-del]'); if (b) { baca(); rows.splice(Number(b.closest('tr').dataset.i), 1); lukis(); } };
  };
  const baca = () => $$('tr[data-i]', el).forEach((tr) => {
    const r = rows[Number(tr.dataset.i)];
    r.teks = $('[data-f=teks]', tr).value; r.bahasa = $('[data-f=bahasa]', tr).value; r.sumber = $('[data-f=sumber]', tr).value; r.imej = $('[data-f=imej]', tr).value.trim(); r.aktif = $('[data-f=aktif]', tr).checked;
  });
  lukis();
}

/* ================= Templat Emel ================= */
async function templat(el) {
  const rows = await api('admin.templat', {}, { cache: true });
  el.innerHTML = rows.map((t) => `<form class="card pad" data-k="${esc(t.kunci)}" style="max-width:820px;margin-bottom:14px">
    <div class="row" style="margin-bottom:10px"><b>${esc(t.kunci)}</b></div><p class="small muted" style="margin:0 0 12px">${esc(t.keterangan)}</p>
    <label class="field"><span>Subjek</span><input class="in" name="subjek" value="${esc(t.subjek)}"></label>
    <label class="field"><span>Badan</span><textarea class="in" name="badan" rows="8">${esc(t.badan)}</textarea></label>
    <button class="btn pri" type="submit">Simpan</button></form>`).join('');
  el.addEventListener('submit', (e) => {
    e.preventDefault(); const f = e.target;
    sibuk(f.querySelector('[type=submit]'), async () => { try { await api('admin.templat.simpan', { kunci: f.dataset.k, subjek: f.subjek.value, badan: f.badan.value }); lupaCache('admin.templat'); toast('Disimpan', 'ok'); } catch (err) { ralat(err); } });
  });
}

/* ================= Peranti Kiosk ================= */
async function peranti(el) {
  let L = await api('admin.peranti', {}, { cache: true });
  const pautan = (tok) => location.origin + location.pathname + '#/kiosk/' + tok;
  const tunjuk = (nama, tok) => {
    const url = pautan(tok);
    const d = dialog({ tajuk: 'Pautan peranti: ' + nama, saiz: 'sm',
      badan: `<p class="small" style="margin:0 0 10px">Buka pautan ini <b>sekali</b> pada pelayar TV / PC kiosk. Peranti akan diingati dan memaparkan Dashboard dalam mod TV (baca sahaja). Pautan hanya dipaparkan sekarang — simpan dengan selamat.</p>
        <div class="code" style="white-space:normal;word-break:break-all;cursor:text">${esc(url)}</div>`,
      kaki: `<button class="btn" data-salin>${ic('copy')} Salin pautan</button><button class="btn pri" data-tutup>Selesai</button>` });
    $('[data-salin]', d).onclick = () => salin(url, 'Pautan disalin');
  };
  const lukis = () => {
    el.innerHTML = `<div class="row" style="margin-bottom:12px"><p class="muted small" style="margin:0;flex:1">Skrin TV / kiosk memaparkan Dashboard (papan, ringkasan wad, guttae) secara baca sahaja dengan butang "Mula hari baru". Batalkan peranti yang hilang atau tidak digunakan.</p>
      <button class="btn pri" id="pBaru">${ic('plus')} Daftar peranti</button></div>
      <div class="card scroll-x"><table class="tbl"><thead><tr><th>Peranti</th><th>Didaftar</th><th>Aktif terakhir</th><th>Status</th><th></th></tr></thead><tbody>
      ${L.map((p) => `<tr><td><b>${esc(p.nama)}</b><div class="small muted">${esc(p.id)}</div></td><td class="small">${esc(p.oleh)}<div class="muted">${esc(masaRingkas(p.pada))}</div></td><td class="small">${esc(masaRingkas(p.aktif)) || 'Belum'}</td>
        <td>${p.sah ? '<span class="badge ok">Aktif</span>' : '<span class="badge grey">Dibatalkan</span>'}</td>
        <td style="white-space:nowrap"><button class="btn sm" data-token="${esc(p.id)}">${ic('key')} Pautan baharu</button>${p.sah ? ` <button class="btn sm bad" data-batal="${esc(p.id)}">Batalkan</button>` : ''}</td></tr>`).join('') || '<tr><td colspan="5" class="muted">Belum ada peranti didaftar.</td></tr>'}</tbody></table></div>`;
    $('#pBaru', el).onclick = () => {
      const d = dialog({ tajuk: 'Daftar peranti kiosk', saiz: 'sm', badan: '<label class="field" style="margin:0"><span>Nama peranti</span><input class="in" id="pn" placeholder="cth TV Unit UPAR"></label>', kaki: '<button class="btn" data-tutup>Batal</button><button class="btn pri" data-ok>Daftar</button>' });
      $('[data-ok]', d).onclick = (e) => sibuk(e.currentTarget, async () => { try { const r = await (lupaCache('admin.peranti'), api)('admin.peranti.simpan', { nama: $('#pn', d).value.trim() }); L = r.senarai; d.close(); lukis(); tunjuk($('#pn', d).value.trim(), r.token); } catch (err) { ralat(err); } });
    };
    el.onclick = async (e) => {
      const t = e.target.closest('[data-token]'), b = e.target.closest('[data-batal]');
      if (t) { if (!(await sahkan('Jana pautan baharu? Pautan lama tidak lagi berfungsi.', { ya: 'Jana' }))) return; try { const r = await (lupaCache('admin.peranti'), api)('admin.peranti.simpan', { id: t.dataset.token, tokenBaru: true }); L = r.senarai; lukis(); tunjuk(L.find((x) => x.id === t.dataset.token).nama, r.token); } catch (err) { ralat(err); } }
      if (b) { if (!(await sahkan('Batalkan peranti ini? Skrin akan berhenti memaparkan Dashboard.', { ya: 'Batalkan', bahaya: true }))) return; try { L = (await (lupaCache('admin.peranti'), api)('admin.peranti.simpan', { id: b.dataset.batal, aktif: false })).senarai; lukis(); } catch (err) { ralat(err); } }
    };
  };
  lukis();
}

/* ================= Log Audit ================= */
async function audit(el) {
  let hal = 0;
  el.innerHTML = `<div class="row" style="margin-bottom:12px"><div class="search" style="flex:1;min-width:220px">${ic('search')}<input class="in" id="qa" type="search" placeholder="Cari staf, tindakan, rekod"></div>
    <select class="in" id="ma" style="width:auto"><option value="">Semua modul</option>${MODUL.map(([m, n]) => `<option value="${m}">${esc(n)}</option>`).join('')}</select></div>
    <div class="card scroll-x"><table class="tbl"><thead><tr><th>Masa</th><th>Staf</th><th>Modul</th><th>Tindakan</th><th>Rekod</th><th>Ringkasan</th></tr></thead><tbody id="ta"></tbody></table></div>
    <div class="row" style="margin-top:12px"><span class="small muted" id="ca"></span><span class="spacer"></span><button class="btn sm" id="pv">‹ Baru</button><button class="btn sm" id="nx">Lama ›</button></div>`;
  const muat = async () => {
    $('#ta', el).innerHTML = '<tr><td colspan="6"><div class="skel" style="height:80px"></div></td></tr>';
    try {
      const r = await api('admin.audit', { halaman: hal, cari: $('#qa', el).value, modul: $('#ma', el).value });
      $('#ta', el).innerHTML = r.rows.map((x) => `<tr><td class="small" style="white-space:nowrap">${esc(masaRingkas(x.masa))}</td><td><b class="small">${esc(x.nama)}</b><div class="small muted">${esc(x.stafId)}</div></td>
        <td><span class="badge grey">${esc(x.modul)}</span></td><td class="small"><b>${esc(x.tindakan)}</b></td><td class="small">${esc(x.jenis)} ${esc(x.id)}</td><td class="small">${esc(x.ringkasan)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">Tiada rekod.</td></tr>';
      $('#ca', el).textContent = `${r.jumlah} rekod · halaman ${hal + 1} / ${Math.max(1, Math.ceil(r.jumlah / 100))}`;
      $('#pv', el).disabled = hal === 0; $('#nx', el).disabled = (hal + 1) * 100 >= r.jumlah;
    } catch (e) { ralat(e); }
  };
  $('#qa', el).oninput = debounce(() => { hal = 0; muat(); }, 300);
  $('#ma', el).onchange = () => { hal = 0; muat(); };
  $('#pv', el).onclick = () => { hal = Math.max(0, hal - 1); muat(); };
  $('#nx', el).onclick = () => { hal++; muat(); };
  muat();
}

/* ================= Sandaran & Migrasi ================= */
async function migrasi(el) {
  el.innerHTML = `<div class="grid g2" style="align-items:start">
    <form class="card pad" id="fm"><h3 style="margin:0 0 6px;font-size:16px">Migrasi daripada app lama</h3>
      <p class="small muted" style="margin:0 0 14px">Akaun backend perlu akses Viewer kepada Sheet lama. Jalankan <b>Staf</b> dahulu, kemudian <b>Rekod Buku Off</b>. Boleh dijalankan berulang kali tanpa pendua (dipadankan ikut ID).</p>
      <label class="field"><span>Data</span><select class="in" name="sumber">
        <option value="staf">Staf, penyelia &amp; PIN (Sheet Buku Off → helaian Staf)</option>
        <option value="bukuoff">Rekod Buku Off &amp; tetapan (Sheet Buku Off → helaian Rekod)</option>
        <option value="inventori">Inventori: item, penerimaan &amp; pengeluaran (Sheet UPAR Smart Inventory)</option>
        <option value="dashboard">Dashboard: preskripsi, tetapan &amp; stok guttae (Sheet Dashboard UPAR → helaian Data)</option></select></label>
      <label class="field"><span>URL / ID Google Sheet</span><input class="in" name="sheet" required placeholder="https://docs.google.com/spreadsheets/d/..."></label>
      <div class="row"><button class="btn" type="submit" data-m="0">Larian percubaan</button><button class="btn pri" type="submit" data-m="1">Jalankan migrasi</button></div>
      <div id="lap" style="margin-top:14px"></div></form>
    <div class="card pad"><h3 style="margin:0 0 6px;font-size:16px">Modul lain</h3>
      <p class="small muted" style="margin:0">Semua modul boleh dimigrasi daripada borang di sebelah. Formulari telah dibawa masuk semasa pemasangan.</p>
      <h3 style="margin:20px 0 6px;font-size:16px">Sandaran</h3>
      <p class="small muted" style="margin:0">Semua data disimpan dalam Google Sheets (folder "UPAR Suite – Data") dan disandarkan oleh Google Drive. Untuk salinan Excel: buka Sheet → Fail → Muat turun → .xlsx.</p></div></div>`;
  let mod = '0';
  $('#fm', el).addEventListener('click', (e) => { const b = e.target.closest('[data-m]'); if (b) mod = b.dataset.m; });
  $('#fm', el).onsubmit = async (e) => {
    e.preventDefault();
    const jalan = mod === '1';
    const sumber = e.target.sumber.value;
    const mesejJalan = { staf: 'Jalankan migrasi staf sekarang? Data staf dalam suite akan dikemas kini.', bukuoff: 'Jalankan migrasi rekod Buku Off sekarang? Rekod dengan ID yang sama akan diganti dengan data Sheet lama.',
      dashboard: 'Jalankan migrasi Dashboard sekarang? Preskripsi, tetapan dan stok guttae aktif akan dibawa (rekod dengan ID sama diganti).',
      inventori: 'Jalankan migrasi Inventori sekarang? SEMUA item & transaksi Inventori dalam suite akan diganti dengan data Sheet lama (kategori & Kod Hospital item sedia ada dikekalkan).' };
    if (jalan && !(await sahkan(mesejJalan[sumber], { ya: 'Jalankan' }))) return;
    const b = e.target.querySelector(`[data-m="${mod}"]`);
    sibuk(b, async () => {
      try {
        const r = await api('admin.migrasi', { sumber, sheetId: e.target.sheet.value, jalan });
        const ring = r.ringkasan || [['Jumlah staf', r.jumlah], ['Baharu', r.baru], ['Dikemas kini', r.kemaskini], ['Admin Suite', (r.adminSuite || []).join(', ') || '—']];
        $('#lap', el).innerHTML = `<div class="${jalan ? 'note-box' : 'card pad'}" style="${jalan ? 'background:var(--ok-soft);color:var(--ok);border-color:transparent' : 'box-shadow:none'}">
          <b>${jalan ? '✓ Migrasi selesai' : 'Laporan percubaan (tiada data ditulis)'}</b> — ${esc(r.sumber)}
          <ul style="margin:8px 0 0;padding-left:18px">${ring.map(([k, v]) => `<li>${esc(k)}: <b>${esc(v)}</b></li>`).join('')}</ul>
          ${r.baki && r.baki.length ? `<details style="margin-top:8px"><summary><b>${sumber === 'inventori' ? 'Baki setiap item' : sumber === 'dashboard' ? 'Senarai wad' : 'Baki OFF setiap staf'} (${r.baki.length})</b> — semak dengan app lama</summary><table class="tbl" style="margin-top:6px">${r.baki.map(([n, b]) => `<tr><td>${esc(n)}</td><td style="text-align:right"><b>${esc(b)}</b></td></tr>`).join('')}</table></details>` : ''}</div>
          ${r.amaran.length ? `<div class="note-box" style="margin-top:10px"><b>Amaran (${r.amaran.length})</b><ul style="margin:6px 0 0;padding-left:18px">${r.amaran.map((a) => `<li>${esc(a)}</li>`).join('')}</ul></div>` : ''}`;
      } catch (err) { ralat(err); }
    });
  };
}

/* ================= Keputusan UAT ================= */
async function uat(el) {
  const d = await api('uat.semua', {}, { cache: true });
  const nm = (id) => (d.staf.find((s) => s.stafId === id) || { nama: id }).nama;
  const ikut = {}; d.rekod.forEach((r) => { (ikut[r.senario] = ikut[r.senario] || []).push(r); });
  const gagal = d.rekod.filter((r) => r.status === 'GAGAL');
  const catatan = d.rekod.filter((r) => r.status !== 'GAGAL' && r.catatan);
  const perStaf = d.staf.map((s) => {
    const rs = d.rekod.filter((r) => r.stafId === s.stafId && r.status);
    return { ...s, siap: rs.length, gagal: rs.filter((r) => r.status === 'GAGAL').length, akhir: rs.map((r) => r.masa).sort().pop() || '' };
  }).sort((a, b) => b.siap - a.siap || a.nama.localeCompare(b.nama));
  const tajukS = (id) => { const x = SENARIO.find((s) => s.id === id); return x ? x.tajuk : id; };
  const baris = (r) => `<tr><td><span class="badge grey">${esc(r.senario)}</span></td><td><b>${esc(tajukS(r.senario))}</b><div class="small muted">${esc(nm(r.stafId))} · ${esc(masaRingkas(r.masa))}</div></td><td class="small" style="white-space:pre-wrap">${esc(r.catatan) || '<span class="muted">—</span>'}</td></tr>`;
  el.innerHTML = `
  <div class="grid g2" style="align-items:start">
    <section class="card pad"><h3 style="margin:0 0 6px;font-size:16px">Ringkasan</h3>
      <p class="small muted" style="margin:0 0 12px">Staf yang sudah menguji: <b>${perStaf.filter((s) => s.siap).length} / ${perStaf.length}</b> · Keputusan direkod: <b>${d.rekod.filter((r) => r.status).length}</b> · Gagal: <b style="color:var(--bad)">${gagal.length}</b></p>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Staf</th><th style="text-align:right">Diuji</th><th style="text-align:right">Gagal</th></tr></thead><tbody>
      ${perStaf.map((s) => `<tr><td>${esc(s.nama)}<div class="small muted">${esc(s.stafId)}${s.logMasukAkhir ? '' : ' · belum log masuk'}</div></td><td style="text-align:right">${s.siap}</td><td style="text-align:right">${s.gagal ? `<span class="badge bad">${s.gagal}</span>` : '0'}</td></tr>`).join('')}
      </tbody></table></div></section>
    <section class="card pad"><h3 style="margin:0 0 12px;font-size:16px">Ikut senario</h3>
      <div class="scroll-x"><table class="tbl"><thead><tr><th>Senario</th><th style="text-align:right">Lulus</th><th style="text-align:right">Gagal</th></tr></thead><tbody>
      ${KUMPULAN.map((g) => SENARIO.filter((x) => x.modul === g.modul).map((x) => { const rs = ikut[x.id] || []; const l = rs.filter((r) => r.status === 'LULUS').length, f = rs.filter((r) => r.status === 'GAGAL').length;
        return `<tr><td><span class="badge grey">${esc(x.id)}</span> ${esc(x.tajuk)}</td><td style="text-align:right">${l || '<span class="muted">0</span>'}</td><td style="text-align:right">${f ? `<span class="badge bad">${f}</span>` : '<span class="muted">0</span>'}</td></tr>`; }).join('')).join('')}
      </tbody></table></div></section>
  </div>
  <section class="card pad" style="margin-top:16px"><h3 style="margin:0 0 12px;font-size:16px;color:var(--bad)">Senario gagal (${gagal.length})</h3>
    ${gagal.length ? `<div class="scroll-x"><table class="tbl"><tbody>${gagal.map(baris).join('')}</tbody></table></div>` : '<p class="muted small" style="margin:0">Tiada lagi.</p>'}</section>
  <section class="card pad" style="margin-top:16px"><h3 style="margin:0 0 12px;font-size:16px">Catatan & cadangan (${catatan.length})</h3>
    ${catatan.length ? `<div class="scroll-x"><table class="tbl"><tbody>${catatan.map(baris).join('')}</tbody></table></div>` : '<p class="muted small" style="margin:0">Tiada lagi.</p>'}</section>`;
}
