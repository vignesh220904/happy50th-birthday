// An automatic photo slideshow through part of her life (data/timeline.json).
// Used twice: "A Journey Through Time" (1976 – 2005) and "Proud Moments"
// (2006 – 2026), chosen by the chapter's year range.
//
// One photograph at a time, large and never cropped (a soft blurred copy of
// the photo fills the frame around it), with the year, title and caption
// beside it. Photos cross-fade with a slow, gentle zoom; a milestone with
// several photos keeps its caption while its photos change. A year rail along
// the bottom shows where we are in the journey.
//
// The presentation controller drives it: every photo is one step, so Next /
// Previous (and a clicker) move photo by photo, and automatic playback moves
// on by itself at a comfortable pace (auto() says how long each photo stays).
// A milestone without a photograph is shown as an elegant year card; if the
// family still has to send its photo ('pendingPhoto'), the card says so.

import { h, fitText, prefersReducedMotion } from '../core/util.js';
import { picture, url } from '../core/data.js';
import { mediaLabel } from './shared.js';

const FIRST_PHOTO_MS = 7500;  // a new milestone: time to read its caption
const NEXT_PHOTO_MS = 5500;   // another photo of the same milestone
const CARD_MS = 6500;         // a year card without a photograph
const shortYear = (y) => (String(y).match(/\d{4}s?/) || [y])[0];

export function mountTimelineShow(el, content, { chapterId, titleId }) {
  const { chapters = [], milestones } = content.timeline;
  const chapter = chapters.find((c) => c.id === chapterId) || { title: chapterId, from: 0, to: 9999 };
  const list = milestones.filter((m) => m.sortYear >= chapter.from && m.sortYear <= chapter.to);

  // one slide per photograph (or one year card for a milestone without one)
  const slides = list.flatMap((m, mi) => {
    const media = m.media.map((ref) => ({ ...ref, item: content.media.get(ref.id) })).filter((r) => r.item);
    return (media.length ? media : [null]).map((ref, k) => ({ m, mi, ref, k, count: media.length }));
  });
  let index = -1;

  // ---- Layout ----------------------------------------------------------------------------
  const stage = h('div', { class: 'tshow__stage' });
  const yearEl = h('p', { class: 'tshow__year' });
  const titleEl = h('h3', { class: 'tshow__title' });
  const captionEl = h('p', { class: 'tshow__caption' });
  const noteEl = h('p', { class: 'tshow__note' });
  const dotsEl = h('span', { class: 'tshow__dots', 'aria-hidden': 'true' });
  const story = h('div', { class: 'tshow__story', 'aria-live': 'polite' }, yearEl, titleEl, captionEl, noteEl, dotsEl);
  const fill = h('span', { class: 'trail__fill' });
  // a year shared by several moments is labelled once on the rail
  const stops = list.map((m, i) => h('span', { class: `trail__stop ${i && shortYear(list[i - 1].year) === shortYear(m.year) ? 'is-repeat' : ''}`, style: { '--x': list.length > 1 ? i / (list.length - 1) : 0.5 } },
    h('span', { class: 'trail__dot' }), h('span', { class: 'trail__year' }, shortYear(m.year))));

  el.append(h('div', { class: `scene__frame tshow tshow--${chapterId}` },
    h('div', { class: 'tshow__media', 'data-enter': '', style: { '--enter': 1 } }, stage),
    h('div', { class: 'tshow__text' },
      h('header', { class: 'tshow__head' },
        h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, `${chapter.eyebrow || 'Her Life Journey'} · ${chapter.from} – ${chapter.to}`),
        h('h2', { class: 'tshow__chapter', id: titleId, 'data-enter': '', style: { '--enter': 1 } }, chapter.title),
      ),
      h('div', { 'data-enter': '', style: { '--enter': 2 }, class: 'tshow__story-wrap' }, story),
    ),
    h('div', { class: 'trail', 'aria-hidden': 'true', 'data-enter': '', style: { '--enter': 3 } },
      h('span', { class: 'trail__line' }, fill), h('div', { class: 'trail__stops' }, stops)),
  ));

  // ---- Slides ------------------------------------------------------------------------------
  function slideEl(s) {
    if (!s.ref) {
      const fifty = s.m.id === 'fifty';
      return h('div', { class: `tslide tslide--card ${fifty ? 'is-fifty' : ''}` },
        h('span', { class: 'tslide__big' }, fifty ? '50' : shortYear(s.m.year)),
        s.m.pendingPhoto ? h('span', { class: 'tslide__pending' }, s.m.pendingPhoto) : null);
    }
    const { item, alt } = s.ref;
    return h('figure', { class: 'tslide' },
      h('span', { class: 'tslide__fill', 'aria-hidden': 'true', style: { backgroundImage: `url("${url(item.sm)}")` } }),
      h('span', { class: 'tslide__frame' },
        picture(item, { alt, large: true, eager: true, className: 'tslide__img' }),
        mediaLabel(item)),
    );
  }

  function show(i, { animate = true } = {}) {
    const target = Math.max(0, Math.min(slides.length - 1, i));
    const prev = slides[index];
    const s = slides[target];
    index = target;
    const still = !animate || prefersReducedMotion();

    const incoming = slideEl(s);
    if (!still) incoming.classList.add('is-entering');
    stage.querySelectorAll('.tslide').forEach((old) => {
      if (still) return old.remove();
      old.classList.add('is-leaving');
      setTimeout(() => old.remove(), 1400);
    });
    stage.append(incoming);

    if (!prev || prev.m !== s.m) {
      yearEl.textContent = s.m.year;
      titleEl.textContent = s.m.title;
      captionEl.textContent = s.m.caption;
      noteEl.textContent = s.m.noPhoto || '';
      noteEl.hidden = !s.m.noPhoto;
      story.classList.remove('is-changing');
      if (!still) { void story.offsetWidth; story.classList.add('is-changing'); }
      requestAnimationFrame(fit);
    }
    dotsEl.replaceChildren(...(s.count > 1 ? Array.from({ length: s.count }, (_, k) => h('i', { class: k === s.k ? 'is-on' : '' })) : []));
    stops.forEach((stop, k) => {
      stop.classList.toggle('is-past', k < s.mi);
      stop.classList.toggle('is-current', k === s.mi);
    });
    fill.style.transform = `scaleX(${list.length > 1 ? s.mi / (list.length - 1) : 1})`;
    // the next photograph is ready before it is needed
    const next = slides[index + 1]?.ref?.item;
    if (next) new Image().src = url(next.lg);
  }

  function fit() { fitText(story, { min: 0.6 }); }

  show(0, { animate: false });

  return {
    hint: `${chapter.from} – ${chapter.to} · ${list.length} moments, ${slides.length} photographs`,
    enter({ atEnd }) { show(atEnd ? slides.length - 1 : 0, { animate: false }); },
    step(dir) {
      const target = index + dir;
      if (target < 0 || target >= slides.length) return false;
      show(target);
      return true;
    },
    steps: () => ({ index, count: slides.length, label: shortYear(slides[index].m.year) }),
    auto: () => { const s = slides[index]; return !s.ref ? CARD_MS : s.k === 0 ? FIRST_PHOTO_MS : NEXT_PHOTO_MS; },
    fit,
  };
}
