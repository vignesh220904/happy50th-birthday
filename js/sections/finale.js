// The last page — A Final Gift of Love.
// The family's closing words beside an understated ivory-and-gold gift. When
// the page opens, the gift's lid lifts by itself and a soft golden light and a
// "50" rise out of it, with a gentle fall of golden confetti. "Celebrate"
// plays that moment again; "Start Again" returns to the welcome (the presentation
// itself never starts over on its own: automatic playback ends on this page).

import { h, icons } from '../core/util.js';
import { confetti } from '../core/confetti.js';

const GOLD = ['#d9b66f', '#ecdcb2', '#f4e2b1', '#c49a48', '#ffffff', '#6f9be0'];

const GIFT_SVG = `
<svg class="fgift__svg" viewBox="0 0 320 300" aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="fg-box" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="0.6" stop-color="#fbf4e6"/><stop offset="1" stop-color="#efe2c6"/></linearGradient>
    <linearGradient id="fg-side" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#f3e7cf"/><stop offset="1" stop-color="#e4d2ac"/></linearGradient>
    <linearGradient id="fg-ribbon" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f4e2b1"/><stop offset="0.5" stop-color="#d9b66f"/><stop offset="1" stop-color="#b08435"/></linearGradient>
  </defs>
  <ellipse class="fgift__shadow" cx="160" cy="284" rx="118" ry="10"/>
  <g class="fgift__box">
    <rect x="58" y="150" width="204" height="132" rx="8" fill="url(#fg-box)" stroke="#e2cf9f"/>
    <rect x="230" y="150" width="32" height="132" rx="6" fill="url(#fg-side)" opacity="0.7"/>
    <rect x="146" y="150" width="28" height="132" fill="url(#fg-ribbon)"/>
  </g>
  <g class="fgift__lid">
    <rect x="46" y="118" width="228" height="36" rx="8" fill="url(#fg-box)" stroke="#e2cf9f"/>
    <rect x="144" y="118" width="32" height="36" fill="url(#fg-ribbon)"/>
    <path d="M160 118 C 128 78, 86 86, 100 108 C 110 122, 140 120, 160 118 Z" fill="url(#fg-ribbon)"/>
    <path d="M160 118 C 192 78, 234 86, 220 108 C 210 122, 180 120, 160 118 Z" fill="url(#fg-ribbon)"/>
    <circle cx="160" cy="116" r="9" fill="#c9a14f"/>
  </g>
</svg>`;

export async function mount(el, content, deck) {
  const f = content.site.finale;
  const { person, event } = content.site;
  let timers = [];

  const gift = h('div', { class: 'fgift', 'aria-hidden': 'true' },
    h('span', { class: 'fgift__glow' }),
    h('span', { class: 'fgift__rays' }),
    h('span', { class: 'fgift__fifty' }, '50'),
    h('span', { class: 'fgift__sparks' }, Array.from({ length: 10 }, (_, i) => h('i', { style: { '--i': i } }))),
    h('span', { html: GIFT_SVG }),
  );

  function celebrate({ big = true } = {}) {
    el.classList.remove('is-open');
    void el.offsetWidth; // restart the opening
    el.classList.add('is-open');
    confetti({ mode: 'rain', count: big ? 150 : 90, colors: GOLD });
    if (big) timers.push(setTimeout(() => confetti({ x: 0.74, y: 0.62, count: 110, colors: GOLD }), 700));
  }

  el.append(h('div', { class: 'scene__frame finale' },
    h('div', { class: 'finale__text' },
      h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, f.eyebrow || 'A Final Gift of Love'),
      h('h2', { class: 'finale__title', id: 'finale-title', 'data-enter': '', style: { '--enter': 1 } }, f.headline),
      h('p', { class: 'finale__subline', 'data-enter': '', style: { '--enter': 2 } }, f.subline),
      h('p', { class: 'finale__message', 'data-enter': '', style: { '--enter': 3 } }, f.message),
      h('p', { class: 'finale__sign', 'data-enter': '', style: { '--enter': 4 } }, f.sign || 'With all our love, always'),
      h('div', { class: 'finale__details', 'data-enter': '', style: { '--enter': 5 } },
        h('p', { class: 'finale__name' }, person.fullName),
        h('p', { class: 'finale__detail' }, h('span', { html: icons.calendar }), event.dateLabel),
        h('p', { class: 'finale__detail' }, h('span', { html: icons.pin }), `${event.venue}, ${event.area}`),
      ),
      h('div', { class: 'finale__actions', 'data-enter': '', style: { '--enter': 6 } },
        h('button', { class: 'btn btn--celebrate', type: 'button', onclick: () => celebrate() }, h('span', { html: icons.sparkle }), 'Celebrate'),
        h('button', { class: 'btn', type: 'button', onclick: () => deck.go(0, { dir: -1, focus: true }) }, h('span', { html: icons.replay }), 'Start Again'),
      ),
      content.site.music?.credit ? h('p', { class: 'finale__credit' }, content.site.music.credit) : null,
    ),
    h('div', { class: 'finale__visual', 'data-enter': '', style: { '--enter': 2 } }, gift),
  ));

  return {
    hint: 'The closing words, with a gift that opens',
    enter() {
      el.classList.remove('is-open');
      timers.push(setTimeout(() => celebrate({ big: false }), 1600));
    },
    leave() {
      timers.forEach(clearTimeout);
      timers = [];
      el.classList.remove('is-open');
    },
  };
}
