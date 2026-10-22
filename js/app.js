// Entry point. Loads the content files, then mounts every chapter present on
// the page (index.html has all seven; each pages/*.html has one). A chapter that
// fails shows a gentle message without affecting the others.

import { setupNav } from './core/nav.js';
import { loadContent, url } from './core/data.js';
import { music } from './core/audio.js';
import { setupReveal, $, $$ } from './core/util.js';
import { sectionError } from './sections/shared.js';
import { createIntro } from './sections/intro.js';
import { loadThree, webglAvailable } from './three/stage.js';
import * as welcome from './sections/welcome.js';
import * as journey from './sections/journey.js';
import * as reasons from './sections/reasons.js';
import * as gallery from './sections/gallery.js';
import * as wishes from './sections/wishes.js';
import * as age from './sections/age.js';
import * as finale from './sections/finale.js';

const MODULES = { welcome, journey, reasons, memories: gallery, wishes, age, finale };

async function main() {
  setupNav($('[data-nav]'));
  // The opening title card waits for the real work: content, fonts, first photos, 3D engine
  const intro = createIntro();
  const track = (p) => (intro ? intro.track(p) : p);
  let mounted;
  track(new Promise((ok) => { mounted = ok; })); // resolved once every chapter is on the page
  track(document.fonts?.ready);
  if (intro && webglAvailable()) track(loadThree());
  const content = await track(loadContent());
  if (intro) {
    (content.site?.heroPhotos || []).slice(0, 6).forEach((id) => {
      const item = content.media.get(id);
      if (item) track(new Promise((ok) => { const img = new Image(); img.onload = img.onerror = ok; img.src = url(item.sm); }));
    });
  }
  if (!content.site) {
    $$('[data-section]').forEach((el) => sectionError(el, 'Celebration'));
    mounted();
    return;
  }
  music.configure(content.site.music, url);

  for (const el of $$('[data-section]')) {
    const mod = MODULES[el.dataset.section];
    try {
      await mod.mount(el, content);
    } catch (err) {
      console.error(`[${el.dataset.section}] failed to render`, err);
      el.replaceChildren();
      sectionError(el, el.getAttribute('aria-label') || el.dataset.section);
    }
  }

  setupReveal();
  mounted();
  document.documentElement.classList.add('is-loaded');

  // Content is rendered after load, so honour a #chapter link once it exists
  if (location.hash) {
    const target = document.getElementById(decodeURIComponent(location.hash.slice(1)));
    target?.scrollIntoView();
  }
}

main().catch((err) => console.error('[app] failed to start', err));
