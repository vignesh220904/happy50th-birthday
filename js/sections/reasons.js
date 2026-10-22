// 50 Reasons We Love You (data/reasons.json).
// The family's five groups of ten. Each group gathers as a gentle cloud of
// floating bubbles: the ten reasons appear one after another and drift
// softly in place, large enough to read from the back of the room. Next (or
// automatic playback) moves to the next group; the group names along the top
// show where we are and can be tapped. All 50 reasons appear across the five
// groups, each exactly once, in the family's own words.

import { h, icons, fitText, announce } from '../core/util.js';

const GROUP_MS = 18000;  // ten reasons: about 4 s to gather, then time to read them

export async function mount(el, content) {
  const { reasons, chapters, closing } = content.reasons;
  const inChapter = (c) => reasons.filter((r) => r.n >= c.range[0] && r.n <= c.range[1]);
  let view = 0;

  const tabs = chapters.map((c, i) => h('button', {
    class: 'rgroup',
    type: 'button',
    'aria-pressed': 'false',
    'aria-controls': 'reasons-cloud',
    onclick: () => show(i),
  }, h('span', { class: 'rgroup__title' }, c.title), h('span', { class: 'rgroup__range' }, `${c.range[0]}–${c.range[1]}`)));

  const groupTitle = h('p', { class: 'reasons__group' });
  const cloud = h('ol', { class: 'rcloud', id: 'reasons-cloud', 'aria-live': 'polite' });
  const closingEl = h('p', { class: 'reasons__closing' }, closing);

  el.append(h('div', { class: 'scene__frame reasons' },
    h('header', { class: 'reasons__head' },
      h('div', {},
        h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, 'From all of us, with love'),
        h('h2', { class: 'scene-title', id: 'reasons-title', 'data-enter': '', style: { '--enter': 1 }, html: '50 Reasons <em>We Love You</em>' }),
      ),
      h('div', { class: 'reasons__groups', role: 'group', 'aria-label': 'Groups of reasons', 'data-enter': '', style: { '--enter': 2 } }, tabs),
    ),
    groupTitle,
    cloud,
    closingEl,
  ));

  // a gentle, varied drift so the cloud feels alive without anything racing about
  const bubble = (r, k) => h('li', {
    class: `rbubble rbubble--${k % 3}`,
    style: { '--k': k, '--drift': `${7 + (k % 4) * 1.3}s`, '--phase': `${-(k * 1.7) % 6}s`, '--tilt': `${((k * 37) % 5) - 2}deg` },
  },
  h('span', { class: 'rbubble__n', 'aria-hidden': 'true' }, h('span', { html: icons.heart }), h('b', {}, r.n)),
  h('span', { class: 'rbubble__text' }, h('span', { class: 'visually-hidden' }, `Reason ${r.n}: `), r.text));

  function show(i) {
    view = Math.max(0, Math.min(chapters.length - 1, i));
    const c = chapters[view];
    tabs.forEach((b, k) => {
      b.setAttribute('aria-pressed', String(k === view));
      b.classList.toggle('is-past', k < view);
    });
    groupTitle.replaceChildren(h('span', { class: 'ornament', 'aria-hidden': 'true' }), h('span', {}, c.title), h('span', { class: 'ornament', 'aria-hidden': 'true' }));
    cloud.setAttribute('start', c.range[0]);
    cloud.replaceChildren(...inChapter(c).map(bubble));
    closingEl.classList.toggle('is-shown', view === chapters.length - 1);
    announce(`${c.title}: reasons ${c.range[0]} to ${c.range[1]}.`);
    cloud.classList.remove('is-shown');
    requestAnimationFrame(() => { fit(); requestAnimationFrame(() => cloud.classList.add('is-shown')); });
  }

  function fit() {
    fitText(cloud, { min: 0.6 });
  }

  show(0);

  return {
    hint: `${chapters.length} groups of ten`,
    enter({ atEnd }) { show(atEnd ? chapters.length - 1 : 0); },
    step(dir) {
      const target = view + dir;
      if (target < 0 || target >= chapters.length) return false;
      show(target);
      return true;
    },
    steps: () => ({ index: view, count: chapters.length, label: chapters[view].title }),
    auto: () => GROUP_MS,
    fit,
  };
}
