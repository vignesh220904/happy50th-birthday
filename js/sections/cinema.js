// A screening scene, shared by the family's films and the video wishes.
// The title sits on the left and the screen on the right, with one obvious
// control: the large Play button in the middle of the screen.
//
// Playing opens the theatre: the player fills the whole screen, the
// presentation controls step aside, and a bar at the bottom offers just Back,
// Full screen / Normal screen and Next (among the wishes, Back and Next move
// between the messages first). Esc closes the theatre. The page also asks the browser for real full screen, which browsers
// allow only straight after a click or key press; when that isn't possible the
// theatre still fills the window and its Full screen button stays in view.
//
// A playlist (the wishes) plays its videos one at a time, in the given order,
// with a short "up next" card between them. Next never leaves the scene while
// a wish is still playing. Videos whose file is missing are left out; a video
// that cannot be played is skipped after a moment, with a warning in the
// console, and never replaced by anything else.
//
// Every video page plays by itself: once the visitor has clicked or pressed a
// key anywhere (Begin the Celebration, Next …), arriving on the page shows its
// introduction (the title, the poster and a golden countdown line) for `introMs`
// (10 s for the films, about 7 s for the family's messages) and then starts the
// video. There is one intro timer per page, cleared on every start, leave and
// pause, so a video is never started twice. In the automatic presentation,
// when the film (or the last wish) has ended the theatre closes and the
// presentation moves on; when it is paused (A), "Watch again" / "Continue" wait.
// If the browser still holds the film back until someone clicks, the screen
// says "Press Play" and the presentation waits; it never claims to be playing.
//
// Music: while a video plays, the background music goes soft (about 12 % of its
// normal volume, core/audio.js) and it stays soft while the theatre is open, so
// it does not come back up between two family wishes. It returns to normal when
// the theatre closes, when the page waits for a click, or when a video cannot be
// played. The videos' own sound is never changed.
//
// A playlist may hold one of the family's films among the wishes ("kind": "film",
// e.g. the Life Journey video before wish 9): it plays once, in turn, under its
// own title, and is not counted as a message.

import { h, icons, announce } from '../core/util.js';
import { music } from '../core/audio.js';
import { createPlayer } from '../core/player.js';
import { url } from '../core/data.js';
import { videoStage, fileExists } from './shared.js';

const INTRO_MS = 10000;         // the introduction shows this long before the film starts by itself
const UP_NEXT_MS = 2200;        // between two wishes: who is next
const END_HOLD_MS = 1200;       // after the film or the last wish: a breath, then on
const SKIP_MS = 2500;           // a video that cannot be played is skipped after this …
const START_TIMEOUT_MS = 20000; // … and so is one that never starts at all
const fmtLength = (s) => (!s ? '' : s < 60 ? `${Math.round(s)} s` : `${Math.floor(s / 60)} min ${Math.round(s % 60)} s`);

export async function mountCinema(el, deck, {
  id, eyebrow, title, lede, meta, playlist = [], theme = 'blue', introMs = INTRO_MS,
  missingText, missingIcon = icons.film, itemLabel = 'Video', playLabel = 'Play the film', startingText = 'The film begins in a moment',
}) {
  const sceneId = el.dataset.scene;
  const quiet = `scene:${sceneId}`; // this page's hold on the music
  const here = () => deck.current === sceneId;
  // browsers let a page play sound once the visitor has interacted with it
  const mayAutoplay = () => deck.autoplaying || (navigator.userActivation?.hasBeenActive ?? true);

  // ---- What can actually be played ----------------------------------------------
  const exists = await Promise.all(playlist.map((v) => fileExists(v.src)));
  const items = playlist.filter((_, i) => exists[i]);
  playlist.filter((_, i) => !exists[i]).forEach((v) => console.warn(`[video] file not found, left out: ${v.src}`));
  const multi = items.length > 1;

  let current = 0, player = null, theatre = false, started = false, hasPlayed = false, ownsFullscreen = false;
  let upNextTimer = 0, errorTimer = 0, introTimer = 0, watchdog = 0, prepared = false;
  const clearTimers = () => { [upNextTimer, errorTimer, introTimer, watchdog].forEach(clearTimeout); counting(false); };

  // ---- The screen ------------------------------------------------------------------------
  const screen = h('div', { class: `cinema__screen cinema__screen--${theme}` });
  const caption = h('p', { class: 'cinema__now', 'aria-live': 'polite' });
  const endCard = h('div', { class: 'cinema__end', hidden: true });
  const upNext = h('div', { class: 'cinema__upnext', hidden: true, role: 'status' });
  const prompt = h('p', { class: 'cinema__prompt', hidden: true, role: 'status' }, h('span', { html: icons.play }), 'Press Play to start');
  // the introduction's golden line along the top of the screen, filling up until the video starts
  const countdown = h('span', { class: 'cinema__countdown', 'aria-hidden': 'true', style: { '--intro': `${introMs}ms` } });
  const hint = h('span', {}, `${playLabel} · it opens in full screen`);
  function counting(on) {
    el.classList.toggle('is-counting', on);
    hint.textContent = on ? startingText : `${playLabel} · it opens in full screen`;
    countdown.classList.remove('is-running');
    if (on) { void countdown.offsetWidth; countdown.classList.add('is-running'); } // restart the line
  }

  // the messages are counted without the films placed among them
  const messages = items.filter((v) => v.kind !== 'film');
  const messageNo = (v) => messages.indexOf(v) + 1;
  const name = (v) => (v.kind === 'film' ? v.title : `${itemLabel} ${messageNo(v)} of ${messages.length}`);
  const label = (v) => [multi && v ? name(v) : '', v?.from ? `From ${v.from}` : ''].filter(Boolean).join(' · ');

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
      counting(false);
      endCard.hidden = true;
      prompt.hidden = true;
      if (!theatre) openTheatre();
      else music.hold(quiet); // (again, after a video that could not be played let it go)
    });
    vid.addEventListener('playing', () => { hasPlayed = true; clearTimeout(watchdog); });
    player.el.classList.add('is-entering');
    screen.replaceChildren(player.el, countdown, upNext, endCard, prompt);
    caption.textContent = label(v);
    bar.label.textContent = label(v) || v.title || title.replace(/<[^>]+>/g, '');
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
    if (!theatre) music.release(quiet); // the music is back to normal while the page waits for a click
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
    music.release(quiet); // nothing is playing: the music comes back to normal (a next video softens it again)
    if (multi && current < items.length - 1 && (theatre || deck.autoplaying)) {
      errorTimer = setTimeout(() => load(current + 1, { autoplay: true }), SKIP_MS);
    } else if (deck.autoplaying) {
      errorTimer = setTimeout(finish, SKIP_MS);
    }
  }

  /** Automatic presentation: back to the presentation view, then on to the next scene.
   *  The music comes back up to normal as the theatre closes. */
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
        h('p', { class: 'cinema__upnext-name' }, nextItem.from || name(nextItem)),
        h('span', { class: 'cinema__upnext-bar', 'aria-hidden': 'true' }),
      );
      upNext.hidden = false;
      upNextTimer = setTimeout(() => load(current + 1, { autoplay: true }), UP_NEXT_MS);
      return;
    }
    music.release(quiet); // the last video has ended: the music comes back up (Watch again softens it again)
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

  /** Show the introduction for `introMs`, then play by itself (one timer, never two). */
  function queueAutoStart() {
    clearTimeout(introTimer);
    counting(true);
    introTimer = setTimeout(() => {
      counting(false);
      if (mayAutoplay() && here() && !started) start();
      else if (!theatre) music.release(quiet);
    }, introMs);
  }

  // ---- Theatre ---------------------------------------------------------------------------
  const fsIcon = h('span', { html: icons.expand });
  const fsText = h('span', { class: 'theatre-bar__text' }, 'Full screen');
  const text = (t) => h('span', { class: 'theatre-bar__text' }, t);
  // Just three buttons: Back, Full screen / Normal screen, Next. Among the wishes, Back and
  // Next move between the messages first, then to the previous / next page. Esc closes the video.
  const bar = {
    back: h('button', { class: 'btn btn--light', type: 'button', title: 'Back  (←)', onclick: () => step(-1) || deck.go(deck.index - 1, { dir: -1, atEnd: true }) }, h('span', { html: icons.prev }), text('Back')),
    fs: h('button', { class: 'btn btn--light theatre-bar__fs', type: 'button', onclick: () => toggleFullscreen() }, fsIcon, fsText),
    next: h('button', { class: 'btn btn--celebrate', type: 'button', title: 'Next', onclick: () => step(1) || deck.go(deck.index + 1, { dir: 1 }) }, text('Next'), h('span', { html: icons.next })),
    label: h('span', { class: 'theatre-bar__label' }),
  };
  const theatreBar = h('div', { class: 'theatre-bar', role: 'toolbar', 'aria-label': 'Video' },
    bar.back,
    h('span', { class: 'theatre-bar__mid' }, bar.label),
    h('span', { class: 'theatre-bar__end' }, document.fullscreenEnabled ? bar.fs : null, bar.next),
  );
  const syncFsButton = () => {
    const on = !!document.fullscreenElement;
    fsIcon.innerHTML = on ? icons.shrink : icons.expand;
    fsText.textContent = on ? 'Normal screen' : 'Full screen';
    bar.fs.setAttribute('aria-label', on ? 'Normal screen (leave full screen)' : 'Full screen');
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
    music.hold(quiet); // soft between two wishes, too
    player.el.focus({ preventScroll: true });
    document.addEventListener('keydown', onTheatreKey, true);
    enterFullscreen();
    announce('Playing in full screen. Press Escape to return to the page.');
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
    music.release(quiet); // back to normal
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
  const metaText = meta ?? (multi ? `${messages.length} messages${total >= 90 ? ` · about ${Math.round(total / 60)} minutes` : ''}` : fmtLength(items[0]?.duration));

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
      items.length ? h('p', { class: 'cinema__hint' }, h('span', { html: icons.expand }), hint) : null),
  ));

  return {
    hint: items.length ? metaText : 'Waiting for the family’s video',
    enter() {
      started = false;
      if (items.length && current !== 0 && multi) load(0);
      if (items.length && mayAutoplay()) queueAutoStart();
    },
    /** The page before this one is showing: decode the poster now, so this page appears without a stall. */
    prepare() {
      const poster = items[0]?.poster;
      if (!poster || prepared) return;
      prepared = true;
      const img = new Image();
      img.src = url(poster);
      img.decode?.().catch(() => {});
    },
    leave() {
      clearTimers();
      closeTheatre();
      player?.pause();
      prompt.hidden = true;
      music.release(quiet);
    },
    /** Automatic presentation switched on or off while this scene is showing. */
    autoChanged(on) {
      if (on && items.length && !started && !theatre) queueAutoStart();
      if (!on) {
        clearTimeout(introTimer);
        counting(false);
        if (!theatre) music.release(quiet);
      }
    },
    step(dir) {
      // A clicker has no mouse: the first "Next" on an unwatched screen starts the film
      if (dir > 0 && items.length && !started && !theatre) { started = true; clearTimers(); start(); return true; }
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
