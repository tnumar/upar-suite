import { api } from '../api.js';
import { $, esc, ralat, sibuk, ambil, simpan } from '../ui.js';

export function papar(root, selesai) {
  const idLepas = ambil('idLepas') || '';
  root.innerHTML = `
  <div class="login">
    <section class="login-art">
      <div>
        <img class="hero-logo" src="assets/logo.svg" alt="">
        <h1>UPAR Suite</h1>
        <p>Unit Pendispensan Aseptik &amp; Radiofarmasi, Jabatan Farmasi HPUSM.</p>
        <div class="mods"><span>Dashboard</span><span>Guttae</span><span>Buku Off</span><span>Inventori</span><span>Formulari</span><span>Pergerakan Staf</span></div>
      </div>
      <small style="opacity:.6">© ${new Date().getFullYear()} UPAR · HPUSM<br>Developed by TUTI 2026</small>
    </section>
    <section class="login-form">
      <form id="fLogin" autocomplete="on" novalidate>
        <h2>Log masuk</h2>
        <p class="muted" style="margin:0 0 22px">Guna ID staf (atau emel) dan PIN anda.</p>
        <label class="field"><span>ID staf / emel</span>
          <input class="in" name="sid" autocomplete="username" inputmode="text" autocapitalize="off" spellcheck="false" required value="${esc(idLepas)}"></label>
        <label class="field"><span>PIN</span>
          <input class="in pinbox" name="pin" type="password" autocomplete="current-password" inputmode="numeric" required placeholder="••••"></label>
        <p id="msg" class="small" style="color:var(--bad);min-height:20px;margin:0 0 8px"></p>
        <button class="btn pri" style="width:100%;height:46px" type="submit">Log masuk</button>
        <p class="small muted" style="margin-top:18px">Terlupa PIN? Hubungi Admin unit untuk reset PIN.</p>
      </form>
    </section>
  </div>`;
  const f = $('#fLogin', root);
  (idLepas ? f.pin : f.sid).focus();
  f.onsubmit = (e) => {
    e.preventDefault();
    const id = f.sid.value.trim(), pin = f.pin.value;
    $('#msg', root).textContent = '';
    if (!id || !pin) { $('#msg', root).textContent = 'Sila isi ID dan PIN.'; return; }
    sibuk(f.querySelector('button'), async () => {
      try {
        const peranti = (navigator.userAgentData && navigator.userAgentData.platform) || navigator.platform || '';
        const d = await api('auth.login', { id, pin, peranti: peranti + (matchMedia('(display-mode: standalone)').matches ? ' · app' : ' · pelayar') });
        simpan('idLepas', id);
        selesai(d);
      } catch (err) { $('#msg', root).textContent = err.message; f.pin.select(); }
    });
  };
}
