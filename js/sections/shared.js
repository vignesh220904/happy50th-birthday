// Building blocks shared by several scenes.

import { h, icons } from '../core/util.js';
import { url } from '../core/data.js';
import { createPlayer } from '../core/player.js';

/** Scene heading: eyebrow, title (may contain <em>), optional lede. */
export function sceneHead({ eyebrow, id, title, lede, className = '', enter = 0 }) {
  return h('header', { class: `scene-head ${className}` },
    eyebrow ? h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': enter } }, eyebrow) : null,
    h('h2', { class: 'scene-title', id, html: title, 'data-enter': '', style: { '--enter': enter + 1 } }),
    lede ? h('p', { class: 'scene-lede', 'data-enter': '', style: { '--enter': enter + 2 } }, lede) : null,
  );
}

/** Is a file there? A HEAD request, so nothing is downloaded. */
export async function fileExists(path) {
  if (!path) return false;
  try {
    const res = await fetch(url(path), { method: 'HEAD', cache: 'no-store' });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * A video screen for a family-supplied video. Shows a loading state while it
 * checks for the file; then the player, or — if the file has not been added
 * yet — a calm placeholder. When the family adds the file at the configured
 * path, the player replaces the placeholder automatically on the next visit.
 */
export function videoStage({ src, poster, title, missingText, missingIcon = icons.film, onEnded, theme = 'dark', exists }) {
  const screen = h('div', { class: `vstage vstage--${theme} is-checking` },
    h('div', { class: 'vstage__checking', role: 'status' }, h('span', { class: 'vstage__spinner', 'aria-hidden': 'true' }), h('span', { class: 'visually-hidden' }, 'Loading video')),
  );
  let player = null;
  const showMissing = (text) => {
    screen.classList.remove('is-checking');
    screen.classList.add('is-missing');
    screen.replaceChildren(
      h('div', { class: 'vstage__missing', role: 'status' },
        h('span', { class: 'vstage__missing-icon', html: missingIcon }),
        h('p', { class: 'vstage__missing-text' }, text),
      ),
    );
  };
  // `exists` may be passed when the caller has already checked the file
  const ready = (exists === undefined ? fileExists(src) : Promise.resolve(exists)).then((ok) => {
    if (!ok) {
      console.info(`[video] "${title}" is not added yet. Save it as ${src} (see assets/videos/family/README.txt).`);
      showMissing(missingText);
      return false;
    }
    player = createPlayer({ src, poster, title, onEnded });
    screen.classList.remove('is-checking');
    screen.classList.add('has-video');
    screen.replaceChildren(player.el);
    return true;
  });
  return {
    el: screen,
    ready,
    get player() { return player; },
    pause: () => player?.pause(),
  };
}

/** Graceful message when a scene cannot render (e.g. missing data file). */
export function sectionError(el, title) {
  el.replaceChildren(h('div', { class: 'scene__frame scene-error' },
    h('div', { class: 'scene-error__box', role: 'status' },
      h('p', { class: 'eyebrow' }, title),
      h('p', {}, 'This part of the celebration could not be loaded. Please refresh the page.'),
    ),
  ));
}

export const mediaLabel = (item) =>
  item?.kind === 'illustration' ? h('span', { class: 'media-label media-label--illustration' }, 'Illustration') : null;
