// Building blocks shared by several chapters.

import { h, html, esc, icons, roman } from '../core/util.js';
import { openCinema } from '../core/player.js';

/** Chapter heading: eyebrow, title (may contain <em>), lede. */
export function chapterHead({ num, id, title, lede, actions = [] }) {
  return h('header', { class: 'chapter-head', 'data-reveal': '' },
    h('p', { class: 'eyebrow' }, `Chapter ${roman(num)}`),
    h('h2', { class: 'chapter-title', id, html: title }),
    lede ? h('p', { class: 'chapter-lede' }, lede) : null,
    actions.length ? h('div', { class: 'chapter-actions' }, actions) : null,
  );
}

/** "Watch the film" button for one of the family films in the manifest. */
export function filmButton(content, filmId) {
  const film = content.media.film(filmId);
  if (!film) return null;
  const meta = content.site?.films?.[filmId] || {};
  const mins = film.duration ? `${Math.floor(film.duration / 60)}:${String(Math.round(film.duration % 60)).padStart(2, '0')}` : '';
  return h('button', {
    class: 'btn btn--ghost film-btn',
    type: 'button',
    onclick: () => openCinema({ src: film.src, poster: film.poster, title: meta.title || 'Family film', description: meta.description, label: meta.label }),
  },
  h('span', { class: 'film-btn__icon', html: icons.play }),
  h('span', {}, `Watch ${meta.title ? meta.title.replace(/^The /, 'the ') : 'the film'}`),
  mins ? h('span', { class: 'film-btn__time' }, mins) : null,
  );
}

/** Graceful message when a chapter cannot render (e.g. missing data file). */
export function sectionError(el, title) {
  el.append(html(`<div class="wrap"><div class="section-error glass" role="status">
    <p class="eyebrow">${esc(title)}</p>
    <p>This part of the celebration could not be loaded right now. Please refresh the page.</p>
  </div></div>`));
}

export const mediaLabel = (item) =>
  item?.kind === 'illustration' ? h('span', { class: 'media-label media-label--illustration' }, 'Illustration') : null;
