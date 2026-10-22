// A screening scene, shared by the family's films and the video wishes.
// The title sits on the left and the screen on the right, with one obvious
// control: the large Play button in the middle of the screen.
//
// Playing opens the theatre: the player fills the whole screen, the
// presentation controls step aside, and a slim bar at the bottom offers Back,
// Replay, Full screen and, for a playlist, Previous / Next. Esc or Back closes
// it. The page also asks the browser for real full screen, which browsers
// allow only straight after a click or key press; when that isn't possible the
// theatre still fills the window and its Full screen button stays in view.
//
// A playlist (the wishes) plays its videos one at a time, in the given order,
// with a short "up next" card between them. Next never leaves the scene while
// a wish is still playing. Videos whose file is missing are left out; a video
// that cannot be played is skipped after a moment, with a warning in the
// console, and never replaced by anything else.
//
// Automatic presentation (after Begin the Celebration, or ▶ / A): the title
// shows for a moment, then the film starts by itself, and when the film (or
// the last wish) has ended the theatre closes and the presentation moves on.
// If the browser still holds the film back until someone clicks, the screen
// says "Press Play" and the presentation waits; it never claims to be playing.

import { h, icons, announce } from '../core/util.js';
import { music } from '../core/audio.js';
import { createPlayer } from '../core/player.js';
import { videoStage, fileExists } from './shared.js';

const INTRO_MS = 1800;          // automatic: the title shows this long before the film starts
const UP_NEXT_MS = 2200;        // between two wishes: who is next
const END_HOLD_MS = 1200;       // after the film or the last wish: a breath, then on
const SKIP_MS = 2500;           // a video that cannot be played is skipped after this …
const START_TIMEOUT_MS = 20000; // … and so is one that never starts at all
const fmtLength = (s) => (!s ? '' : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

export async function mountCinema(el, deck, {
  id, eyebrow, title, lede, meta, playlist = [], theme = 'blue',
  missingText, missingIcon = icons.film, itemLabel = 'Video', playLabel = 'Play the film',
}) {
  const sceneId = el.dataset.scene;
  const here = () => deck.current === sceneId;

  // ---- What can actually be played ----------------------------------------------
  const exists = await Promise.all(playlist.map((v) => fileExists(v.src)));
  const items = playlist.filter((_, i) => exists[i]);
  playlist.filter((_, i) => !exists[i]).forEach((v) => console.warn(`[video] file not found, left out: ${v.src}`));
  const multi = items.length > 1;

  let current = 0, player = null, theatre = false, started = false, hasPlayed = false, ownsFullscreen = false;
  let upNextTimer = 0, errorTimer = 0, introTimer = 0, watchdog = 0;
  const clearTimers = () => [upNextTimer, errorTimer, introTimer, watchdog].forEach(clearTimeout);

  // ---- The screen ------------------------------------------------------------------------
  const screen = h('div', { class: `cinema__screen cinema__screen--${theme}` });
  const caption = h('p', { class: 'cinema__now', 'aria-live': 'polite' });
  const endCard = h('div', { class: 'cinema__end', hidden: true });
  const upNext = h('div', { class: 'cinema__upnext', hidden: true, role: 'status' });
  const prompt = h('p', { class: 'cinema__prompt', hidden: true, role: 'status' }, h('span', { html: icons.play }), 'Press Play to start');

  const label = (v) => [multi ? `${itemLabel} ${current + 1} of ${items.length}` : '', v?.from ? `From ${v.from}` : ''].filter(Boolean).join(' · ');

  function load(i, { autoplay = false } = {}) {
    clearTimers();
    upNext.hidden = true;
    endCard.hidden = true;
    prompt.hidden = true;
    player?.destroy();
    current = i;
    hasPlayed = false;
    const v = items[i];
    player = createPlayer({
      src: v.src,
      poster: v.poster,
      title: v.from ? `${v.title || itemLabel} from ${v.from}` : (v.title || title.replace(/<[^>]+>/g, '')),
      onEnded: ended,
      onError: () => { if (here()) failed(); },
      fullscreen: () => (theatre ? toggleFullscreen() : openTheatre()),
    });
    const vid = player.video;
    vid.addEventListener('loadedmetadata', () => vid.videoWidth && screen.style.setProperty('--ar', (vid.videoWidth / vid.videoHeight).toFixed(4)));
    vid.addEventListener('play', () => {
      started = true;
      clearTimeout(introTimer);
      endCard.hidden = true;
      prompt.hidden = true;
      if (!theatre) openTheatre();
    });
    vid.addEventListener('playing', () => { hasPlayed = true; clearTimeout(watchdog); });
    player.el.classList.add('is-entering');
    screen.replaceChildren(player.el, upNext, endCard, prompt);
    caption.textContent = label(v);
    bar.label.textContent = label(v) || v.title || title.replace(/<[^>]+>/g, '');
    bar.prev.disabled = i === 0;
    bar.next.disabled = i === items.length - 1;
    deck.refresh();
    if (autoplay) start();
  }

  /** Play the current video. If the browser holds it back, say so and wait for a click. */
  async function start() {
    const p = player;
    clearTimeout(watchdog);
    watchdog = setTimeout(() => {
      if (p !== player || hasPlayed || !here()) return;
      console.warn(`[video] ${items[current].src} did not start within ${START_TIMEOUT_MS / 1000} s`);
      failed();
    }, START_TIMEOUT_MS);
    const result = await p.play();
    if (p !== player) return; // another video was loaded meanwhile
    if (result === 'blocked') blocked();
    else if (result === 'error' && here()) failed();
  }

  function blocked() {
    clearTimeout(watchdog);
    console.info('[video] the browser is waiting for a click before it plays the video with sound');
    if (!theatre) music.unduck('film');
    prompt.hidden = false;
    player.el.querySelector('.player__big-play')?.focus({ preventScroll: true });
    announce('Press Play to start the video.');
  }

  /** A video that cannot be played: skip it (never stop the presentation on a broken file). */
  function failed() {
    if (player.el.dataset.failed) return; // the error event and play() may both report it
    player.el.dataset.failed = 'true';
    clearTimeout(watchdog);
    clearTimeout(errorTimer);
    console.warn(`[video] skipped, could not be played: ${items[current].src}`);
    if (multi && current < items.length - 1 && (theatre || deck.autoplaying)) {
      errorTimer = setTimeout(() => load(current + 1, { autoplay: true }), SKIP_MS);
    } else if (deck.autoplaying) {
      errorTimer = setTimeout(finish, SKIP_MS);
    }
  }

  /** Automatic presentation: back to the presentation view, then on to the next scene. */
  function finish() {
    closeTheatre();
    deck.autoAdvance(END_HOLD_MS);
  }

  function ended() {
    clearTimeout(watchdog);
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
    if (deck.autoplaying) { finish(); return; }
    endCard.replaceChildren(
      h('p', { class: 'cinema__end-title' }, multi ? 'With all our love' : 'Thank you for watching'),
      h('div', { class: 'cinema__end-actions' },
        h('button', { class: 'btn btn--light', type: 'button', onclick: () => replay(true) }, h('span', { html: icons.replay }), multi ? 'Watch them all again' : 'Watch again'),
        h('button', { class: 'btn btn--celebrate', type: 'button', onclick: () => { closeTheatre(); deck.next(); } }, h('span', {}, 'Continue'), h('span', { html: icons.next })),
      ),
    );
    endCard.hidden = false;
    endCard.querySelector('.btn--celebrate').focus({ preventScroll: true });
  }

  function replay(fromStart = false) {
    if (!items.length) return;
    if (fromStart && multi) return load(0, { autoplay: true });
    endCard.hidden = true;
    player.video.currentTime = 0;
    start();
  }

  /** Automatic presentation: show the title for a moment, then play. */
  function queueAutoStart() {
    clearTimeout(introTimer);
    music.duck('film'); // the music bows out while the title shows, so the film starts in quiet
    introTimer = setTimeout(() => {
      if (deck.autoplaying && here() && !started) start();
      else if (!theatre) music.unduck('film');
    }, INTRO_MS);
  }

  // ---- Theatre ---------------------------------------------------------------------------
  const bar = {
    back: h('button', { class: 'btn btn--light', type: 'button', onclick: () => closeTheatre() }, h('span', { html: icons.prev }), 'Back'),
    prev: h('button', { class: 'icon-btn icon-btn--light', type: 'button', 'aria-label': `Previous ${itemLabel.toLowerCase()}`, title: 'Previous', html: icons.prev, onclick: () => step(-1) }),
    replay: h('button', { class: 'btn btn--light', type: 'button', onclick: () => replay() }, h('span', { html: icons.replay }), 'Replay'),
    next: h('button', { class: 'icon-btn icon-btn--light', type: 'button', 'aria-label': `Next ${itemLabel.toLowerCase()}`, title: 'Next', html: icons.next, onclick: () => step(1) }),
    fs: h('button', { class: 'icon-btn icon-btn--light theatre-bar__fs', type: 'button', onclick: () => toggleFullscreen() }),
    label: h('span', { class: 'theatre-bar__label' }),
  };
  const theatreBar = h('div', { class: 'theatre-bar', role: 'toolbar', 'aria-label': 'Video' },
    bar.back,
    h('span', { class: 'theatre-bar__mid' }, multi ? bar.prev : null, bar.label, multi ? bar.next : null),
    h('span', { class: 'theatre-bar__end' }, bar.replay, document.fullscreenEnabled ? bar.fs : null),
  );
  const syncFsButton = () => {
    const on = !!document.fullscreenElement;
    bar.fs.innerHTML = on ? icons.shrink : icons.expand;
    bar.fs.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
    bar.fs.title = on ? 'Exit full screen' : 'Full screen';
    bar.fs.classList.toggle('is-offer', !on); // not in full screen: the button asks to be noticed
  };
  syncFsButton();
  document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement) ownsFullscreen = false; syncFsButton(); });

  const wrap = h('div', { class: 'cinema__screen-wrap' }, screen, theatreBar);

  function openTheatre() {
    if (theatre || !player) return;
    theatre = true;
    el.classList.add('is-theatre');
    document.body.classList.add('is-theatre');
    music.duck('theatre'); // stays down between two wishes, too
    player.el.focus({ preventScroll: true });
    document.addEventListener('keydown', onTheatreKey, true);
    enterFullscreen();
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
    music.unduck('film');
    // full screen opened just for this video goes too, unless the presentation runs on by itself
    if (ownsFullscreen && document.fullscreenElement && !deck.autoplaying) document.exitFullscreen().catch(() => {});
    deck.refresh();
    el.focus({ preventScroll: true });
  }
  // Esc: first out of full screen (most browsers do that themselves), then out of the theatre
  function onTheatreKey(e) {
    if (e.key !== 'Escape') return;
    e.preventDefault();
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return; }
    e.stopPropagation();
    closeTheatre();
  }
  /** Real full screen, when the browser allows it (straight after a click or key press). */
  function enterFullscreen() {
    if (document.fullscreenElement || !document.fullscreenEnabled) return;
    if (navigator.userActivation && !navigator.userActivation.isActive) return; // would be refused: the Full screen button stays visible
    document.documentElement.requestFullscreen().then(() => { ownsFullscreen = true; }, () => {});
  }
  async function toggleFullscreen() {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else { await document.documentElement.requestFullscreen?.(); ownsFullscreen = true; }
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
      if (deck.autoplaying && items.length) queueAutoStart();
    },
    leave() {
      clearTimers();
      closeTheatre();
      player?.pause();
      prompt.hidden = true;
      music.unduck('film');
    },
    /** Automatic presentation switched on or off while this scene is showing. */
    autoChanged(on) {
      if (on && items.length && !started && !theatre) queueAutoStart();
      if (!on) {
        clearTimeout(introTimer);
        if (!theatre) music.unduck('film');
      }
    },
    step(dir) {
      // A clicker has no mouse: the first "Next" on an unwatched screen starts the film
      if (dir > 0 && items.length && !started && !theatre) { started = true; clearTimeout(introTimer); start(); return true; }
      if (step(dir)) return true;
      // Next never leaves the family's messages while one is still playing (Back or Esc first)
      if (dir > 0 && multi && theatre && player && !player.video.paused && !player.video.ended) return true;
      return false;
    },
    steps: () => (theatre && multi ? { index: current, count: items.length, label: label(items[current]) } : null),
    // films say when they are done; an empty screen shows its message for a moment
    auto: () => (items.length ? 'wait' : 4000),
  };
}
