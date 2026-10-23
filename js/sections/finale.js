// The last page — A Final Gift of Love.
// An animated gift on the blue, then the family's closing words:
//   1. the ivory-and-gold gift appears in the middle of the screen, floating
//      in a soft glow;
//   2. it gives a little wiggle, and the lid lifts off;
//   3. a warm golden light pours out of the box, and a golden "50" rises out
//      of it with gold sparkles and confetti;
//   4. the gift glides to the side and the family's closing words appear
//      beside it, line by line;
//   5. the finished scene stays: nothing moves on or starts over by itself
//      (automatic playback ends on this page).
// "Replay" plays the opening again; "Start Again" returns to the welcome.
// With reduced motion the finished scene is shown at once.

import { h, icons, prefersReducedMotion } from '../core/util.js';
import { confetti } from '../core/confetti.js';

const GOLD = ['#d9b66f', '#ecdcb2', '#f4e2b1', '#c49a48', '#ffffff', '#9fdcf2'];
// the opening, step by step: [class added to the scene, ms after the page opens]
const STEPS = [['is-playing', 250], ['is-wiggling', 1500], ['is-open', 2300], ['is-rising', 2800], ['is-revealed', 4900]];
const STATES = STEPS.map(([name]) => name);

const GIFT_SVG = `
<svg class="fgift__svg" viewBox="0 0 400 470" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="fg-front" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.55" stop-color="#fbf4e6"/><stop offset="1" stop-color="#e9d9b6"/></linearGradient>
    <linearGradient id="fg-top" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffdf7"/><stop offset="1" stop-color="#f1e5c9"/></linearGradient>
    <linearGradient id="fg-ribbon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e6b8"/><stop offset="0.5" stop-color="#d9b66f"/><stop offset="1" stop-color="#a87c2f"/></linearGradient>
    <radialGradient id="fg-inside" cx="0.5" cy="0.6" r="0.7"><stop offset="0" stop-color="#fffbe9"/><stop offset="0.45" stop-color="#f6dc95"/><stop offset="1" stop-color="#b98e3e"/></radialGradient>
    <linearGradient id="fg-beam" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#fff4d2" stop-opacity="0.95"/><stop offset="0.45" stop-color="#f2d48f" stop-opacity="0.45"/><stop offset="1" stop-color="#f2d48f" stop-opacity="0"/></linearGradient>
    <linearGradient id="fg-fifty" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fffaf0"/><stop offset="0.35" stop-color="#f6e2a8"/><stop offset="0.7" stop-color="#d9b66f"/><stop offset="1" stop-color="#b08435"/></linearGradient>
  </defs>
  <ellipse class="fgift__shadow" cx="200" cy="446" rx="150" ry="13"/>
  <g class="fgift__all">
    <polygon class="fgift__beam" points="104,252 296,252 392,-60 8,-60" fill="url(#fg-beam)"/>
    <polygon class="fgift__inside" points="84,262 316,262 298,242 102,242" fill="url(#fg-inside)"/>
    <g class="fgift__fifty"><text x="200" y="196" text-anchor="middle">50</text></g>
    <g class="fgift__body">
      <rect x="84" y="262" width="232" height="170" rx="6" fill="url(#fg-front)" stroke="#e2cf9f"/>
      <rect x="284" y="262" width="32" height="170" rx="4" fill="#ead9b2" opacity="0.55"/>
      <rect x="186" y="262" width="28" height="170" fill="url(#fg-ribbon)"/>
      <path d="M84 300 H316" stroke="#d9b66f" stroke-width="1.5" opacity="0.5"/>
    </g>
    <g class="fgift__lid">
      <polygon points="70,226 330,226 310,206 90,206" fill="url(#fg-top)" stroke="#e2cf9f"/>
      <polygon points="186,226 214,226 211,206 189,206" fill="url(#fg-ribbon)"/>
      <rect x="70" y="226" width="260" height="40" rx="6" fill="url(#fg-front)" stroke="#e2cf9f"/>
      <rect x="184" y="226" width="32" height="40" fill="url(#fg-ribbon)"/>
      <path d="M200 208 C 166 160, 112 168, 128 196 C 140 216, 176 214, 200 208 Z" fill="url(#fg-ribbon)"/>
      <path d="M200 208 C 234 160, 288 168, 272 196 C 260 216, 224 214, 200 208 Z" fill="url(#fg-ribbon)"/>
      <path d="M196 212 C 186 232, 176 246, 162 254 M204 212 C 214 232, 224 246, 238 254" stroke="#c9a14f" stroke-width="7" stroke-linecap="round" fill="none"/>
      <circle cx="200" cy="208" r="11" fill="#c9a14f"/>
    </g>
  </g>
</svg>`;

export async function mount(el, content, deck) {
  const f = content.site.finale;
  const { person, event } = content.site;
  let timers = [];
  const later = (fn, ms) => timers.push(setTimeout(fn, ms));
  const stopTimers = () => { timers.forEach(clearTimeout); timers = []; };
  const line = (enter, node) => { node.style.setProperty('--enter', enter); return node; };

  const gift = h('div', { class: 'fgift', 'aria-hidden': 'true' },
    h('span', { class: 'fgift__halo' }),
    h('span', { class: 'fgift__rays' }),
    h('span', { html: GIFT_SVG }),
    h('span', { class: 'fgift__sparks' }, Array.from({ length: 16 }, (_, i) => h('i', { style: { '--i': i, '--x': ((i * 37) % 17) / 16 - 0.5, '--d': `${(i % 5) * 0.37}s` } }))),
    h('span', { class: 'fgift__twinkles' }, Array.from({ length: 8 }, (_, i) => h('i', { style: { '--i': i } }))),
  );
  const visual = h('div', { class: 'finale__visual' }, gift);
  const frame = h('div', { class: 'scene__frame finale' },
    h('div', { class: 'finale__text' },
      line(0, h('p', { class: 'eyebrow' }, f.eyebrow || 'A Final Gift of Love')),
      line(1, h('h2', { class: 'finale__title', id: 'finale-title' }, f.headline)),
      line(2, h('p', { class: 'finale__subline' }, f.subline)),
      line(3, h('p', { class: 'finale__message' }, f.message)),
      line(4, h('p', { class: 'finale__sign' }, f.sign || 'With all our love, always')),
      line(5, h('div', { class: 'finale__details' },
        h('p', { class: 'finale__name' }, person.fullName),
        h('p', { class: 'finale__detail' }, h('span', { html: icons.calendar }), event.dateLabel),
        h('p', { class: 'finale__detail' }, h('span', { html: icons.pin }), `${event.venue}, ${event.area}`),
      )),
      line(6, h('div', { class: 'finale__actions' },
        h('button', { class: 'btn btn--celebrate', type: 'button', onclick: () => play() }, h('span', { html: icons.replay }), 'Replay'),
        h('button', { class: 'btn', type: 'button', onclick: () => deck.go(0, { dir: -1, focus: true }) }, h('span', { html: icons.replay }), 'Start Again'),
      )),
      content.site.music?.credit ? line(7, h('p', { class: 'finale__credit' }, content.site.music.credit)) : null,
    ),
    visual,
  );
  el.append(frame);

  /** How far the gift travels to sit in the middle of the screen while it opens. */
  function centre() {
    const dx = frame.clientWidth / 2 - (visual.offsetLeft + visual.offsetWidth / 2);
    el.style.setProperty('--to-centre', `${Math.round(dx)}px`);
  }

  function reset() {
    stopTimers();
    el.classList.remove(...STATES);
  }

  /** The whole opening, from a closed gift in the middle to the finished scene. */
  function play() {
    reset();
    centre();
    void el.offsetWidth; // start every transition from the closed gift
    if (prefersReducedMotion()) { el.classList.add(...STATES); return; }
    for (const [name, at] of STEPS) later(() => el.classList.add(name), at);
    // gold sparkles burst from the box as the 50 rises, then a gentle golden rain
    later(() => {
      const r = gift.getBoundingClientRect();
      confetti({ x: (r.left + r.width / 2) / innerWidth, y: (r.top + r.height * 0.45) / innerHeight, count: 90, colors: GOLD });
    }, 3000);
    later(() => confetti({ mode: 'rain', count: 80, colors: GOLD }), 5200);
  }

  return {
    hint: 'A gift opens, a golden 50 rises, and the closing words',
    enter() { play(); },
    leave() { reset(); },
    fit: centre,
  };
}
