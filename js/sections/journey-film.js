// Scene 3 — The family's Life Journey film (data/site.json → videos.lifeJourney).
// The earlier, internally generated film was removed at the family's request;
// until their film is saved at the configured path, a placeholder is shown.

import { mountCinema } from './cinema.js';

export async function mount(el, content, deck) {
  const v = content.site.videos?.lifeJourney || {};
  return mountCinema(el, deck, {
    id: 'journey-film-title',
    eyebrow: 'Her Life Journey',
    title: `${v.title || 'Her Life Journey'} <em>1976 – 2026</em>`,
    lede: 'Fifty years in one film, from the family.',
    src: v.src,
    poster: v.poster,
    missingText: v.missingText || 'Her Life Journey film is on its way.',
    continueLabel: 'Continue to her journey',
  });
}
