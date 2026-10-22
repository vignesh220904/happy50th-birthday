// Her Life Journey film — the family's own Life Journey video
// (data/site.json → videos.lifeJourney.src). The family has not supplied it
// yet, so the scene only joins the presentation once that file exists; until
// then it is left out entirely rather than showing an empty screen.
// (The earlier, internally generated films were removed at the family's request.)

import { mountCinema } from './cinema.js';
import { fileExists } from './shared.js';

export async function mount(el, content, deck) {
  const v = content.site.videos?.lifeJourney || {};
  if (!(await fileExists(v.src))) {
    console.info(`[journey-film] The family's Life Journey video is not added yet (${v.src || 'no path set'}); the scene is left out.`);
    return { absent: true };
  }
  return mountCinema(el, deck, {
    id: 'journey-film-title',
    eyebrow: 'Her Life Journey · 1976 – 2026',
    title: `${v.title || 'Her Life Journey'} <em>1976 – 2026</em>`,
    lede: v.lede,
    playlist: [{ src: v.src, poster: v.poster }],
    missingText: 'Her Life Journey film is on its way.',
  });
}
