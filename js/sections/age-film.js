// Age 1 to 50 — the family's real video (data/site.json → videos.ageFilm).

import { mountFamilyFilm } from './family-film.js';

export async function mount(el, content, deck) {
  return mountFamilyFilm(el, content, deck, 'ageFilm', { titleId: 'age-film-title', eyebrow: 'Age 1 to 50' });
}
