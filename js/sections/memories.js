// Our Memory Film — the family's own film, the video they supplied in the
// "Memory gallery" Google Drive folder (data/site.json → videos.memories).
// The page opens on its introduction for 10 seconds, then the film starts by
// itself and fills the screen; one central Play button if the browser waits for a click.

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
