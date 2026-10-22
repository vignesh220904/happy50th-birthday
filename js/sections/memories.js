// Scene 6 — The Family Album opens with the family's memories film (the video
// supplied in the "Memory gallery" folder). After it, Next opens the photographs.

import { mountCinema } from './cinema.js';

export async function mount(el, content, deck) {
  const cfg = content.site.videos?.memories || {};
  const film = content.media.film(cfg.film || 'film-memories');
  if (!film) console.warn('[memories] The memories film is missing from data/photo_inventory.json → films.');
  const length = film?.duration ? `${Math.floor(film.duration / 60)} min ${Math.round(film.duration % 60)} s` : '';
  return mountCinema(el, deck, {
    id: 'memories-title',
    eyebrow: 'The Family Album',
    title: cfg.title ? cfg.title.replace(/,\s*(\S+)$/, ', <em>$1</em>') : 'Our Memories, <em>Together</em>',
    lede: cfg.description || 'A film of her photographs, made by the family.',
    meta: length ? `Family film · ${length}` : '',
    src: film?.src,
    poster: film?.poster,
    missingText: 'The memories film will be shown here.',
    continueLabel: 'Open the photo gallery',
  });
}
