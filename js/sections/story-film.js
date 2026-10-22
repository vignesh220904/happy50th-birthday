// Age 1 to 5 — the family's story video (data/site.json → videos.storyFilm).

import { mountFamilyFilm } from './family-film.js';

export async function mount(el, content, deck) {
  return mountFamilyFilm(el, content, deck, 'storyFilm', { titleId: 'story-film-title', eyebrow: 'Her Story' });
}
