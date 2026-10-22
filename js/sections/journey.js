// Chapter II — Her Life Journey, 1976–2026.
// With WebGL, the journey is a real 3D flight (three/journey-scene.js): the
// camera travels a glowing river of time past each milestone's photographs,
// while the year, title and caption appear beside them.
// Without WebGL (or with reduced motion) it falls back to a documentary-style
// viewer with photographs in CSS 3D depth over a blurred backdrop.
// Navigation: previous/next, a milestone rail, ← → / Home / End keys, swipe,
// and an optional autoplay for the venue screen.

import { h, icons, pad, onSwipe, announce, prefersReducedMotion, watchVisibility, $$ } from '../core/util.js';
import { picture, url } from '../core/data.js';
import { openLightbox } from '../core/lightbox.js';
import { chapterHead, filmButton, mediaLabel } from './shared.js';
import { hrefFor } from '../core/nav.js';
import { webglAvailable } from '../three/stage.js';
import { mountJourneyScene } from '../three/journey-scene.js';

const AUTOPLAY_MS = 7000;
// "1979 – 1993" → "1979", "1980s" → "1980s", "27 October 2026" → "2026" (for the compact rail)
const shortYear = (y) => (y.match(/\d{4}s|\d{4}/) || [y])[0];

export async function mount(el, content) {
  const { eras, milestones } = content.timeline;
  const eraTitle = Object.fromEntries(eras.map((e) => [e.id, e.title]));
  const resolve = (m) => m.media.map((ref) => ({ ...ref, item: content.media.get(ref.id) })).filter((r) => r.item);

  let index = 0, timer = null;
  let mode = webglAvailable() && !prefersReducedMotion() ? '3d' : 'css';
  let space = null; // 3D controller once mounted
  const spaceEl = h('div', { class: 'journey__space', 'aria-hidden': 'true' });
  const lightboxFor = (m) => resolve(m).map((r) => ({ media: r.item, alt: r.alt, caption: `${m.year} · ${m.title}`, meta: r.item.kind === 'illustration' ? 'An illustration, not an original photograph.' : m.caption }));

  const backdrop = h('div', { class: 'journey__backdrop', 'aria-hidden': 'true' });
  const stage = h('div', { class: 'journey__stage' });
  const counter = h('p', { class: 'journey__counter', 'aria-hidden': 'true' });
  const prevBtn = h('button', { class: 'icon-btn icon-btn--lg', type: 'button', 'aria-label': 'Previous milestone', html: icons.prev });
  const nextBtn = h('button', { class: 'icon-btn icon-btn--lg', type: 'button', 'aria-label': 'Next milestone', html: icons.next });
  const playBtn = h('button', { class: 'btn btn--ghost journey__play', type: 'button', 'aria-pressed': 'false' });
  const fill = h('span', { class: 'journey__rail-fill', 'aria-hidden': 'true' });

  // ---- Milestone rail (eras above, one stop per milestone) -------------------
  const stops = milestones.map((m, i) =>
    h('li', {},
      h('button', {
        class: 'journey__stop',
        type: 'button',
        'aria-label': `${m.year}: ${m.title}`,
        onclick: () => { stopAutoplay(); go(i); },
      }, h('span', { class: 'journey__stop-dot', 'aria-hidden': 'true' }), h('span', { class: 'journey__stop-year' }, shortYear(m.year))),
    ),
  );
  const eraBands = eras.map((era) => {
    const first = milestones.findIndex((m) => m.era === era.id);
    const count = milestones.filter((m) => m.era === era.id).length;
    return h('span', { class: 'journey__era', style: { gridColumn: `${first + 1} / span ${count}` }, title: era.title }, era.title);
  });
  const railList = h('ol', { class: 'journey__stops', style: { '--count': milestones.length } }, stops);
  const rail = h('nav', { class: 'journey__rail', 'aria-label': 'Life journey milestones' },
    h('div', { class: 'journey__rail-track', style: { '--count': milestones.length } },
      h('div', { class: 'journey__eras', 'aria-hidden': 'true' }, eraBands),
      h('div', { class: 'journey__line', 'aria-hidden': 'true' }, fill),
      railList,
    ),
  );

  const viewer = h('div', {
    class: `journey ${mode === '3d' ? 'journey--3d' : ''}`,
    role: 'region',
    'aria-roledescription': 'carousel',
    'aria-label': 'Her life journey, 1976 to 2026. Use the left and right arrow keys to move between milestones.',
    tabindex: '0',
  },
  mode === '3d' ? spaceEl : null,
  backdrop,
  stage,
  h('div', { class: 'journey__controls wrap' },
    h('div', { class: 'journey__buttons' }, prevBtn, counter, nextBtn),
    playBtn,
  ),
  rail,
  );

  el.append(
    h('div', { class: 'wrap' },
      chapterHead({
        num: 2,
        id: 'journey-title',
        title: 'Her Life Journey <em>1976 – 2026</em>',
        lede: 'From a little girl in a black-and-white portrait to the heart of a family: fifty years, one chapter at a time.',
        actions: [filmButton(content, 'film-life-journey')],
      }),
    ),
    viewer,
  );

  // ---- Scenes --------------------------------------------------------------
  function buildScene(m, i) {
    const media = resolve(m);
    const layout = media.length === 0 ? 'type' : media.length === 1 ? 'single' : media.length === 2 ? 'duo' : 'cluster';
    const lightboxItems = lightboxFor(m);

    const frames = media.map((r, k) =>
      h('button', {
        class: `jframe jframe--${k === 0 ? 'main' : 'side'} ${r.item.kind === 'illustration' ? 'is-illustration' : ''}`,
        type: 'button',
        style: { '--k': k, '--ar': (r.item.width / r.item.height).toFixed(3) },
        'aria-label': `View larger: ${r.alt}`,
        onclick: () => openLightbox(lightboxItems, k),
      },
      picture(r.item, { alt: r.alt, eager: i === 0 && k === 0, sizes: k === 0 ? '(max-width: 760px) 86vw, 46vw' : '(max-width: 760px) 40vw, 22vw', className: 'jframe__img' }),
      mediaLabel(r.item),
      ),
    );

    let visual;
    if (mode === '3d') {
      visual = null; // the photographs live in the 3D space behind the text
    } else if (layout === 'type') {
      const big = m.id === 'fifty' ? '50' : m.year.replace(/\s/g, '').split('–')[0];
      visual = h('div', { class: `jtype ${m.id === 'fifty' ? 'jtype--fifty' : ''}`, 'aria-hidden': 'true' },
        h('span', { class: 'jtype__num' }, big),
        h('span', { class: 'jtype__ring' }),
      );
    } else {
      visual = h('div', { class: `jframes jframes--${layout}`, style: { '--n': media.length } }, frames);
    }

    const note = m.noPhoto || (media.some((r) => r.item.kind === 'illustration') ? 'Scenes marked “Illustration” are drawings created for this story, not original photographs.' : '');
    const extra = m.id === 'fifty'
      ? h('a', { class: 'btn btn--gold jscene__cta', href: hrefFor('finale') }, h('span', { html: icons.gift }), 'To the celebration')
      : mode === '3d' && media.length
        ? h('button', { class: 'btn btn--ghost jscene__cta', type: 'button', onclick: () => openLightbox(lightboxItems, 0) },
          h('span', { html: icons.expand }), media.length > 1 ? `View the ${media.length} photos` : 'View the photo')
        : null;

    return h('article', { class: `jscene jscene--${layout}`, 'aria-roledescription': 'slide', 'aria-label': `${i + 1} of ${milestones.length}` },
      h('div', { class: 'jscene__text' },
        h('p', { class: 'jscene__era' }, eraTitle[m.era] || ''),
        h('p', { class: `jscene__year ${m.year.length > 6 ? 'jscene__year--long' : ''}` }, m.year),
        h('h3', { class: 'jscene__title' }, m.title),
        h('p', { class: 'jscene__caption' }, m.caption),
        note ? h('p', { class: 'jscene__note' }, note) : null,
        extra,
      ),
      visual ? h('div', { class: 'jscene__visual' }, visual) : null,
    );
  }

  function setBackdrop(m) {
    if (mode === '3d') return;
    const first = resolve(m)[0];
    const previous = $$('.journey__backdrop-layer', backdrop);
    const layer = h('div', { class: 'journey__backdrop-layer' });
    if (first) layer.style.backgroundImage = `url("${url(first.item.sm)}")`;
    backdrop.append(layer);
    requestAnimationFrame(() => layer.classList.add('is-visible'));
    previous.forEach((p) => {
      p.classList.remove('is-visible');
      setTimeout(() => p.remove(), 1400);
    });
  }

  function preload(i) {
    const m = milestones[i];
    if (!m) return;
    resolve(m).forEach((r) => { new Image().src = url(r.item.lg); });
  }

  function go(i, { direction } = {}) {
    // A scene still on its way out is dropped immediately so fast clicks stay responsive
    stage.querySelectorAll('.jscene.is-leaving').forEach((s) => s.remove());
    const target = (i + milestones.length) % milestones.length;
    const dir = direction ?? (target >= index ? 1 : -1);
    const old = stage.querySelector('.jscene');
    old?.classList.remove('is-entering');
    index = target;
    const m = milestones[index];
    const scene = buildScene(m, index);
    stage.append(scene);
    setBackdrop(m);
    update();
    if (mode === '3d') space?.scene.goTo(index);
    else preload(index + 1);

    if (old) {
      if (prefersReducedMotion()) {
        old.remove();
      } else {
        old.classList.add('is-leaving');
        old.style.setProperty('--dir', dir);
        scene.style.setProperty('--dir', dir);
        scene.classList.add('is-entering');
        const done = () => old.remove();
        old.addEventListener('animationend', (e) => { if (e.target === old) done(); });
        setTimeout(done, 1100); // safety net
      }
    }
    announce(`${m.year}. ${m.title}. ${m.caption}`);
  }

  function update() {
    counter.textContent = `${pad(index + 1)} / ${pad(milestones.length)}`;
    fill.style.transform = `scaleX(${milestones.length > 1 ? index / (milestones.length - 1) : 1})`;
    stops.forEach((li, i) => {
      const b = li.firstChild;
      b.classList.toggle('is-active', i === index);
      b.classList.toggle('is-past', i < index);
      if (i === index) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
    // keep the active stop visible on narrow screens (scroll the rail only, never the page)
    const active = stops[index].firstChild;
    const r = rail.getBoundingClientRect(), a = active.getBoundingClientRect();
    if (a.left < r.left + 40 || a.right > r.right - 40) {
      rail.scrollTo({ left: rail.scrollLeft + (a.left - r.left) - r.width / 2 + a.width / 2, behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
    }
  }

  // ---- Autoplay ------------------------------------------------------------
  function setPlayLabel() {
    const on = !!timer;
    playBtn.replaceChildren(h('span', { html: on ? icons.pause : icons.play }), h('span', {}, on ? 'Pause' : 'Play the story'));
    playBtn.setAttribute('aria-pressed', String(on));
    viewer.classList.toggle('is-autoplaying', on);
  }
  function startAutoplay() {
    clearInterval(timer);
    timer = setInterval(() => go(index + 1, { direction: 1 }), AUTOPLAY_MS);
    setPlayLabel();
  }
  function stopAutoplay() {
    clearInterval(timer);
    timer = null;
    setPlayLabel();
  }
  playBtn.addEventListener('click', () => (timer ? stopAutoplay() : startAutoplay()));
  watchVisibility(viewer, (visible) => { if (!visible && timer) stopAutoplay(); });

  // ---- Input ---------------------------------------------------------------
  prevBtn.addEventListener('click', () => { stopAutoplay(); go(index - 1, { direction: -1 }); });
  nextBtn.addEventListener('click', () => { stopAutoplay(); go(index + 1, { direction: 1 }); });
  viewer.addEventListener('keydown', (e) => {
    if (e.target.closest('dialog')) return;
    const map = { ArrowRight: () => go(index + 1, { direction: 1 }), ArrowLeft: () => go(index - 1, { direction: -1 }), Home: () => go(0), End: () => go(milestones.length - 1) };
    if (map[e.key]) { e.preventDefault(); stopAutoplay(); map[e.key](); }
  });
  onSwipe(stage, { left: () => { stopAutoplay(); go(index + 1, { direction: 1 }); }, right: () => { stopAutoplay(); go(index - 1, { direction: -1 }); } });

  // Pointer parallax: frames at different depths drift by different amounts
  if (!prefersReducedMotion()) {
    viewer.addEventListener('pointermove', (e) => {
      if (e.pointerType !== 'mouse') return;
      const r = viewer.getBoundingClientRect();
      viewer.style.setProperty('--px', ((e.clientX - r.left) / r.width - 0.5).toFixed(3));
      viewer.style.setProperty('--py', ((e.clientY - r.top) / r.height - 0.5).toFixed(3));
    });
    viewer.addEventListener('pointerleave', () => { viewer.style.setProperty('--px', 0); viewer.style.setProperty('--py', 0); });
  }

  setPlayLabel();
  go(0);

  if (mode === '3d') {
    const stations = milestones.map((m) => ({ year: m.year, special: m.id === 'fifty' ? 'fifty' : null, media: resolve(m) }));
    mountJourneyScene(spaceEl, {
      stations,
      onPick: (station, k) => openLightbox(lightboxFor(milestones[station]), k),
    }).then((controller) => {
      if (controller) {
        space = controller;
        space.scene.goTo(index);
        return;
      }
      // No WebGL after all: switch to the CSS viewer without losing the place
      mode = 'css';
      viewer.classList.remove('journey--3d');
      spaceEl.remove();
      stage.replaceChildren();
      go(index);
    });
  }
}
