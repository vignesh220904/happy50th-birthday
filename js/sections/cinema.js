// A screening scene, shared by the family's films and the video wishes.
// The title sits on the left and the screen on the right, with one obvious
// control: the large Play button in the middle of the screen.
//
// Pressing Play opens the theatre: the player fills the whole screen (inside
// the browser window, which is already full screen on the projector), the
// presentation controls step aside, and a slim bar at the bottom offers
// Back, Replay and, for a playlist, Previous / Next. Esc or Back closes it.
//
// A playlist (the wishes) plays its videos one after another in the given
// order, with a short "up next" card between them. A presentation clicker
// moves between the videos while the theatre is open. Videos whose file is
// missing are left out; a video that fails to play is skipped after a moment.
//
// Nothing plays by itself: in automatic mode the presentation waits on this
// scene until the film has been watched (or someone moves on), then continues.

import { h, icons, announce } from '../core/util.js';
import { music } from '../core/audio.js';
import { createPlayer } from '../core/player.js';
import { videoStage, fileExists } from './shared.js';

const UP_NEXT_MS = 3500;
const fmtLength = (s) => (s ? `${Math.floor(s / 60)} min ${Math.round(s % 60)} s` : '');

export async function mountCinema(el, deck, {
  id, eyebrow, title, lede, meta, playlist = [], theme = 'blue',
  missingText, missingIcon = icons.film, itemLabel = 'Video', playLabel = 'Play the film',
}) {
  // ---- What can actually be played ----------------------------------------------
  const exists = await Promise.all(playlist.map((v) => fileExists(v.src)));
  const items = playlist.filter((_, i) => exists[i]);
  playlist.filter((_, i) => !exists[i]).forEach((v) => console.info(`[video] not added yet: ${v.src}`));
  const multi = items.length > 1;

  let current = 0, player = null, theatre = false, started = false, upNextTimer = 0, errorTimer = 0;

  // ---- The screen ------------------------------------------------------------------------
  const screen = h('div', { class: `cinema__screen cinema__screen--${theme}` });
  const caption = h('p', { class: 'cinema__now', 'aria-live': 'polite' });
  const endCard = h('div', { class: 'cinema__end', hidden: true });
  const upNext = h('div', { class: 'cinema__upnext', hidden: true, role: 'status' });

  const label = (v) => [multi ? `${itemLabel} ${current + 1} of ${items.length}` : '', v?.from ? `From ${v.from}` : ''].filter(Boolean).join(' · ');

  function load(i, { autoplay = false } = {}) {
    clearTimeout(upNextTimer);
    clearTimeout(errorTimer);
    upNext.hidden = true;
    endCard.hidden = true;
    player?.destroy();
    current = i;
    const v = items[i];
    player = createPlayer({
      src: v.src,
      poster: v.poster,
      title: v.from ? `${v.title || itemLabel} from ${v.from}` : (v.title || title.replace(/<[^>]+>/g, '')),
      onEnded: ended,
      onError: () => { if (theatre && multi && current < items.length - 1) errorTimer = setTimeout(() => load(current + 1, { autoplay: true }), 3000); },
      fullscreen: () => (theatre ? toggleFullscreen() : openTheatre({ fullscreen: true })),
    });
    const vid = player.video;
    vid.addEventListener('loadedmetadata', () => vid.videoWidth && screen.style.setProperty('--ar', (vid.videoWidth / vid.videoHeight).toFixed(4)));
    vid.addEventListener('play', () => { started = true; endCard.hidden = true; if (!theatre) openTheatre(); });
    player.el.classList.add('is-entering');
    screen.replaceChildren(player.el, upNext, endCard);
    caption.textContent = label(v);
    bar.label.textContent = label(v) || title.replace(/<[^>]+>/g, '');
    bar.prev.disabled = i === 0;
    bar.next.disabled = i === items.length - 1;
    deck.refresh();
    if (autoplay) player.play();
  }

  function ended() {
    if (multi && current < items.length - 1) {
      // a moment between two wishes: who is next
      const nextItem = items[current + 1];
      upNext.replaceChildren(
        h('p', { class: 'cinema__upnext-kicker' }, 'Up next'),
        h('p', { class: 'cinema__upnext-name' }, nextItem.from || `${itemLabel} ${current + 2} of ${items.length}`),
        h('span', { class: 'cinema__upnext-bar', 'aria-hidden': 'true' }),
      );
      upNext.hidden = false;
      upNextTimer = setTimeout(() => load(current + 1, { autoplay: true }), UP_NEXT_MS);
      return;
    }
    endCard.replaceChildren(
      h('p', { class: 'cinema__end-title' }, multi ? 'With all our love' : 'Thank you for watching'),
      h('div', { class: 'cinema__end-actions' },
        h('button', { class: 'btn btn--light', type: 'button', onclick: () => replay(true) }, h('span', { html: icons.replay }), multi ? 'Watch them all again' : 'Watch again'),
        h('button', { class: 'btn btn--celebrate', type: 'button', onclick: () => { closeTheatre(); deck.next(); } }, h('span', {}, 'Continue'), h('span', { html: icons.next })),
      ),
    );
    endCard.hidden = false;
    endCard.querySelector('.btn--celebrate').focus({ preventScroll: true });
    deck.autoAdvance(6000); // automatic mode: a moment to applaud, then on
  }

  function replay(fromStart = false) {
    if (!items.length) return;
    if (fromStart && multi) return load(0, { autoplay: true });
    endCard.hidden = true;
    player.video.currentTime = 0;
    player.play();
  }

  // ---- Theatre ---------------------------------------------------------------------------
  const bar = {
    back: h('button', { class: 'btn btn--light', type: 'button', onclick: () => closeTheatre() }, h('span', { html: icons.prev }), 'Back'),
    prev: h('button', { class: 'icon-btn icon-btn--light', type: 'button', 'aria-label': `Previous ${itemLabel.toLowerCase()}`, title: 'Previous', html: icons.prev, onclick: () => step(-1) }),
    replay: h('button', { class: 'btn btn--light', type: 'button', onclick: () => replay() }, h('span', { html: icons.replay }), 'Replay'),
    next: h('button', { class: 'icon-btn icon-btn--light', type: 'button', 'aria-label': `Next ${itemLabel.toLowerCase()}`, title: 'Next', html: icons.next, onclick: () => step(1) }),
    label: h('span', { class: 'theatre-bar__label' }),
  };
  const theatreBar = h('div', { class: 'theatre-bar', role: 'toolbar', 'aria-label': 'Video' },
    bar.back,
    h('span', { class: 'theatre-bar__mid' }, multi ? bar.prev : null, bar.label, multi ? bar.next : null),
    bar.replay,
  );

  const wrap = h('div', { class: 'cinema__screen-wrap' }, screen, theatreBar);

  function openTheatre({ fullscreen = false } = {}) {
    if (theatre || !player) return;
    theatre = true;
    el.classList.add('is-theatre');
    document.body.classList.add('is-theatre');
    music.duck('theatre'); // stays down between two wishes, too
    player.el.focus({ preventScroll: true });
    document.addEventListener('keydown', onTheatreKey, true);
    if (fullscreen && !document.fullscreenElement) toggleFullscreen();
    announce('Playing in full screen. Press Escape or Back to return.');
  }
  function closeTheatre() {
    if (!theatre) return;
    theatre = false;
    clearTimeout(upNextTimer);
    upNext.hidden = true;
    player?.pause();
    el.classList.remove('is-theatre');
    document.body.classList.remove('is-theatre');
    document.removeEventListener('keydown', onTheatreKey, true);
    music.unduck('theatre');
    deck.refresh();
    el.focus({ preventScroll: true });
  }
  function onTheatreKey(e) {
    if (e.key !== 'Escape' || document.fullscreenElement) return; // the browser leaves full screen first
    e.preventDefault();
    e.stopPropagation();
    closeTheatre();
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch { /* not allowed here; the theatre still fills the window */ }
  }

  /** Clicker / Next inside the theatre moves between the videos of a playlist. */
  function step(dir) {
    if (!theatre || !multi) return false;
    const target = current + dir;
    if (target < 0 || target >= items.length) return false;
    load(target, { autoplay: true });
    return true;
  }

  // ---- Layout ----------------------------------------------------------------------------
  if (items.length) load(0);
  else {
    const stage = videoStage({ src: playlist[0]?.src || '', title: title.replace(/<[^>]+>/g, ''), missingText, missingIcon, theme: theme === 'light' ? 'light' : 'dark', exists: false });
    screen.replaceChildren(stage.el);
  }

  const total = items.reduce((s, v) => s + (v.duration || 0), 0);
  const metaText = meta ?? (multi ? `${items.length} messages${total >= 90 ? ` · about ${Math.round(total / 60)} minutes` : ''}` : fmtLength(items[0]?.duration));

  el.append(h('div', { class: `scene__frame cinema cinema--${theme}` },
    h('div', { class: 'cinema__text' },
      h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, eyebrow),
      h('h2', { class: 'cinema__title', id, 'data-enter': '', style: { '--enter': 1 }, html: title }),
      lede ? h('p', { class: 'cinema__lede', 'data-enter': '', style: { '--enter': 2 } }, lede) : null,
      items.length && metaText ? h('p', { class: 'cinema__meta', 'data-enter': '', style: { '--enter': 3 } }, metaText) : null,
      multi ? h('div', { 'data-enter': '', style: { '--enter': 4 } }, caption) : null,
    ),
    h('div', { class: 'cinema__stage', 'data-enter': '', style: { '--enter': 1 } },
      wrap,
      items.length ? h('p', { class: 'cinema__hint' }, h('span', { html: icons.expand }), `${playLabel} · it opens in full screen`) : null),
  ));

  return {
    hint: items.length ? metaText : 'Waiting for the family’s video',
    enter() {
      started = false;
      if (items.length && current !== 0 && multi) load(0);
    },
    leave() {
      clearTimeout(upNextTimer);
      clearTimeout(errorTimer);
      closeTheatre();
      player?.pause();
    },
    step(dir) {
      // A clicker has no mouse: the first "Next" on an unwatched screen starts the film
      if (dir > 0 && items.length && !started && !theatre) { started = true; player.play(); return true; }
      return step(dir);
    },
    steps: () => (theatre && multi ? { index: current, count: items.length, label: label(items[current]) } : null),
    // films say when they are done; an empty screen shows its message for a moment
    auto: () => (items.length ? 'wait' : 8000),
  };
}
