// Scene 5 — 50 Reasons We Love You (data/reasons.json).
// Five categories of ten. Choosing a category shows all ten of its reasons
// together, in two columns of cards. "All 50" shows every reason at once, one
// column per category. Next walks through the five categories and "All 50",
// then on to the Family Album. The wording of each reason is exactly the family's.

import { h, pad, roman, fitText, announce } from '../core/util.js';

export async function mount(el, content) {
  const { reasons, chapters, closing } = content.reasons;
  const inChapter = (c) => reasons.filter((r) => r.n >= c.range[0] && r.n <= c.range[1]);
  const views = [...chapters.map((c, i) => ({ id: c.id, title: c.title, num: roman(i + 1), range: `${c.range[0]}–${c.range[1]}` })), { id: 'all', title: 'All 50 Reasons', num: '50', range: '1–50' }];
  let view = 0;

  const buttons = views.map((v, i) => h('button', {
    class: `rcat ${v.id === 'all' ? 'rcat--all' : ''}`,
    type: 'button',
    'aria-pressed': 'false',
    'aria-controls': 'reasons-panel',
    onclick: () => show(i),
  },
  h('span', { class: 'rcat__num', 'aria-hidden': 'true' }, v.num),
  h('span', { class: 'rcat__text' }, h('span', { class: 'rcat__title' }, v.title), h('span', { class: 'rcat__range' }, `Reasons ${v.range}`)),
  ));

  const panel = h('div', { class: 'reasons__panel', id: 'reasons-panel', 'aria-live': 'polite' });
  const closingEl = h('p', { class: 'reasons__closing' }, closing);

  el.append(h('div', { class: 'scene__frame reasons' },
    h('header', { class: 'reasons__head' },
      h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, 'From all of us, with love'),
      h('h2', { class: 'scene-title', id: 'reasons-title', 'data-enter': '', style: { '--enter': 1 }, html: '50 Reasons <em>We Love You</em>' }),
    ),
    h('div', { class: 'reasons__cats', role: 'group', 'aria-label': 'Categories of reasons', 'data-enter': '', style: { '--enter': 2 } }, buttons),
    panel,
    closingEl,
  ));

  const reasonCard = (r, k) => h('li', { class: 'rcard', style: { '--k': k } },
    h('span', { class: 'rcard__n', 'aria-hidden': 'true' }, pad(r.n)),
    h('p', { class: 'rcard__text' }, h('span', { class: 'visually-hidden' }, `Reason ${r.n}: `), r.text),
  );

  function show(i) {
    view = Math.max(0, Math.min(views.length - 1, i));
    const v = views[view];
    buttons.forEach((b, k) => b.setAttribute('aria-pressed', String(k === view)));
    if (v.id === 'all') {
      panel.className = 'reasons__panel reasons__panel--all';
      panel.replaceChildren(...chapters.map((c, ci) => h('section', { class: 'rcol', style: { '--k': ci } },
        h('h3', { class: 'rcol__title' }, h('span', { class: 'rcol__num', 'aria-hidden': 'true' }, roman(ci + 1)), c.title),
        h('ol', { class: 'rcol__list' }, inChapter(c).map((r) => h('li', { class: 'rcol__item' },
          h('span', { class: 'rcol__n', 'aria-hidden': 'true' }, r.n), h('span', {}, r.text)))),
      )));
      announce('All 50 reasons are shown.');
    } else {
      const c = chapters[view];
      panel.className = 'reasons__panel';
      panel.replaceChildren(
        h('h3', { class: 'visually-hidden' }, c.title),
        h('ol', { class: 'reasons__grid', start: c.range[0] }, inChapter(c).map(reasonCard)),
      );
      announce(`${c.title}: reasons ${c.range[0]} to ${c.range[1]} are shown.`);
    }
    panel.classList.remove('is-shown');
    requestAnimationFrame(() => { fit(); requestAnimationFrame(() => panel.classList.add('is-shown')); });
  }

  function fit() {
    fitText(panel, { min: 0.55 });
  }

  show(0);

  return {
    hint: 'Five categories, then all 50 together',
    enter({ atEnd }) { show(atEnd ? views.length - 1 : 0); },
    step(dir) {
      const target = view + dir;
      if (target < 0 || target >= views.length) return false;
      show(target);
      return true;
    },
    steps: () => ({ index: view, count: views.length, label: views[view].title }),
    fit,
  };
}
