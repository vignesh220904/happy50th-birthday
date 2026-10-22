// Scene 7 — The Family Photo Gallery, after the memories film.
// Only photographs whose date is recorded in the photo itself (camera data, or
// the camera's own file name) are shown, grouped by year. Scanned prints and
// photos without a recorded date stay in the "Memory gallery" folder but are
// left out here, so no date on screen is a guess.
// Each year is shown a page at a time; "Slideshow" plays the year full screen.

import { h, icons, fitText } from '../core/util.js';
import { picture } from '../core/data.js';
import { openLightbox } from '../core/lightbox.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const stacked = window.matchMedia('(max-aspect-ratio: 1/1), (max-width: 760px), (max-height: 500px)');
const PAGE = 12; // 6 × 2 on the landscape screen

/** A photo belongs in the dated gallery only if its date was read from the photo itself. */
export const isDated = (item) => !!item.date && /^\d{4}-\d{2}-\d{2}$/.test(item.date) && ['exif', 'filename'].includes(item.dateSource) && /^\d{4}$/.test(item.group);

function dateLabel(item) {
  const [y, m, d] = item.date.split('-').map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
}

export async function mount(el, content) {
  const all = content.media.collection('gallery');
  const dated = all.filter(isDated).sort((a, b) => a.date.localeCompare(b.date));
  const excluded = all.length - dated.length;
  if (excluded) console.info(`[gallery] ${dated.length} dated photographs shown; ${excluded} without a recorded date are left out of the dated gallery.`);
  const years = [...new Set(dated.map((i) => i.group))];
  let year = years[years.length - 1] || null;
  let page = 0;

  const yearBtns = years.map((y) => h('button', { class: 'chip chip--year', type: 'button', 'aria-pressed': 'false', 'data-year': y, onclick: () => show(y, 0) },
    y, h('span', { class: 'chip__count' }, dated.filter((i) => i.group === y).length)));
  const grid = h('div', { class: 'ggrid' });
  const prevBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Previous photos', html: icons.prev, onclick: () => turn(-1) });
  const nextBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'More photos', html: icons.next, onclick: () => turn(1) });
  const pageLabel = h('span', { class: 'gpager__label', 'aria-live': 'polite' });
  const yearTitle = h('p', { class: 'gallery__year' });
  const slideshowBtn = h('button', { class: 'btn btn--gold', type: 'button', onclick: () => slideshow() }, h('span', { html: icons.play }), 'Slideshow');

  el.append(h('div', { class: 'scene__frame gallery' },
    h('header', { class: 'gallery__head' },
      h('div', {},
        h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, 'The Family Album'),
        h('h2', { class: 'scene-title', id: 'gallery-title', 'data-enter': '', style: { '--enter': 1 }, html: 'Family <em>Photo Gallery</em>' }),
      ),
      h('div', { class: 'gallery__summary', 'data-enter': '', style: { '--enter': 2 } },
        yearTitle,
        h('p', { class: 'gallery__count' }, `${dated.length} dated photographs · ${years[0] || ''} – ${years[years.length - 1] || ''}`),
      ),
    ),
    h('div', { class: 'gallery__years no-swipe', role: 'group', 'aria-label': 'Choose a year', 'data-enter': '', style: { '--enter': 2 } }, yearBtns),
    h('div', { class: 'gallery__body', 'data-enter': '', style: { '--enter': 3 } }, grid),
    h('footer', { class: 'gallery__foot' },
      h('div', { class: 'gpager' }, prevBtn, pageLabel, nextBtn),
      slideshowBtn,
    ),
  ));

  const inYear = () => dated.filter((i) => i.group === year);
  const perPage = () => (stacked.matches ? Infinity : PAGE);

  const describe = (item) => ({ media: item, alt: `Family photograph, ${dateLabel(item)}`, caption: dateLabel(item), meta: item.dateSource === 'exif' ? 'Date from the photo’s camera information' : 'Date from the camera’s file name' });

  function show(y, p = 0) {
    if (!y) return;
    year = y;
    const list = inYear();
    const pages = Math.max(1, Math.ceil(list.length / Math.min(perPage(), list.length || 1)));
    page = Math.max(0, Math.min(pages - 1, p));
    const size = perPage() === Infinity ? list.length : PAGE;
    const slice = list.slice(page * size, page * size + size);
    yearBtns.forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.year === y)));
    // keep the chosen year visible in its row (scroll the row only, never the scene)
    const chip = yearBtns.find((b) => b.dataset.year === y);
    const row = chip?.parentElement;
    if (row && row.scrollWidth > row.clientWidth) row.scrollLeft = chip.offsetLeft - row.clientWidth / 2 + chip.offsetWidth / 2;
    yearTitle.textContent = `${y} · ${list.length} photograph${list.length === 1 ? '' : 's'}`;
    grid.style.setProperty('--count', slice.length);
    grid.replaceChildren(...slice.map((item, i) => h('button', {
      class: 'gitem',
      type: 'button',
      style: { '--i': i },
      'aria-label': `Open photo: ${dateLabel(item)}`,
      onclick: () => openLightbox(list.map(describe), list.indexOf(item)),
    },
    h('span', { class: 'gitem__frame' }, picture(item, { alt: `Family photograph, ${dateLabel(item)}`, sizes: '(max-width: 760px) 46vw, 15vw', className: 'gitem__img' })),
    h('span', { class: 'gitem__date' }, dateLabel(item)),
    )));
    pageLabel.textContent = pages > 1 ? `Page ${page + 1} of ${pages}` : '';
    prevBtn.disabled = page === 0;
    nextBtn.disabled = page >= pages - 1;
    prevBtn.parentElement.hidden = pages < 2;
    grid.classList.remove('is-shown');
    requestAnimationFrame(() => requestAnimationFrame(() => grid.classList.add('is-shown')));
  }

  function turn(d) { show(year, page + d); }
  function slideshow() {
    const list = inYear();
    openLightbox(list.map(describe), page * (perPage() === Infinity ? 0 : PAGE), { autoplay: 5000 });
  }

  if (!dated.length) {
    grid.replaceWith(h('p', { class: 'empty-note' }, 'Dated photographs will appear here once they are added to the “Memory gallery” folder.'));
  } else {
    show(year);
  }
  stacked.addEventListener?.('change', () => show(year, 0));

  return {
    hint: `${dated.length} dated photographs by year`,
    enter() { if (year) show(year, page); },
    fit() { fitText(yearTitle.parentElement, { min: 0.8 }); },
  };
}
