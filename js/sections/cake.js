// The cake celebration — after the family's video wishes, before the final gift
// (data/site.json → cake). A two-tier ivory cake with champagne-gold bands,
// soft royal-blue swags and a golden "50", drawn in the same style as the
// final gift. When the page opens the cake rises in, the five candles light
// one after another and a little golden confetti falls. "Make a Wish" blows
// the candles out with a wisp of smoke; they light again a moment later.
// In the automatic presentation the page stays `holdSeconds`, then moves on.

import { h, icons } from '../core/util.js';
import { confetti } from '../core/confetti.js';

const GOLD = ['#d9b66f', '#ecdcb2', '#f4e2b1', '#c49a48', '#ffffff', '#6f9be0'];
const CANDLES = [120, 140, 160, 180, 200];
const RELIGHT_MS = 4200;

// the swags of icing along a tier's top edge, as one path
const swags = (x0, x1, y, n, depth) => {
  const w = (x1 - x0) / n;
  return `M${x0} ${y}` + Array.from({ length: n }, (_, i) => ` Q${x0 + w * i + w / 2} ${y + depth} ${x0 + w * (i + 1)} ${y}`).join('');
};
const pearls = (x0, x1, y, n) => Array.from({ length: n + 1 }, (_, i) => `<circle cx="${x0 + ((x1 - x0) / n) * i}" cy="${y}" r="3.2"/>`).join('');

const CAKE_SVG = `
<svg class="cake__svg" viewBox="0 0 320 340" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="ck-ivory" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f6ecd7"/><stop offset="0.35" stop-color="#ffffff"/><stop offset="0.75" stop-color="#fbf4e6"/><stop offset="1" stop-color="#eadbbb"/></linearGradient>
    <linearGradient id="ck-gold" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4e2b1"/><stop offset="0.5" stop-color="#d9b66f"/><stop offset="1" stop-color="#b08435"/></linearGradient>
    <linearGradient id="ck-candle" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#e9ddc4"/></linearGradient>
    <radialGradient id="ck-flame" cx="0.5" cy="0.7" r="0.6"><stop offset="0" stop-color="#ffffff"/><stop offset="0.35" stop-color="#ffe9a8"/><stop offset="0.8" stop-color="#f2b54b"/><stop offset="1" stop-color="#e08a2a" stop-opacity="0"/></radialGradient>
  </defs>
  <ellipse class="cake__shadow" cx="160" cy="326" rx="120" ry="9"/>
  <!-- the stand -->
  <path d="M128 324 L140 304 L180 304 L192 324 Z" fill="url(#ck-gold)"/>
  <ellipse cx="160" cy="300" rx="136" ry="12" fill="url(#ck-gold)"/>
  <ellipse cx="160" cy="297" rx="130" ry="9" fill="#fff9ec"/>
  <!-- lower tier -->
  <rect x="52" y="198" width="216" height="98" rx="10" fill="url(#ck-ivory)" stroke="#e2cf9f"/>
  <rect x="52" y="270" width="216" height="12" fill="url(#ck-gold)"/>
  <path d="${swags(52, 268, 204, 6, 20)}" fill="none" stroke="#7fa6e3" stroke-width="3.2" stroke-linecap="round"/>
  <g fill="#ffffff" stroke="#c6dbf5" stroke-width="1">${pearls(52, 268, 204, 6)}</g>
  <ellipse cx="160" cy="244" rx="30" ry="21" fill="url(#ck-gold)"/>
  <ellipse cx="160" cy="244" rx="25" ry="16.5" fill="#fffaf0"/>
  <text class="cake__fifty" x="160" y="254" text-anchor="middle">50</text>
  <!-- upper tier -->
  <rect x="96" y="132" width="128" height="70" rx="9" fill="url(#ck-ivory)" stroke="#e2cf9f"/>
  <rect x="96" y="180" width="128" height="9" fill="url(#ck-gold)"/>
  <path d="${swags(96, 224, 138, 4, 15)}" fill="none" stroke="#7fa6e3" stroke-width="2.8" stroke-linecap="round"/>
  <g fill="#ffffff" stroke="#c6dbf5" stroke-width="1">${pearls(96, 224, 138, 4)}</g>
  <ellipse cx="160" cy="133" rx="64" ry="6" fill="#ffffff" stroke="#e2cf9f"/>
  <!-- candles, flames and smoke -->
  ${CANDLES.map((x, i) => `
  <g class="cake__candle" style="--i:${i}">
    <rect x="${x - 4}" y="94" width="8" height="40" rx="2.5" fill="url(#ck-candle)" stroke="#e2cf9f" stroke-width="0.8"/>
    <path d="M${x - 4} 104 l8 -4 M${x - 4} 114 l8 -4 M${x - 4} 124 l8 -4" stroke="#d9b66f" stroke-width="1.6"/>
    <line x1="${x}" y1="94" x2="${x}" y2="88" stroke="#6b5a3d" stroke-width="1.2"/>
    <circle class="cake__halo" cx="${x}" cy="78" r="15"/>
    <path class="cake__flame" d="M${x} 66 C ${x + 6} 74, ${x + 6} 83, ${x} 88 C ${x - 6} 83, ${x - 6} 74, ${x} 66 Z" fill="url(#ck-flame)"/>
    <path class="cake__smoke" d="M${x} 86 c -5 -8, 5 -12, 0 -20 c -5 -8, 5 -12, 0 -20" fill="none" stroke="#b9c6d8" stroke-width="2" stroke-linecap="round"/>
  </g>`).join('')}
</svg>`;

export async function mount(el, content) {
  const c = content.site.cake || {};
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));

  function light() {
    el.classList.remove('is-wished');
    el.classList.add('is-lit');
  }
  function wish() {
    if (el.classList.contains('is-wished')) return;
    el.classList.add('is-wished');
    confetti({ mode: 'rain', count: 110, colors: GOLD });
    later(() => confetti({ x: 0.72, y: 0.5, count: 70, colors: GOLD }), 450);
    later(light, RELIGHT_MS);
  }

  el.append(h('div', { class: 'scene__frame cake' },
    h('div', { class: 'cake__text' },
      h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, c.eyebrow || 'Make a Wish'),
      h('h2', { class: 'cake__title', id: 'cake-title', 'data-enter': '', style: { '--enter': 1 } }, c.headline || 'Happy Birthday, Amma'),
      c.message ? h('p', { class: 'cake__message', 'data-enter': '', style: { '--enter': 2 } }, c.message) : null,
      h('div', { class: 'cake__actions', 'data-enter': '', style: { '--enter': 3 } },
        h('button', { class: 'btn btn--celebrate', type: 'button', onclick: wish }, h('span', { html: icons.sparkle }), c.button || 'Make a Wish')),
    ),
    h('div', { class: 'cake__visual', 'data-enter': '', style: { '--enter': 1 } },
      h('div', { class: 'cake__art', 'aria-hidden': 'true' }, h('span', { class: 'cake__glow' }), h('span', { html: CAKE_SVG }))),
  ));

  return {
    hint: 'The birthday cake, with candles that light one by one',
    auto: () => (Number(c.holdSeconds) || 10) * 1000,
    enter() {
      el.classList.remove('is-lit', 'is-wished');
      later(light, 700);
      later(() => confetti({ mode: 'rain', count: 70, colors: GOLD }), 1500);
    },
    leave() {
      timers.forEach(clearTimeout);
      timers = [];
      el.classList.remove('is-lit', 'is-wished');
    },
  };
}
