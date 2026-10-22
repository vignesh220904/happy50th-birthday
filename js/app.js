// Entry point. Loads the content files, mounts every scene, and registers it
// with the presentation controller (core/deck.js) in presentation order.
// A scene that fails to render shows a gentle message; the others still work.
// A scene whose family video has not been supplied yet ({ absent: true }) is
// left out of the presentation instead of showing an empty screen.
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
import * as proud from './sections/proud.js';
import * as reasons from './sections/reasons.js';
import * as memories from './sections/memories.js';
import * as wishes from './sections/wishes.js';
import * as finale from './sections/finale.js';

// The running order of the celebration.
const SCENES = [
  { id: 'welcome', title: 'A Golden Beginning', mod: welcome },
  { id: 'reveal', title: 'Happy 50th Birthday', mod: reveal },
  { id: 'journey-film', title: 'Her Life Journey Film', mod: journeyFilm },
  { id: 'journey', title: 'A Journey Through Time', mod: journey },
  { id: 'proud', title: 'Proud Moments', mod: proud },
  { id: 'reasons', title: '50 Reasons We Love You', mod: reasons },
  { id: 'memories', title: 'Our Memory Film', mod: memories },
  { id: 'wishes', title: 'Messages Filled With Love', mod: wishes },
  { id: 'finale', title: 'A Final Gift of Love', mod: finale },
];

async function main() {
  startParticles($('.backdrop__particles'));
  const deck = createDeck($('#deck'), $('[data-deck-ui]'));
  const content = await loadContent();
  if (content.site) music.configure(content.site.music, url);

  const shown = [];
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
    if (ctl.absent) { el.remove(); continue; }
    scene.ctl = ctl;
    shown.push(scene);
    deck.add(scene.id, scene.title, ctl);
  }

  // Leaving a scene pauses its videos (the music then returns if it was on)
  deck.on(() => pauseAll());

  // Fit long text to each scene after layout changes (projector resolution, window size)
  const refit = () => shown.forEach((s) => s.ctl?.fit?.());
  let resizeTimer = 0;
  addEventListener('resize', () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(refit, 150); });
  document.fonts?.ready.then(refit);

  // index.html#reasons opens that scene once; the hash is then removed so a
  // refresh always comes back to the welcome screen.
  const sceneFromHash = () => {
    const hash = decodeURIComponent(location.hash.slice(1));
    if (location.hash) history.replaceState(null, '', location.pathname + location.search);
    return shown.some((s) => s.id === hash) ? hash : null;
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
