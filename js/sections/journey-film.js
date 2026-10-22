// Her Life Journey — the family's "LIFE JOURNEY" video (data/site.json → videos.lifeJourney).

import { mountFamilyFilm } from './family-film.js';

export async function mount(el, content, deck) {
  return mountFamilyFilm(el, content, deck, 'lifeJourney', { titleId: 'journey-film-title', eyebrow: 'Her Life Journey' });
}
