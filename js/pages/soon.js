import { tajuk } from '../app.js';
import { esc } from '../ui.js';
import { ic } from '../icons.js';

export function papar(page, rest, { modul }) {
  tajuk(modul.nama);
  page.innerHTML = `<div class="card empty" style="margin-top:12px">${ic(modul.ic)}
    <h3 style="color:var(--ink);margin:0 0 6px">${esc(modul.nama)}</h3>
    <p style="margin:0">Modul ini sedang dibina dan akan tersedia dalam <b>Fasa ${modul.fasa}</b>.<br>Buat sementara, teruskan menggunakan sistem lama.</p></div>`;
}
