// 12 ilustrasi ringkas (SVG) untuk kad motivasi. Dibina dalam app: tiada hak cipta, laju, luar talian.
const PAL = [
  ['#4f46e5', '#7c3aed', '#c4b5fd', '#22d3ee'], ['#0e7490', '#0891b2', '#67e8f9', '#fde68a'],
  ['#be185d', '#7c3aed', '#f9a8d4', '#fcd34d'], ['#065f46', '#0d9488', '#5eead4', '#bbf7d0'],
  ['#1e1b4b', '#4338ca', '#818cf8', '#f0abfc'], ['#9a3412', '#ea580c', '#fdba74', '#fef3c7'],
  ['#0f172a', '#1e3a8a', '#38bdf8', '#e0f2fe'], ['#581c87', '#a21caf', '#f0abfc', '#fde68a'],
  ['#134e4a', '#0f766e', '#99f6e4', '#fef9c3'], ['#312e81', '#6d28d9', '#a5b4fc', '#5eead4'],
  ['#7f1d1d', '#be123c', '#fda4af', '#fde68a'], ['#0c4a6e', '#2563eb', '#93c5fd', '#a7f3d0']
];

function rnd(seed) { let s = seed * 9301 + 49297; return () => ((s = (s * 9301 + 49297) % 233280) / 233280); }

export function seni(i = 0) {
  i = ((i % 12) + 12) % 12;
  const [a, b, c, d] = PAL[i], r = rnd(i + 7), id = 'g' + i;
  const bg = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>
    <radialGradient id="${id}r" cx=".8" cy=".2" r=".7"><stop offset="0" stop-color="${d}" stop-opacity=".55"/><stop offset="1" stop-color="${d}" stop-opacity="0"/></radialGradient></defs>
    <rect width="600" height="300" fill="url(#${id})"/><rect width="600" height="300" fill="url(#${id}r)"/>`;
  let s = '';
  switch (i) {
    case 0: // bukit berlapis
      s = [0, 1, 2].map((k) => `<path d="M0 ${200 + k * 30} C150 ${140 + k * 30} 250 ${240 + k * 25} 400 ${180 + k * 30} S560 ${170 + k * 30} 600 ${190 + k * 30} V300 H0z" fill="${[c, b, a][k]}" opacity="${0.5 + k * 0.2}"/>`).join('')
        + `<circle cx="470" cy="90" r="42" fill="${d}" opacity=".85"/>`; break;
    case 1: // ombak
      s = [0, 1, 2, 3].map((k) => `<path d="M0 ${170 + k * 30} Q75 ${150 + k * 30} 150 ${170 + k * 30} T300 ${170 + k * 30} T450 ${170 + k * 30} T600 ${170 + k * 30} V300 H0z" fill="${c}" opacity="${0.18 + k * 0.14}"/>`).join('')
        + `<circle cx="120" cy="80" r="30" fill="${d}"/>`; break;
    case 2: // gelembung
      s = Array.from({ length: 22 }, () => `<circle cx="${(r() * 600) | 0}" cy="${(r() * 300) | 0}" r="${(6 + r() * 40) | 0}" fill="${r() > .5 ? c : d}" opacity="${(0.15 + r() * 0.45).toFixed(2)}"/>`).join(''); break;
    case 3: // daun
      s = Array.from({ length: 9 }, (_, k) => { const x = 330 + k * 30, y = 60 + (k % 3) * 70, rot = -40 + k * 12; return `<g transform="translate(${x} ${y}) rotate(${rot})"><path d="M0 0 C30 -30 80 -20 100 0 C80 20 30 30 0 0z" fill="${k % 2 ? c : d}" opacity=".75"/><path d="M0 0 H95" stroke="${a}" stroke-width="2" opacity=".5"/></g>`; }).join(''); break;
    case 4: // malam berbintang
      s = Array.from({ length: 60 }, () => `<circle cx="${(r() * 600) | 0}" cy="${(r() * 230) | 0}" r="${(r() * 1.8 + .4).toFixed(1)}" fill="#fff" opacity="${(0.4 + r() * .6).toFixed(2)}"/>`).join('')
        + `<circle cx="480" cy="80" r="34" fill="${d}"/><circle cx="494" cy="70" r="30" fill="${a}"/><path d="M0 260 Q150 220 300 255 T600 245 V300 H0z" fill="${a}" opacity=".9"/>`; break;
    case 5: // matahari terbit
      s = `<circle cx="300" cy="260" r="120" fill="${d}" opacity=".9"/>` + Array.from({ length: 12 }, (_, k) => { const t = Math.PI + (k / 11) * Math.PI; return `<path d="M${300 + Math.cos(t) * 140} ${260 + Math.sin(t) * 140} L${300 + Math.cos(t) * 230} ${260 + Math.sin(t) * 230}" stroke="${c}" stroke-width="6" stroke-linecap="round" opacity=".55"/>`; }).join('')
        + `<rect y="250" width="600" height="50" fill="${a}" opacity=".7"/>`; break;
    case 6: // grid heksagon (molekul)
      for (let y = 0; y < 6; y++) for (let x = 0; x < 12; x++) {
        const cx = x * 56 + (y % 2) * 28 + 10, cy = y * 50 + 20, o = r();
        if (o < .55) continue;
        s += `<polygon points="${[0, 1, 2, 3, 4, 5].map((k) => `${(cx + 24 * Math.cos(Math.PI / 3 * k + Math.PI / 6)).toFixed(1)},${(cy + 24 * Math.sin(Math.PI / 3 * k + Math.PI / 6)).toFixed(1)}`).join(' ')}" fill="none" stroke="${o > .85 ? d : c}" stroke-width="2" opacity="${(o - .4).toFixed(2)}"/>`;
      } break;
    case 7: // aurora
      s = [0, 1, 2].map((k) => `<path d="M-20 ${120 + k * 40} C120 ${40 + k * 50} 260 ${200 - k * 30} 380 ${110 + k * 20} S560 ${60 + k * 40} 640 ${120 + k * 30}" stroke="${[c, d, '#fff'][k]}" stroke-width="${40 - k * 10}" fill="none" opacity="${0.35 - k * 0.07}" stroke-linecap="round"/>`).join(''); break;
    case 8: // titisan
      s = Array.from({ length: 10 }, (_, k) => { const x = 60 + k * 55, y = 70 + (k % 4) * 45, sc = .5 + (k % 3) * .3; return `<path transform="translate(${x} ${y}) scale(${sc})" d="M0 -40 C22 -10 34 6 34 22 a34 34 0 0 1 -68 0 C-34 6 -22 -10 0 -40z" fill="${k % 2 ? c : d}" opacity=".7"/>`; }).join(''); break;
    case 9: // orbit
      s = [70, 120, 170, 220].map((rr, k) => `<circle cx="470" cy="150" r="${rr}" fill="none" stroke="${c}" stroke-width="2" opacity="${0.5 - k * 0.08}"/><circle cx="${470 + rr * Math.cos(k * 1.7)}" cy="${150 + rr * Math.sin(k * 1.7)}" r="${8 + k * 2}" fill="${d}"/>`).join('') + `<circle cx="470" cy="150" r="30" fill="${d}" opacity=".9"/>`; break;
    case 10: // blok geometri
      s = Array.from({ length: 14 }, () => { const w = 30 + r() * 90; return `<rect x="${(r() * 560) | 0}" y="${(r() * 260) | 0}" width="${w | 0}" height="${w | 0}" rx="${(w / 4) | 0}" transform="rotate(${(r() * 40 - 20) | 0} 300 150)" fill="${r() > .5 ? c : d}" opacity="${(0.15 + r() * .35).toFixed(2)}"/>`; }).join(''); break;
    default: // bukit pasir + garisan
      s = Array.from({ length: 14 }, (_, k) => `<path d="M0 ${80 + k * 16} C200 ${40 + k * 18} 400 ${140 + k * 12} 600 ${70 + k * 16}" stroke="${k % 3 ? c : d}" stroke-width="2" fill="none" opacity="${(0.2 + (k % 5) * .1).toFixed(2)}"/>`).join('');
  }
  return `<svg viewBox="0 0 600 300" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${bg}${s}</svg>`;
}
