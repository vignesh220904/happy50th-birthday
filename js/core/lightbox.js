// Full-screen photo viewer built on <dialog> (native focus trapping, Esc to close,
// inert background). Shared by the gallery, life journey and age sections.

import { h, icons, onSwipe, announce, prefersReducedMotion } from './util.js';
import { url } from './data.js';

let dialog, imgEl, placeholderEl, captionEl, metaEl, counterEl, labelEl, prevBtn, nextBtn;
let items = [], index = 0, opener = null;

function build() {
  prevBtn = h('button', { class: 'icon-btn lightbox__nav lightbox__nav--prev', type: 'button', 'aria-label': 'Previous photo', html: icons.prev, onclick: () => go(-1) });
  nextBtn = h('button', { class: 'icon-btn lightbox__nav lightbox__nav--next', type: 'button', 'aria-label': 'Next photo', html: icons.next, onclick: () => go(1) });
  placeholderEl = h('img', { class: 'lightbox__placeholder', alt: '', 'aria-hidden': 'true' });
  imgEl = h('img', { class: 'lightbox__img', alt: '' });
  counterEl = h('span', { class: 'lightbox__counter' });
  labelEl = h('span', { class: 'media-label' });
  captionEl = h('p', { class: 'lightbox__caption' });
  metaEl = h('p', { class: 'lightbox__meta' });

  dialog = h(
    'dialog',
    { class: 'lightbox', 'aria-label': 'Photo viewer' },
    h('div', { class: 'lightbox__bar' },
      counterEl,
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close photo viewer', html: icons.close, onclick: close }),
    ),
    h('figure', { class: 'lightbox__stage' }, placeholderEl, imgEl),
    prevBtn,
    nextBtn,
    h('div', { class: 'lightbox__footer' }, labelEl, captionEl, metaEl),
  );

  dialog.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
  });
  dialog.addEventListener('close', () => {
    document.documentElement.classList.remove('has-modal');
    imgEl.removeAttribute('src');
    opener?.focus?.({ preventScroll: true });
  });
  // Click on the dark backdrop (not the photo or controls) closes the viewer
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog || e.target.classList.contains('lightbox__stage')) close();
  });
  onSwipe(dialog, { left: () => go(1), right: () => go(-1) });
  imgEl.addEventListener('load', () => imgEl.classList.add('is-loaded'));
  imgEl.addEventListener('error', () => {
    imgEl.classList.add('is-broken');
    console.warn('[lightbox] failed to load', imgEl.src);
  });
  document.body.append(dialog);
}

function render() {
  const item = items[index];
  const { media } = item;
  imgEl.classList.remove('is-loaded', 'is-broken');
  if (!prefersReducedMotion()) {
    dialog.querySelector('.lightbox__stage').animate(
      [{ opacity: 0.4, transform: 'scale(0.985)' }, { opacity: 1, transform: 'none' }],
      { duration: 360, easing: 'cubic-bezier(.16,1,.3,1)' },
    );
  }
  placeholderEl.src = url(media.sm);
  imgEl.src = url(media.lg);
  imgEl.alt = item.alt || '';
  imgEl.width = media.width;
  imgEl.height = media.height;
  counterEl.textContent = items.length > 1 ? `${index + 1} / ${items.length}` : '';
  const isIllustration = media.kind === 'illustration';
  labelEl.textContent = isIllustration ? 'Illustration · not a photograph' : 'Family photograph';
  labelEl.classList.toggle('media-label--illustration', isIllustration);
  captionEl.textContent = item.caption || '';
  captionEl.hidden = !item.caption;
  metaEl.textContent = item.meta || '';
  metaEl.hidden = !item.meta;
  prevBtn.hidden = nextBtn.hidden = items.length < 2;
  // Warm the neighbours so next/previous feel instant
  [index - 1, index + 1].forEach((i) => {
    const n = items[(i + items.length) % items.length];
    if (n && n !== item) new Image().src = url(n.media.lg);
  });
  announce(`${item.caption || item.alt || 'Photo'}${items.length > 1 ? `, ${index + 1} of ${items.length}` : ''}`);
}

function go(delta) {
  if (items.length < 2) return;
  index = (index + delta + items.length) % items.length;
  render();
}

export function close() {
  if (dialog?.open) dialog.close();
}

/**
 * openLightbox([{ media, alt, caption, meta }], startIndex)
 * `media` is a manifest entry (from data.js).
 */
export function openLightbox(list, start = 0) {
  items = list.filter((i) => i && i.media);
  if (!items.length) return;
  if (!dialog) build();
  opener = document.activeElement;
  index = Math.max(0, Math.min(start, items.length - 1));
  render();
  document.documentElement.classList.add('has-modal');
  dialog.showModal();
}
