import { S, tajuk, setBoot, logKeluar } from '../app.js';
import { api } from '../api.js';
import { $, esc, toast, ralat, sibuk, simpan, ambil, inisial } from '../ui.js';
import { ic } from '../icons.js';
import { statusPush, aktifkanPush, hentiPush, PESAN_STATUS } from '../push.js';

const NAMA_MODUL = { suite: 'Admin Suite', formulari: 'Formulari', bukuoff: 'Buku Off', inventori: 'Inventori', dashboard: 'Dashboard', guttae: 'Guttae', pergerakan: 'Pergerakan Staf' };

export function papar(page, rest) {
  tajuk('Profil');
  const me = S.me, paksa = me.tukarPin;
  const tema = ambil('tema') || '';
  const kat = (S.boot.senarai && S.boot.senarai.inventoriKategori) || [];
  const pilihKat = (me.pilihan && me.pilihan.kategoriInventori) || [];
  const peranan = Object.keys(NAMA_MODUL).filter((k) => me.peranan[k]).map((k) => `<span class="badge">${esc(NAMA_MODUL[k])}: ${esc(me.peranan[k])}</span>`).join(' ');

  page.innerHTML = `
  ${paksa ? `<div class="note-box" style="margin-top:8px"><b>Sila tukar PIN sementara anda</b> sebelum meneruskan.</div>` : ''}
  <div class="grid g2" style="margin-top:8px;align-items:start">
    <section class="card pad">
      <div class="row" style="gap:14px;margin-bottom:16px"><span class="av" style="width:56px;height:56px;font-size:20px">${esc(inisial(me.nama))}</span>
        <div><b style="font-size:17px">${esc(me.nama)}</b><div class="muted small">${esc(me.stafId)}${me.jawatan ? ' · ' + esc(me.jawatan) : ''}</div></div></div>
      <div class="row" style="gap:6px;margin-bottom:18px">${peranan || '<span class="muted small">Tiada peranan</span>'}</div>
      <form id="fProfil">
        <label class="field"><span>Emel (untuk notifikasi)</span><input class="in" name="emel" type="email" value="${esc(me.emel)}" placeholder="nama@usm.my"></label>
        ${kat.length && S.ada('inventori') ? `<div class="field"><span>Kategori Inventori yang saya lihat</span>
          <div class="row">${kat.map((k) => `<label class="switch"><input type="checkbox" name="kat" value="${esc(k.nilai)}" ${!pilihKat.length || pilihKat.includes(k.nilai) ? 'checked' : ''}>${esc(k.label)}</label>`).join('')}</div></div>` : ''}
        <button class="btn pri" type="submit">Simpan profil</button>
      </form>
    </section>
    <section class="card pad" id="secPin">
      <h3 style="margin:0 0 14px;font-size:16px">${ic('key', '')} Tukar PIN</h3>
      <form id="fPin">
        <label class="field"><span>PIN semasa</span><input class="in" name="lama" type="password" inputmode="numeric" autocomplete="current-password" required></label>
        <label class="field"><span>PIN baharu</span><input class="in" name="baru" type="password" inputmode="numeric" autocomplete="new-password" required minlength="4"><small>4–20 aksara. Elakkan PIN mudah seperti 1234.</small></label>
        <label class="field"><span>Ulang PIN baharu</span><input class="in" name="ulang" type="password" inputmode="numeric" autocomplete="new-password" required></label>
        <button class="btn pri" type="submit">Tukar PIN</button>
      </form>
    </section>
    <section class="card pad" id="secNotis">
      <h3 style="margin:0 0 6px;font-size:16px">${ic('bell', '')} Notifikasi</h3>
      <p class="small muted" style="margin:0 0 12px">Terima notis bila staf mengisi Pergerakan Staf, dan ringkasan pergerakan hari ini setiap pagi jam 8.00.</p>
      <p class="small" id="stNotis" style="margin:0 0 12px">Menyemak…</p>
      <div class="small" id="diagNotis" style="margin:0 0 12px" hidden></div>
      <div class="row"><button class="btn pri" id="bNotis" hidden>${ic('bell')} Aktifkan notifikasi</button>
        <button class="btn" id="bUjiNotis" hidden>Hantar notis ujian</button><button class="btn ghost" id="bHentiNotis" hidden>Matikan</button></div>
    </section>
    <section class="card pad">
      <h3 style="margin:0 0 14px;font-size:16px">Paparan</h3>
      <div class="tabs" id="tema">
        <button data-t="" class="${!tema ? 'on' : ''}">Ikut peranti</button>
        <button data-t="light" class="${tema === 'light' ? 'on' : ''}">${'Cerah'}</button>
        <button data-t="dark" class="${tema === 'dark' ? 'on' : ''}">Gelap</button>
      </div>
      <div class="row" style="margin-top:18px">
        <button class="btn" id="bPasang" hidden>${ic('install')} Pasang app</button>
        <button class="btn bad" id="bKeluar">${ic('logout')} Log keluar</button>
      </div>
      <p class="small muted" style="margin:16px 0 0">UPAR Suite v${esc(S.boot.versi || '')}</p>
    </section>
  </div>`;
  page.insertAdjacentHTML('beforeend', '<p class="kredit" style="margin-top:24px">Developed by TUTI 2026</p>');

  if (rest[0] === 'pin' || paksa) $('#secPin', page).scrollIntoView({ block: 'center' });

  $('#fProfil', page).onsubmit = (e) => {
    e.preventDefault();
    const f = e.target, k = Array.from(f.querySelectorAll('[name=kat]'));
    const pilihan = k.length ? { kategoriInventori: k.every((x) => x.checked) ? [] : k.filter((x) => x.checked).map((x) => x.value) } : undefined;
    sibuk(f.querySelector('button'), async () => {
      try { const me2 = await api('teras.profil', { emel: f.emel.value.trim(), pilihan }); setBoot({ ...S.boot, me: me2 }); toast('Profil disimpan', 'ok'); }
      catch (err) { ralat(err); }
    });
  };

  $('#fPin', page).onsubmit = (e) => {
    e.preventDefault();
    const f = e.target;
    if (f.baru.value !== f.ulang.value) return ralat('PIN baharu tidak sepadan.');
    if (/^(\d)\1+$/.test(f.baru.value) || ['1234', '123456', '0000'].includes(f.baru.value)) return ralat('PIN terlalu mudah. Pilih PIN lain.');
    sibuk(f.querySelector('button'), async () => {
      try {
        await api('auth.tukarPin', { lama: f.lama.value, baru: f.baru.value });
        setBoot({ ...S.boot, me: { ...S.me, tukarPin: false } });
        toast('PIN berjaya ditukar', 'ok'); f.reset();
        if (paksa) location.hash = '#/utama';
      } catch (err) { ralat(err); }
    });
  };

  $('#tema', page).onclick = (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    const t = b.dataset.t;
    if (t) document.documentElement.dataset.theme = t; else delete document.documentElement.dataset.theme;
    simpan('tema', t);
    page.querySelectorAll('#tema button').forEach((x) => x.classList.toggle('on', x === b));
  };
  $('#bKeluar', page).onclick = () => logKeluar();

  const lukisNotis = async () => {
    const st = await statusPush();
    $('#stNotis', page).textContent = PESAN_STATUS[st] || '';
    $('#stNotis', page).style.color = st === 'aktif' ? 'var(--ok)' : st === 'disekat' ? 'var(--bad)' : '';
    $('#bNotis', page).hidden = !['tidak-aktif'].includes(st);
    $('#bUjiNotis', page).hidden = $('#bHentiNotis', page).hidden = st !== 'aktif';
  };
  lukisNotis();
  $('#bNotis', page).onclick = (e) => sibuk(e.currentTarget, async () => { try { await aktifkanPush(); toast('Notifikasi diaktifkan', 'ok'); } catch (err) { ralat(err); } lukisNotis(); });
  $('#bUjiNotis', page).onclick = (e) => sibuk(e.currentTarget, async () => {
    try {
      const r = await api('push.uji'), dg = $('#diagNotis', page);
      toast(r.dihantar ? 'Notis ujian dihantar — tunggu beberapa saat' : 'Notis ujian tidak sampai — lihat butiran', r.dihantar ? 'ok' : 'bad');
      const b = r.butiran || [];
      dg.hidden = !b.length;
      dg.innerHTML = b.map((x) => `<div class="note-box" style="margin:0 0 6px;padding:8px 10px"><b>${esc(x.peranti || 'Peranti')}${x.hos ? ' · ' + esc(x.hos) : ''}</b> — ${x.kod ? 'kod ' + esc(x.kod) + ': ' : ''}${esc(x.mesej)}</div>`).join('');
    } catch (err) { ralat(err); }
  });
  $('#bHentiNotis', page).onclick = (e) => sibuk(e.currentTarget, async () => { await hentiPush(); toast('Notifikasi dimatikan di peranti ini'); lukisNotis(); });

  const ins = window.__pasang;
  if (ins) { const bp = $('#bPasang', page); bp.hidden = false; bp.onclick = async () => { ins.prompt(); await ins.userChoice; window.__pasang = null; bp.hidden = true; }; }
}

