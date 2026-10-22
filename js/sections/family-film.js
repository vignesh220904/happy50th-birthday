// The family's own films, each on its own screen (data/site.json → videos.<key>):
//   storyFilm   — "Age 1 to 5" story video
//   ageFilm     — "Age 1 to 50" real video
//   lifeJourney — "Life Journey" video
// The originals are in the VIDEOS folder; `npm run build:films` prepares the browser-ready
// copies in assets/videos/family/. A film whose copy is missing is left out of
// the presentation (with a warning) rather than showing an empty screen, and is
// never replaced by anything else.

import { mountCinema } from './cinema.js';
import { fileExists } from './shared.js';

export async function mountFamilyFilm(el, content, deck, key, { titleId, eyebrow }) {
  const v = content.site.videos?.[key] || {};
  if (!(await fileExists(v.src))) {
    console.warn(`[${key}] The family's film is missing (${v.src || 'no path set'}); run "npm run build:films". The scene is left out.`);
    return { absent: true };
  }
  const title = v.title || 'A Film from the Family';
  return mountCinema(el, deck, {
    id: titleId,
    eyebrow: v.eyebrow || eyebrow,
    title: v.titleAccent ? `${title} <em>${v.titleAccent}</em>` : title,
    lede: v.lede,
    playlist: [{ src: v.src, poster: v.poster, duration: v.duration, title: v.playerTitle || title }], // playerTitle: the name in the player's bar
    missingText: 'The family’s film will be shown here.',
  });
}
