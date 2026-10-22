// Scene 9 — The 50-Gift Celebration, the closing scene.
// Left: the family's final greeting with her name, the date and the venue.
// Right: a 3D Ramar-blue gift in a ring of 50 small gifts (WebGL, with a CSS
// fallback), and a tracker of 50 numbered gifts for the gift distribution.
//
// Gifts are only ever shown as given when the host marks them (tap a gift, or
// "Mark all given"); the marks are remembered on this computer so a refresh
// during the event does not lose them. Names from data/gifts.json appear on
// the gifts once the family fills them in. Nothing is invented.

import { h, icons, pad } from '../core/util.js';
import { confetti } from '../core/confetti.js';
import { mountGiftScene } from '../three/gift-scene.js';

const STORE_KEY = 'buvana50.giftsGiven';

function loadMarks() {
  try { return new Set(JSON.parse(localStorage.getItem(STORE_KEY) || '[]')); } catch { return new Set(); }
}
function saveMarks(set) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify([...set])); } catch { /* private mode: marks last for this visit */ }
}

export async function mount(el, content, deck) {
  const f = content.site.finale;
  const { person, event } = content.site;
  const total = content.gifts?.total || 50;
  const gifts = Array.from({ length: total }, (_, i) => content.gifts?.gifts?.find((g) => g.n === i + 1) || { n: i + 1 });
  const marks = loadMarks();
  gifts.forEach((g) => { if (g.given === true) marks.add(g.n); });

  // ---- 3D gift ---------------------------------------------------------------
  const sceneEl = h('div', { class: 'finale__scene', 'aria-hidden': 'true' },
    h('div', { class: 'finale__fallback' }, h('span', { class: 'cssgift' }, h('span', { class: 'cssgift__lid' }), h('span', { class: 'cssgift__box' }))),
  );
  let gift = null;

  // ---- Gift tracker --------------------------------------------------------------
  const counterNum = h('span', { class: 'gcount__num' }, '0');
  const counterRing = h('span', { class: 'gcount__ring', 'aria-hidden': 'true' });
  const counter = h('p', { class: 'gcount', 'aria-live': 'polite' },
    counterRing, h('span', { class: 'gcount__text' }, counterNum, h('span', { class: 'gcount__of' }, ` / ${total}`), h('span', { class: 'gcount__label' }, 'gifts given')));
  const tiles = gifts.map((g, i) => h('button', {
    class: 'gtile',
    type: 'button',
    style: { '--i': i },
    'aria-pressed': 'false',
    title: g.name ? `${g.name}${g.from ? ` — from ${g.from}` : ''}` : `Gift ${g.n}`,
    onclick: () => toggle(g.n),
  },
  h('span', { class: 'gtile__icon', html: icons.gift }),
  h('span', { class: 'gtile__num' }, pad(g.n)),
  g.name ? h('span', { class: 'gtile__name' }, g.name) : null,
  h('span', { class: 'gtile__check', html: icons.check }),
  ));
  const resetBtn = h('button', { class: 'btn', type: 'button', onclick: () => reset() }, h('span', { html: icons.replay }), 'Reset');
  const allBtn = h('button', { class: 'btn', type: 'button', onclick: () => markAll() }, h('span', { html: icons.check }), 'Mark all given');

  function render() {
    tiles.forEach((t, i) => {
      const on = marks.has(i + 1);
      t.classList.toggle('is-given', on);
      t.setAttribute('aria-pressed', String(on));
      t.setAttribute('aria-label', `Gift ${i + 1}${gifts[i].name ? `: ${gifts[i].name}` : ''}. ${on ? 'Given' : 'Not given yet'}. Tap to ${on ? 'unmark' : 'mark as given'}.`);
    });
    counterNum.textContent = marks.size;
    counterRing.style.setProperty('--p', marks.size / total);
    counter.classList.toggle('is-complete', marks.size === total);
    allBtn.disabled = marks.size === total;
    gift?.scene.setGiven([...marks].map((n) => n - 1));
  }
  function toggle(n) {
    if (marks.has(n)) marks.delete(n); else marks.add(n);
    saveMarks(marks);
    render();
    if (marks.size === total) celebrate();
  }
  let armed = null;
  function confirmTwice(btn, label, action) {
    if (armed === btn) { armed = null; btn.lastChild.textContent = label; action(); return; }
    armed = btn;
    const original = label;
    btn.lastChild.textContent = 'Click again to confirm';
    setTimeout(() => { if (armed === btn) { armed = null; btn.lastChild.textContent = original; } }, 3500);
  }
  function markAll() {
    confirmTwice(allBtn, 'Mark all given', () => {
      gifts.forEach((g) => marks.add(g.n));
      saveMarks(marks);
      render();
      celebrate();
    });
  }
  function reset() {
    confirmTwice(resetBtn, 'Reset', () => {
      marks.clear();
      saveMarks(marks);
      render();
      gift?.scene.setOpen(false);
      el.classList.remove('is-open');
    });
  }
  function celebrate() {
    el.classList.add('is-open');
    gift?.scene.setOpen(true);
    confetti({ x: 0.72, y: 0.55, count: 160 });
    setTimeout(() => confetti({ mode: 'rain', count: 200 }), 500);
  }

  // ---- Layout ------------------------------------------------------------------------
  el.append(h('div', { class: 'scene__frame finale' },
    h('div', { class: 'finale__text' },
      h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, 'With all our love'),
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
        h('button', { class: 'btn btn--primary', type: 'button', onclick: () => celebrate() }, h('span', { html: icons.sparkle }), 'Celebrate'),
        h('button', { class: 'btn btn--gold', type: 'button', onclick: () => deck.go(0, { dir: -1, focus: true }) }, h('span', { html: icons.home }), 'Back to the welcome'),
      ),
      content.site.music?.credit ? h('p', { class: 'finale__credit' }, content.site.music.credit) : null,
    ),
    h('div', { class: 'finale__gifts' },
      h('div', { class: 'finale__stage', 'data-enter': '', style: { '--enter': 1 } }, sceneEl,
        h('p', { class: 'finale__stage-title' }, h('span', {}, `${total} Gifts`), h('em', {}, `for ${total} beautiful years`))),
      h('section', { class: 'gtracker', 'aria-label': 'Gift distribution', 'data-enter': '', style: { '--enter': 3 } },
        h('div', { class: 'gtracker__head' }, counter, h('div', { class: 'gtracker__actions' }, allBtn, resetBtn)),
        h('div', { class: 'gtracker__grid no-swipe' }, tiles),
      ),
    ),
  ));

  render();
  mountGiftScene(sceneEl, { count: total }).then((c) => { gift = c; render(); });

  return {
    hint: `${total} gifts for ${total} years`,
    enter({ dir }) {
      if (dir > 0) setTimeout(() => confetti({ mode: 'rain', count: 120 }), 900);
    },
  };
}
