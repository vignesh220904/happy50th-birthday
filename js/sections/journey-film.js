// Her Life Journey (9 of 10) — the family's "LIFE JOURNEY-update" video, after the
// family's video wishes and before Happy Birthday, Amma (data/site.json → videos.lifeJourney).

import { mountFamilyFilm } from './family-film.js';

export async function mount(el, content, deck) {
  return mountFamilyFilm(el, content, deck, 'lifeJourney', { titleId: 'journey-film-title', eyebrow: 'Her Life Journey' });
}
