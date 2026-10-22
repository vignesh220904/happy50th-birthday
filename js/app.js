// Entry point. Loads the content files, mounts every scene, and registers it
// with the presentation controller (core/deck.js) in presentation order.
// A scene that fails to render shows a gentle message; the others still work.
//
// The welcome is the first, default screen: it is painted straight from
// index.html, so it is on the projector before anything else has loaded.

import { loadContent, url } from './core/data.js';
import { music } from './core/audio.js';
import { createDeck } from './core/deck.js';
import { startParticles } from './core/particles.js';
import { pauseAll } from './core/player.js';
import { $, $$ } from './core/util.js';
import { sectionError } from './sections/shared.js';
import * as welcome from './sections/welcome.js';
import * as reveal from './sections/reveal.js';
import * as journeyFilm from './sections/journey-film.js';
import * as journey from './sections/journey.js';
import * as reasons from './sections/reasons.js';
import * as memories from './sections/memories.js';
import * as gallery from './sections/gallery.js';
import * as wishes from './sections/wishes.js';
import * as finale from './sections/finale.js';

// The running order of the celebration.
const SCENES = [
  { id: 'welcome', title: 'Welcome', mod: welcome },
  { id: 'reveal', title: 'Happy Birthday, Amma', mod: reveal },
  { id: 'journey-film', title: 'Life Journey Film', mod: journeyFilm },
  { id: 'journey', title: 'Her Life Journey', mod: journey },
  { id: 'reasons', title: '50 Reasons We Love You', mod: reasons },
  { id: 'memories', title: 'Family Memories Film', mod: memories },
  { id: 'gallery', title: 'Family Photo Gallery', mod: gallery },
  { id: 'wishes', title: 'Family Wishes', mod: wishes },
  { id: 'finale', title: '50 Gifts Celebration', mod: finale },
];

async function main() {
  startParticles($('.backdrop__particles'));
  const deck = createDeck($('#deck'), $('[data-deck-ui]'));
  const content = await loadContent();
  if (content.site) music.configure(content.site.music, url);

  for (const scene of SCENES) {
    const el = $(`[data-scene="${scene.id}"]`);
    let ctl = {};
    try {
      if (!content.site) throw new Error('data/site.json could not be loaded');
      ctl = (await scene.mod.mount(el, content, deck)) || {};
    } catch (err) {
      console.error(`[${scene.id}] failed to render`, err);
      sectionError(el, scene.title);
    }
    scene.ctl = ctl;
    deck.add(scene.id, scene.title, ctl);
  }

  // Leaving a scene pauses its videos (the music then returns if it was on)
  deck.on(() => pauseAll());

  // Fit long text to each scene after layout changes (projector resolution, window size)
  const refit = () => SCENES.forEach((s) => s.ctl?.fit?.());
  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(refit, 150); });
  document.fonts?.ready.then(refit);

  // index.html#reasons opens that scene once; the hash is then removed so a
  // refresh always comes back to the welcome screen.
  const sceneFromHash = () => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    return SCENES.some((s) => s.id === hash) ? hash : null;
  };
  addEventListener('hashchange', () => { const id = sceneFromHash(); if (id) deck.goTo(id); });

  deck.start(sceneFromHash() || 'welcome');
  refit();
  document.documentElement.classList.add('is-loaded');
  window.__deck = deck; // handy from the browser console during rehearsal: __deck.goTo('finale')
}

main().catch((err) => {
  console.error('[app] failed to start', err);
  $$('[data-scene]:not([data-scene="welcome"])').forEach((el) => sectionError(el, 'Celebration'));
});
