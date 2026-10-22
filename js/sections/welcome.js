// Chapter I — The Birthday Welcome.
// A cinematic hero over the 3D "50" installation. The opening title card
// (intro.js) plays first; when it lifts, the particle "50" gathers again so the
// hero comes alive in front of the guest. "Begin Her Beautiful Journey" glides
// into the life journey; the family's birthday film is one tap away.

import { h, icons, prefersReducedMotion } from '../core/util.js';
import { mountHeroScene } from '../three/hero-scene.js';
import { fullExperienceHref, isStandalone } from '../core/nav.js';
import { getIntro } from './intro.js';
import { filmButton } from './shared.js';
import { confetti } from '../core/confetti.js';
import { music } from '../core/audio.js';

let heroController = null;

export async function mount(el, content) {
  const w = content.site.welcome;
  const journeyHref = isStandalone() ? fullExperienceHref('journey') : '#journey';
  const enterBtn = h('a', { class: 'btn btn--primary welcome__cta', href: journeyHref },
    h('span', {}, w.cta),
    h('span', { class: 'welcome__cta-icon', html: icons.next }),
  );
  enterBtn.addEventListener('click', (e) => {
    if (isStandalone()) return;
    e.preventDefault();
    if (!music.on) music.play();
    document.getElementById('journey')?.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth' });
  });

  const scene = h('div', { class: 'welcome__scene' },
    h('div', { class: 'welcome__fallback', 'aria-hidden': 'true' }, h('span', {}, '50')),
  );

  el.append(
    scene,
    h('div', { class: 'welcome__scrim', 'aria-hidden': 'true' }),
    h('div', { class: 'wrap welcome__content' },
      h('p', { class: 'welcome__dates' }, w.eyebrow),
      h('h1', { class: 'welcome__title', id: 'welcome-title' },
        h('span', { class: 'welcome__line' }, '50 Years'),
        ' ',
        h('span', { class: 'welcome__line welcome__line--accent' }, 'of Love'),
      ),
      h('p', { class: 'welcome__supporting' }, w.supporting),
      h('p', { class: 'welcome__message' }, w.message),
      h('div', { class: 'welcome__actions' }, enterBtn, filmButton(content, 'film-birthday')),
      h('p', { class: 'welcome__theme' }, w.theme),
    ),
    h('a', { class: 'welcome__scroll', href: journeyHref, 'aria-label': 'Scroll to her life journey' },
      h('span', {}, 'Her journey'),
      h('span', { class: 'welcome__scroll-icon', html: icons.arrowDown }),
    ),
  );

  const photos = (content.site.heroPhotos || []).map((id) => content.media.get(id)).filter(Boolean);
  mountHeroScene(scene, { photos }).then((c) => { heroController = c; });

  const intro = getIntro();
  const reveal = () => {
    el.classList.remove('is-ready');
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add('is-ready')));
    heroController?.scene.replay?.();
  };
  if (intro) intro.on((event) => { if (event === 'enter') reveal(); });
  else requestAnimationFrame(() => el.classList.add('is-ready'));
}

/** Replay the opening (the finale's "Replay her journey"). */
export function replayWelcome() {
  document.getElementById('welcome')?.scrollIntoView({ behavior: 'instant' });
  const intro = getIntro();
  if (intro) {
    intro.replay();
  } else {
    heroController?.scene.replay?.();
    confetti({ x: 0.5, y: 0.7, count: 180 });
    music.play({ fromStart: true });
  }
}
