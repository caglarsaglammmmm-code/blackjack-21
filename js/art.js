// Kart ve fiş çizimleri: tamamı kodla üretilen SVG.
const SUIT_PATH = {
  S: 'M50 6C50 6 12 38 12 62c0 15 12 24 24 24 5 0 9-1 12-4-1 8-4 12-10 16h24c-6-4-9-8-10-16 3 3 7 4 12 4 12 0 24-9 24-24C88 38 50 6 50 6Z',
  H: 'M50 92S8 60 8 32C8 17 19 8 31 8c8 0 15 4 19 12 4-8 11-12 19-12 12 0 23 9 23 24 0 28-42 60-42 60Z',
  D: 'M50 4 86 50 50 96 14 50Z',
  C: 'M50 8c-12 0-21 9-21 20 0 4 1 8 3 11-3-2-7-3-11-3C10 36 2 45 2 56s9 20 20 20c7 0 13-3 17-8-1 12-4 18-11 24h44c-7-6-10-12-11-24 4 5 10 8 17 8 11 0 20-9 20-20s-8-20-19-20c-4 0-8 1-11 3 2-3 3-7 3-11 0-11-9-20-21-20Z',
};
const RED = new Set(['H', 'D']);

// 100x140 kart üzerinde pip düzeni (x, y, ters mi)
const L = 30; const C = 50; const R = 70;
const T = 30; const B = 110; const M = 70;
const PIPS = {
  A: [[C, M, 0]],
  2: [[C, T, 0], [C, B, 1]],
  3: [[C, T, 0], [C, M, 0], [C, B, 1]],
  4: [[L, T, 0], [R, T, 0], [L, B, 1], [R, B, 1]],
  5: [[L, T, 0], [R, T, 0], [C, M, 0], [L, B, 1], [R, B, 1]],
  6: [[L, T, 0], [R, T, 0], [L, M, 0], [R, M, 0], [L, B, 1], [R, B, 1]],
  7: [[L, T, 0], [R, T, 0], [C, 50, 0], [L, M, 0], [R, M, 0], [L, B, 1], [R, B, 1]],
  8: [[L, T, 0], [R, T, 0], [C, 50, 0], [L, M, 0], [R, M, 0], [C, 90, 1], [L, B, 1], [R, B, 1]],
  9: [[L, T, 0], [R, T, 0], [L, 57, 0], [R, 57, 0], [C, M, 0], [L, 83, 1], [R, 83, 1], [L, B, 1], [R, B, 1]],
  10: [[L, T, 0], [R, T, 0], [C, 44, 0], [L, 57, 0], [R, 57, 0], [L, 83, 1], [R, 83, 1], [C, 96, 1], [L, B, 1], [R, B, 1]],
};

const suit = (s, x, y, size, flip = false) => (
  `<use href="#s-${s}" transform="translate(${x - size / 2} ${y - size / 2}) scale(${size / 100})${flip ? ' rotate(180 50 50)' : ''}"/>`
);

const CROWN = 'M-16 8-20-10l9 7L0-14 11-3l9-7-4 18Z';

function courtFace(rank, s) {
  const ink = RED.has(s) ? 'var(--ink-red)' : 'var(--ink-black)';
  const half = (
    `<path d="M0-44C-22-44-27-22-27 0h54C27-22 22-44 0-44Z" fill="url(#court)" stroke="${ink}" stroke-width="1"/>`
    + `<path d="M-27 0Q0-14 27 0" fill="none" stroke="#a9823a" stroke-width="1.4"/>`
    + (rank === 'K'
      ? `<path d="${CROWN}" transform="translate(0 -24) scale(.8)" fill="#c89b3c" stroke="${ink}" stroke-width=".8"/>`
      : rank === 'Q'
        ? `<g transform="translate(0 -24)"><circle r="8" fill="none" stroke="#c89b3c" stroke-width="2.4"/><circle cy="-11" r="2.6" fill="#c89b3c"/></g>`
        : `<g transform="translate(0 -23) rotate(45)" fill="#c89b3c"><rect x="-1.4" y="-13" width="2.8" height="26" rx="1"/><rect x="-6" y="5" width="12" height="2.4" rx="1"/></g>`)
  );
  return (
    `<rect x="20" y="17" width="60" height="106" rx="5" fill="none" stroke="${ink}" stroke-width="1"/>`
    + `<rect x="23" y="20" width="54" height="100" rx="3" fill="none" stroke="#a9823a" stroke-width=".7"/>`
    + `<g transform="translate(50 70)">${half}<g transform="rotate(180)">${half}</g>`
    + `<path d="M-27 0H27" stroke="${ink}" stroke-width="1.2"/></g>`
    + `<g fill="${ink}">${suit(s, 33, 34, 16)}${suit(s, 67, 106, 16, true)}</g>`
    + `<text x="50" y="${rank === 'Q' ? 76 : 76}" text-anchor="middle" class="court-letter" fill="${ink}">${rank}</text>`
  );
}

const LABEL = { A: 'A', J: 'J', Q: 'Q', K: 'K' };

export function cardFace({ rank, suit: s }) {
  const color = RED.has(s) ? 'var(--ink-red)' : 'var(--ink-black)';
  const label = LABEL[rank] ?? rank;
  const corner = (
    `<text x="12" y="21" text-anchor="middle" class="rank">${label}</text>${suit(s, 12, 33, 13)}`
  );
  const body = PIPS[rank]
    ? PIPS[rank].map(([x, y, flip]) => suit(s, x, y, rank === 'A' ? 44 : 19, Boolean(flip))).join('')
    : courtFace(rank, s);
  return (
    `<svg viewBox="0 0 100 140" aria-hidden="true"><rect width="100" height="140" rx="9" fill="url(#paper)"/>`
    + `<rect x=".6" y=".6" width="98.8" height="138.8" rx="8.5" fill="none" stroke="#b9a988" stroke-width="1"/>`
    + `<g fill="${color}">${corner}<g transform="rotate(180 50 70)">${corner}</g>${body}</g></svg>`
  );
}

export const CARD_BACK = (
  `<svg viewBox="0 0 100 140" aria-hidden="true"><rect width="100" height="140" rx="9" fill="#14090a"/>`
  + `<rect x="5" y="5" width="90" height="130" rx="6" fill="url(#back-fill)" stroke="#c89b3c" stroke-width="1.4"/>`
  + `<rect x="10" y="10" width="80" height="120" rx="3" fill="url(#lattice)" stroke="#8c6a2a" stroke-width=".8"/>`
  + `<g transform="translate(50 70)"><path d="M0-26 22 0 0 26-22 0Z" fill="#14090a" stroke="#c89b3c" stroke-width="1.4"/>`
  + `<path d="M0-16 13 0 0 16-13 0Z" fill="none" stroke="#c89b3c" stroke-width=".8"/>`
  + `<text y="5.5" text-anchor="middle" class="back-mark">21</text></g></svg>`
);

// Tüm kartların paylaştığı tanımlar: sayfaya bir kez eklenir.
export const SVG_DEFS = (
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>`
  + Object.entries(SUIT_PATH).map(([k, d]) => `<symbol id="s-${k}" viewBox="0 0 100 100" width="100" height="100"><path d="${d}"/></symbol>`).join('')
  + `<linearGradient id="paper" x2="1" y2="1"><stop offset="0" stop-color="#fbf5e6"/><stop offset="1" stop-color="#ece1c8"/></linearGradient>`
  + `<linearGradient id="court" x2="0" y2="1"><stop offset="0" stop-color="#f3e3bb"/><stop offset="1" stop-color="#e2c98d"/></linearGradient>`
  + `<linearGradient id="back-fill" x2="1" y2="1"><stop offset="0" stop-color="#6d1420"/><stop offset="1" stop-color="#3a0a12"/></linearGradient>`
  + `<pattern id="lattice" width="12" height="12" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="12" height="12" fill="#4d0e18"/><path d="M0 0H12M0 0V12" stroke="#a9823a" stroke-width=".7" opacity=".7"/><circle cx="6" cy="6" r="1" fill="#c89b3c" opacity=".8"/></pattern>`
  + `</defs></svg>`
);

const CHIP_STYLE = {
  10: ['#efe4cb', '#a89a7e', '#3b1216'],
  25: ['#8e1c2a', '#4f0d17', '#f4e7c8'],
  50: ['#9a6a2e', '#553712', '#fbeed0'],
  100: ['#1d1718', '#050404', '#d9b35a'],
  500: ['#d9ae4c', '#8b6620', '#2a1608'],
};

// Üstten görünüm ve alttan kalınlık: fiş kendi yüksekliği olan bir disk gibi durur.
export function chipSVG(value) {
  const [face, edge, text] = CHIP_STYLE[value];
  const spots = Array.from({ length: 8 }, (_, i) => (
    `<rect x="46" y="4" width="8" height="15" rx="1.5" fill="${text}" opacity=".92" transform="rotate(${i * 45} 50 50)"/>`
  )).join('');
  return (
    `<svg viewBox="0 0 100 108" aria-hidden="true">`
    + `<ellipse cx="50" cy="58" rx="48" ry="48" fill="${edge}"/>`
    + `<circle cx="50" cy="50" r="48" fill="${face}"/>${spots}`
    + `<circle cx="50" cy="50" r="48" fill="url(#chip-shine)"/>`
    + `<circle cx="50" cy="50" r="31" fill="${face}" stroke="${text}" stroke-width="1.6" stroke-dasharray="3 3"/>`
    + `<text x="50" y="${value >= 100 ? 58 : 60}" text-anchor="middle" class="chip-value" font-size="${value >= 100 ? 25 : 29}" fill="${text}">${value}</text></svg>`
  );
}

export const CHIP_DEFS = (
  `<svg width="0" height="0" style="position:absolute" aria-hidden="true"><defs>`
  + `<radialGradient id="chip-shine" cx=".32" cy=".26" r=".85"><stop offset="0" stop-color="#fff" stop-opacity=".34"/><stop offset=".5" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".28"/></radialGradient>`
  + `</defs></svg>`
);

// Bahsi görünür fişlere ayırır (büyükten küçüğe).
export function chipBreakdown(amount, chips = [500, 100, 50, 25, 10]) {
  const out = [];
  let rest = Math.floor(amount);
  for (const chip of chips) {
    while (rest >= chip && out.length < 12) {
      out.push(chip);
      rest -= chip;
    }
  }
  if (rest > 0 && out.length === 0) out.push(10);
  return out;
}
