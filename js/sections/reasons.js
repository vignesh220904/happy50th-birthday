// Chapter III — 50 Reasons We Love You.
// Concept: fifty lights. Five chapters of ten reasons, shown as a 3D
// constellation beside a reading card. Readers can pick a chapter, tap a light,
// step with previous/next, jump by number, or open "Read all 50" for a plain,
// fully accessible list. The text of each reason is exactly as the family wrote it.

import { h, icons, pad, roman, announce, prefersReducedMotion } from '../core/util.js';
import { chapterHead } from './shared.js';
import { mountConstellation } from '../three/constellation-scene.js';

export async function mount(el, content) {
  const { reasons, chapters, closing } = content.reasons;
  const byN = new Map(reasons.map((r) => [r.n, r]));
  const chapterIndexOf = (n) => chapters.findIndex((c) => n >= c.range[0] && n <= c.range[1]);

  let current = 1;
  let sky = null;

  // ---- Tabs ------------------------------------------------------------------
  const tabs = chapters.map((c, i) =>
    h('button', {
      class: 'rtab',
      type: 'button',
      role: 'tab',
      id: `rtab-${c.id}`,
      'aria-controls': 'reasons-panel',
      'aria-selected': 'false',
      tabindex: '-1',
      onclick: () => select(c.range[0]),
    },
    h('span', { class: 'rtab__num', 'aria-hidden': 'true' }, roman(i + 1)),
    h('span', { class: 'rtab__title' }, c.title),
    h('span', { class: 'rtab__range' }, `${c.range[0]}–${c.range[1]}`),
    ),
  );
  const tablist = h('div', { class: 'reasons__tabs', role: 'tablist', 'aria-label': 'Chapters of reasons' }, tabs);
  tablist.addEventListener('keydown', (e) => {
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    const next = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: tabs.length - 1 }[e.key];
    if (next == null) return;
    e.preventDefault();
    const t = (next + tabs.length) % tabs.length;
    tabs[t].focus();
    select(chapters[t].range[0]);
  });

  // ---- Reader card -------------------------------------------------------------
  const numEl = h('span', { class: 'reader__num' });
  const chapterEl = h('p', { class: 'reader__chapter' });
  const quote = h('blockquote', { class: 'reader__quote' });
  const prevBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous reason', html: icons.prev, onclick: () => select(current === 1 ? 50 : current - 1) });
  const nextBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Next reason', html: icons.next, onclick: () => select(current === 50 ? 1 : current + 1) });
  const position = h('p', { class: 'reader__position', 'aria-live': 'polite' });
  const chips = h('ol', { class: 'reader__chips', 'aria-label': 'Reasons in this chapter' });

  const reader = h('div', { class: 'reader glass', id: 'reasons-panel', role: 'tabpanel', tabindex: '0', 'aria-label': 'Reason' },
    h('div', { class: 'reader__head' }, numEl, chapterEl),
    quote,
    h('div', { class: 'reader__foot' }, prevBtn, position, nextBtn),
    chips,
  );
  reader.addEventListener('keydown', (e) => {
    if (e.target !== reader) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); nextBtn.click(); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); prevBtn.click(); }
  });

  // ---- Constellation -----------------------------------------------------------
  const tooltip = h('div', { class: 'sky__tooltip', 'aria-hidden': 'true', hidden: true });
  const fallbackDots = h('div', { class: 'sky__fallback', 'aria-hidden': 'true' },
    reasons.map((r) => h('span', { class: 'sky__dot', style: { '--i': r.n } })),
  );
  const skyEl = h('div', { class: 'sky' }, fallbackDots, tooltip,
    h('p', { class: 'sky__hint' }, 'Touch a light to read its reason'),
  );

  // ---- Read all ------------------------------------------------------------------
  const allList = h('div', { class: 'reasons__all', id: 'reasons-all', hidden: true },
    chapters.map((c, i) =>
      h('section', { class: 'rall' },
        h('h3', { class: 'rall__title' }, h('span', { 'aria-hidden': 'true' }, `${roman(i + 1)} · `), c.title),
        h('ol', { class: 'rall__list', start: c.range[0] },
          reasons.filter((r) => r.n >= c.range[0] && r.n <= c.range[1]).map((r) =>
            h('li', { class: 'rall__item' }, h('span', { class: 'rall__n', 'aria-hidden': 'true' }, pad(r.n)), h('span', {}, r.text)),
          ),
        ),
      ),
    ),
  );
  const allToggle = h('button', { class: 'btn btn--ghost', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'reasons-all' });
  const setAll = (open) => {
    allList.hidden = !open;
    allToggle.setAttribute('aria-expanded', String(open));
    allToggle.replaceChildren(h('span', { html: icons.list }), h('span', {}, open ? 'Close the list' : 'Read all 50 reasons'));
  };
  allToggle.addEventListener('click', () => {
    const open = allList.hidden;
    setAll(open);
    if (open) allList.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
  });
  setAll(false);

  el.append(
    h('div', { class: 'wrap' },
      chapterHead({
        num: 3,
        id: 'reasons-title',
        title: '50 Reasons <em>We Love You</em>',
        lede: 'Fifty lights, one for every year. Choose a chapter, touch a light, or read them all.',
      }),
      h('div', { class: 'reasons', 'data-reveal': '' },
        tablist,
        h('div', { class: 'reasons__body' }, skyEl, reader),
        h('div', { class: 'reasons__all-toggle' }, allToggle),
        allList,
        h('p', { class: 'reasons__closing' }, closing),
      ),
    ),
  );

  // ---- State -----------------------------------------------------------------------
  let lastChapter = -1;
  function select(n, { focusChip = false } = {}) {
    const r = byN.get(n);
    if (!r) return;
    const prevN = current;
    current = n;
    const ci = chapterIndexOf(n);
    const ch = chapters[ci];

    tabs.forEach((t, i) => {
      t.setAttribute('aria-selected', String(i === ci));
      t.tabIndex = i === ci ? 0 : -1;
    });
    reader.setAttribute('aria-labelledby', tabs[ci].id);
    numEl.textContent = pad(n);
    chapterEl.textContent = ch.title;
    position.textContent = `Reason ${n} of 50`;

    const p = h('p', { class: 'reader__text' }, r.text);
    if (!prefersReducedMotion() && prevN !== n) {
      p.animate([{ opacity: 0, transform: `translateY(${n > prevN ? 14 : -14}px)`, filter: 'blur(4px)' }, { opacity: 1, transform: 'none', filter: 'blur(0)' }], { duration: 560, easing: 'cubic-bezier(.16,1,.3,1)' });
    }
    quote.replaceChildren(p);

    if (ci !== lastChapter) {
      lastChapter = ci;
      chips.replaceChildren(...Array.from({ length: ch.range[1] - ch.range[0] + 1 }, (_, k) => {
        const num = ch.range[0] + k;
        return h('li', {}, h('button', { class: 'chip', type: 'button', 'data-n': num, 'aria-label': `Reason ${num}`, onclick: () => select(num, { focusChip: true }) }, pad(num)));
      }));
      sky?.scene.setChapter(ci);
      skyEl.style.setProperty('--chapter', ci);
    }
    chips.querySelectorAll('.chip').forEach((c) => {
      const on = Number(c.dataset.n) === n;
      c.classList.toggle('is-active', on);
      if (on) c.setAttribute('aria-current', 'true'); else c.removeAttribute('aria-current');
      if (on && focusChip) c.focus();
    });
    fallbackDots.querySelectorAll('.sky__dot').forEach((d, i) => {
      d.classList.toggle('is-chapter', chapterIndexOf(i + 1) === ci);
      d.classList.toggle('is-active', i + 1 === n);
    });
    sky?.scene.setSelected(n);
    if (prevN !== n) announce(`Reason ${n}: ${r.text}`);
  }

  select(1);

  mountConstellation(skyEl, {
    chapters,
    onSelect: (n) => select(n),
    onHover: (info) => {
      if (!info) { tooltip.hidden = true; return; }
      const box = skyEl.getBoundingClientRect();
      tooltip.hidden = false;
      tooltip.textContent = `Reason ${info.n}`;
      tooltip.style.transform = `translate(${info.x - box.left + 14}px, ${info.y - box.top - 10}px)`;
    },
  }).then((controller) => {
    sky = controller;
    if (sky) {
      sky.scene.setChapter(chapterIndexOf(current));
      sky.scene.setSelected(current);
    }
  });
}
