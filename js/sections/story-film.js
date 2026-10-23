// Age 1 to 50 — Her Story: the family's story video, from her birth to fifty
// (data/site.json → videos.storyFilm; the original is named "age 1 to 5 story video.mp4").

import { mountFamilyFilm } from './family-film.js';

export async function mount(el, content, deck) {
  return mountFamilyFilm(el, content, deck, 'storyFilm', { titleId: 'story-film-title', eyebrow: 'Her Story' });
}
