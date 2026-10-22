// Our Memory Film — the family's own film, the video they supplied in the
// "Memory gallery" Google Drive folder (data/site.json → videos.memories).
// One central Play button; it opens in full screen with Back and Replay.

import { mountCinema } from './cinema.js';

export async function mount(el, content, deck) {
  const cfg = content.site.videos?.memories || {};
  const film = content.media.film(cfg.film || 'film-memories');
  if (!film) console.warn('[memories] The memories film is missing from data/photo_inventory.json → films.');
  return mountCinema(el, deck, {
    id: 'memories-title',
    eyebrow: 'Our Memory Film',
    title: cfg.title ? cfg.title.replace(/,\s*(\S+)$/, ', <em>$1</em>') : 'Our Memories, <em>Together</em>',
    lede: cfg.description || 'A film of her photographs, made by the family.',
    playlist: film ? [{ src: film.src, poster: film.poster, duration: film.duration }] : [],
    missingText: 'The memories film will be shown here.',
  });
}
