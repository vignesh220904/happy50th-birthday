// Chapter VI — Age 1 to 50.
// Plays the real photographs from "Age 1 to 50" in order of age (ages are read
// from the file names: "34.jpg", "34 (2).jpg", "34.1.jpg"…) as a 3D reel: the
// current photograph stands in front while the years before and after fan out
// into the distance. Ages without a photograph are shown honestly as gaps on
// the age ruler — nothing is invented.

import { h, icons, pad, onSwipe, announce, prefersReducedMotion, watchVisibility } from '../core/util.js';
import { picture, yearsForAge } from '../core/data.js';
import { openLightbox } from '../core/lightbox.js';
import { chapterHead, filmButton } from './shared.js';

const STEP_MS = 2000;

export async function mount(el, content) {
  const photos = content.media.collection('age')
    .filter((p) => Number.isFinite(p.age))
    .sort((a, b) => a.age - b.age || a.variant - b.variant);
  const ages = [...new Set(photos.map((p) => p.age))];
  const countAt = (age) => photos.filter((p) => p.age === age).length;
  const ending = content.site.age?.ending || '';

  let index = 0, timer = null, ended = false;

  const ageNum = h('span', { class: 'age__num' });
  const ageYears = h('span', { class: 'age__years' });
  const ageCount = h('span', { class: 'age__count' });
  const frame = h('div', { class: 'age__frame' });
  const endCard = h('div', { class: 'age__end', hidden: true },
    h('span', { class: 'age__end-num', 'aria-hidden': 'true' }, '50'),
    h('p', { class: 'age__end-date' }, content.site.event.dateLabel),
    h('p', { class: 'age__end-text' }, ending),
  );

  const playBtn = h('button', { class: 'btn btn--primary age__play', type: 'button' });
  const prevBtn = h('button', { class: 'icon-btn icon-btn--lg', type: 'button', 'aria-label': 'Previous photo', html: icons.prev });
  const nextBtn = h('button', { class: 'icon-btn icon-btn--lg', type: 'button', 'aria-label': 'Next photo', html: icons.next });
  const replayBtn = h('button', { class: 'icon-btn icon-btn--lg', type: 'button', 'aria-label': 'Replay from age 1', html: icons.replay });

  const ruler = h('div', { class: 'age__ruler', role: 'group', 'aria-label': 'Choose an age' },
    Array.from({ length: 50 }, (_, k) => {
      const age = k + 1;
      const n = countAt(age);
      return n
        ? h('button', { class: 'age__tick has-photo', type: 'button', 'data-age': age, 'aria-label': `Age ${age}, ${n} photo${n > 1 ? 's' : ''}`, onclick: () => { stop(); jumpToAge(age); } },
          h('span', { class: 'age__tick-label' }, age))
        : h('span', { class: 'age__tick', 'data-age': age, title: `Age ${age}: no photograph yet`, 'aria-hidden': 'true' },
          h('span', { class: 'age__tick-label' }, age));
    }),
  );

  const viewer = h('div', { class: 'age', role: 'region', 'aria-label': 'Age 1 to 50 photographs. Use the arrow keys to step through.', tabindex: '0' },
    h('div', { class: 'age__stage' },
      h('div', { class: 'age__readout', 'aria-live': 'polite' },
        h('span', { class: 'age__label' }, 'Age'),
        ageNum,
        ageYears,
        ageCount,
      ),
      h('div', { class: 'age__photo' }, frame, endCard),
    ),
    h('div', { class: 'age__controls' }, prevBtn, playBtn, nextBtn, replayBtn),
    h('div', { class: 'age__ruler-wrap' }, ruler),
    h('p', { class: 'age__legend' },
      h('span', { class: 'age__legend-dot', 'aria-hidden': 'true' }),
      `${ages.length} of 50 ages have photographs so far. More can be added at any time.`,
    ),
  );

  el.append(
    h('div', { class: 'wrap' },
      chapterHead({
        num: 6,
        id: 'age-title',
        title: 'Age 1 <em>to</em> 50',
        lede: 'Fifty years, one face we love. Press play and watch the years go by.',
        actions: [filmButton(content, 'film-age')],
      }),
      viewer,
    ),
  );

  if (!photos.length) {
    frame.append(h('p', { class: 'empty-note' }, 'Photographs will appear here once they are added to the “Age 1 to 50” folder.'));
    playBtn.disabled = prevBtn.disabled = nextBtn.disabled = replayBtn.disabled = true;
    return;
  }

  // ---- The reel: one card per photograph, laid out around the current one ----
  const VISIBLE = 5; // cards shown on each side
  const lightboxList = photos.map((x) => ({ media: x, alt: `Buvana at age ${x.age}`, caption: `Age ${x.age}`, meta: yearsForAge(x.age) }));
  const cards = photos.map((p, i) => {
    const card = h('button', {
      class: 'age__card is-hidden',
      type: 'button',
      tabindex: '-1',
      'aria-hidden': 'true',
      style: { '--ar': (p.width / p.height).toFixed(3) },
      onclick: () => {
        if (i === index) openLightbox(lightboxList, i);
        else { stop(); show(i); }
      },
    },
    picture(p, { alt: '', className: 'age__img', sizes: '(max-width: 820px) 80vw, 46vw' }),
    h('span', { class: 'age__card-age', 'aria-hidden': 'true' }, p.age),
    );
    frame.append(card);
    return card;
  });

  function layoutReel() {
    // Widths in cqw (percent of the reel's width): side cards start just past the
    // current card whatever its shape, then stack closer and closer into depth.
    const box = frame.getBoundingClientRect();
    const maxW = box.width && box.width < 600 ? 74 : 52;
    frame.style.setProperty('--card-max', maxW);
    const widthOf = (p) => (box.width ? Math.min(maxW, (78 * box.height * (p.width / p.height)) / box.width) : 40);
    const xs = new Map();
    for (const s of [-1, 1]) {
      let x = widthOf(photos[index]) / 2;
      for (let a = 1; a <= VISIBLE + 2; a++) {
        const i = index + s * a;
        if (i < 0 || i >= photos.length) break;
        // a card turned 50° shows about a third of its width
        x = a === 1 ? x + 0.34 * widthOf(photos[i]) + 3 : x + (a <= VISIBLE ? 8.5 : 4);
        xs.set(i, s * x);
      }
    }
    cards.forEach((c, i) => {
      const o = i - index, a = Math.abs(o), s = Math.sign(o);
      // cards just beyond the edge stay ready (invisible) so they can glide in
      c.classList.toggle('is-hidden', a > VISIBLE + 2);
      c.classList.toggle('is-current', a === 0);
      c.style.setProperty('--x', a === 0 ? 0 : xs.get(i) ?? s * 120);
      const shown = Math.min(a, VISIBLE + 1);
      c.style.setProperty('--z', a === 0 ? 0 : -300 - (shown - 1) * 110);
      c.style.setProperty('--ry', a === 0 ? 0 : -s * 50);
      c.style.setProperty('--op', a > VISIBLE ? 0 : 1 - a * 0.12);
      c.style.zIndex = String(100 - a);
      const img = c.querySelector('img');
      if (a === 0) {
        const p = photos[i];
        const n = countAt(p.age);
        const which = photos.filter((x) => x.age === p.age).indexOf(p) + 1;
        const alt = `Buvana at age ${p.age}${n > 1 ? `, photo ${which} of ${n}` : ''}`;
        img.alt = alt;
        c.setAttribute('aria-label', `View larger: ${alt}`);
        c.removeAttribute('aria-hidden');
        c.tabIndex = 0;
      } else {
        img.alt = '';
        c.removeAttribute('aria-label');
        c.setAttribute('aria-hidden', 'true');
        c.tabIndex = -1;
      }
    });
  }

  function show(i) {
    ended = false;
    endCard.hidden = true;
    viewer.classList.remove('is-ended');
    index = (i + photos.length) % photos.length;
    const p = photos[index];
    const n = countAt(p.age);
    const which = photos.filter((x) => x.age === p.age).indexOf(p) + 1;
    layoutReel();

    const ageChanged = ageNum.textContent !== String(p.age);
    ageNum.textContent = p.age;
    ageYears.textContent = yearsForAge(p.age);
    ageCount.textContent = n > 1 ? `Photo ${which} of ${n}` : '';
    if (ageChanged && !prefersReducedMotion()) ageNum.animate([{ opacity: 0, transform: 'translateY(18px)' }, { opacity: 1, transform: 'none' }], { duration: 520, easing: 'cubic-bezier(.16,1,.3,1)' });

    ruler.querySelectorAll('.age__tick').forEach((t) => {
      const a = Number(t.dataset.age);
      t.classList.toggle('is-active', a === p.age);
      t.classList.toggle('is-past', a < p.age);
    });
    const active = ruler.querySelector('.age__tick.is-active');
    const wrap = ruler.parentElement;
    if (active && wrap.scrollWidth > wrap.clientWidth) {
      wrap.scrollTo({ left: active.offsetLeft - wrap.clientWidth / 2, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  function showEnding() {
    ended = true;
    stop();
    endCard.hidden = false;
    viewer.classList.add('is-ended');
    ageNum.textContent = '50';
    ageYears.textContent = content.site.event.dateLabel;
    ageCount.textContent = '';
    ruler.querySelectorAll('.age__tick').forEach((t) => { t.classList.remove('is-active'); t.classList.add('is-past'); });
    announce(ending);
  }

  const jumpToAge = (age) => show(photos.findIndex((p) => p.age === age));
  const step = (d) => {
    if (ended && d > 0) return show(0);
    if (ended && d < 0) return show(photos.length - 1);
    if (d > 0 && index === photos.length - 1) return showEnding();
    show(index + d);
  };

  function setPlayLabel() {
    const on = !!timer;
    playBtn.replaceChildren(h('span', { html: on ? icons.pause : icons.play }), h('span', {}, on ? 'Pause' : ended ? 'Play again' : 'Play the years'));
    playBtn.setAttribute('aria-pressed', String(on));
  }
  function play() {
    if (ended) show(0);
    clearInterval(timer);
    timer = setInterval(() => step(1), STEP_MS);
    setPlayLabel();
  }
  function stop() {
    clearInterval(timer);
    timer = null;
    setPlayLabel();
  }

  playBtn.addEventListener('click', () => (timer ? stop() : play()));
  prevBtn.addEventListener('click', () => { stop(); step(-1); });
  nextBtn.addEventListener('click', () => { stop(); step(1); });
  replayBtn.addEventListener('click', () => { show(0); play(); });
  viewer.addEventListener('keydown', (e) => {
    if (e.target.closest('dialog')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); stop(); step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); stop(); step(-1); }
    if (e.key === ' ' && e.target === viewer) { e.preventDefault(); playBtn.click(); }
  });
  onSwipe(frame, { left: () => { stop(); step(1); }, right: () => { stop(); step(-1); } });
  watchVisibility(viewer, (visible) => { if (!visible && timer) stop(); });

  show(0);
  setPlayLabel();
  new ResizeObserver(() => layoutReel()).observe(frame);
}
