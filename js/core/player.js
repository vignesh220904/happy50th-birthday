// A small, accessible video player around native <video>: play/pause, seek,
// time, mute + volume, captions (if a .vtt is supplied), full screen, a poster,
// a loading spinner, keyboard shortcuts and a clear problem state.
//
// Problems are never hidden: a video that cannot be played (a media error, or a
// play() the browser refuses for a reason other than "click first"), or one that
// stays stuck loading for STALL_MS, shows "This video could not be played" with a
// Retry button (and Skip, when the page offers one), and the exact URL and media
// error go to the console. Retry loads the file again from a fresh URL, so a
// damaged copy in the browser's cache cannot get in the way. The spinner only
// shows while the video is really loading.
//
// Presentation behaviour: only one video plays at a time; the background music
// goes soft while any video plays (core/audio.js, from the video's own play /
// playing / pause / ended / error events; the video's own sound is untouched)
// and comes back up afterwards; and <body> gets `.video-playing` so the
// presentation controls can step aside.

import { h, icons, pad } from './util.js';
import { url } from './data.js';
import { music } from './audio.js';

const STALL_MS = 15000; // stuck loading this long (waiting / stalled, no progress) → the problem state
const MEDIA_ERRORS = { 1: 'MEDIA_ERR_ABORTED', 2: 'MEDIA_ERR_NETWORK', 3: 'MEDIA_ERR_DECODE', 4: 'MEDIA_ERR_SRC_NOT_SUPPORTED' };
/** "path?v=abc" + "retry=2" → "path?v=abc&retry=2" */
const withQuery = (u, q) => `${u}${u.includes('?') ? '&' : '?'}${q}`;
const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}` : '0:00');
const players = new Set();

function syncBodyState() {
  const playing = [...players].some((p) => !p.video.paused && !p.video.ended);
  document.body.classList.toggle('video-playing', playing);
  if (playing) music.hold('video'); else music.release('video');
}

// `fullscreen` (optional) replaces the full-screen button's behaviour, so a
// scene with its own theatre view can use that instead of element full screen.
// `onError(problem)` hears about every problem ({ kind: 'error' | 'stalled', url,
// code, name, message }); `onRetry` / `onSkip` (optional) take over the problem
// state's buttons, so a page can restart its own playback or move on.
export function createPlayer({ src, poster, title = 'Video', captions = '', onEnded, onError: onErrorCb, onRetry, onSkip, fullscreen }) {
  const video = h('video', {
    class: 'player__video',
    preload: 'metadata',
    playsinline: true,
    poster: poster ? url(poster) : null,
    'aria-label': title,
  });
  video.src = url(src);
  if (captions) video.append(h('track', { kind: 'captions', src: url(captions), srclang: 'en', label: 'English', default: true }));

  const bigPlay = h('button', { class: 'player__big-play', type: 'button', 'aria-label': `Play ${title}`, html: icons.play });
  const spinner = h('div', { class: 'player__spinner', 'aria-hidden': 'true' });
  const playBtn = h('button', { class: 'player__btn', type: 'button', 'aria-label': 'Play', html: icons.play });
  const seek = h('input', { class: 'player__seek', type: 'range', min: 0, max: 1000, value: 0, step: 1, 'aria-label': 'Seek' });
  const time = h('span', { class: 'player__time', 'aria-live': 'off' }, '0:00 / 0:00');
  const muteBtn = h('button', { class: 'player__btn', type: 'button', 'aria-label': 'Mute', html: icons.volume });
  const volume = h('input', { class: 'player__volume', type: 'range', min: 0, max: 1, step: 0.05, value: 1, 'aria-label': 'Volume' });
  const ccBtn = captions ? h('button', { class: 'player__btn', type: 'button', 'aria-label': 'Captions', 'aria-pressed': 'true', html: icons.captions }) : null;
  const fsBtn = h('button', { class: 'player__btn player__fs', type: 'button', 'aria-label': 'Full screen', html: icons.expand });
  const errorTitle = h('p', { class: 'player__error-title' }, 'This video could not be played.');
  const errorHint = h('p', { class: 'player__error-hint' });
  const retryBtn = h('button', { class: 'btn btn--celebrate', type: 'button' }, h('span', { html: icons.replay }), 'Retry');
  const skipBtn = onSkip ? h('button', { class: 'btn btn--light', type: 'button' }, 'Skip', h('span', { html: icons.next })) : null;
  const errorBox = h('div', { class: 'player__error', hidden: true, role: 'alert' },
    errorTitle, errorHint, h('div', { class: 'player__error-actions' }, retryBtn, skipBtn));

  const root = h('div', { class: 'player is-loading', tabindex: '-1' },
    video,
    spinner,
    bigPlay,
    errorBox,
    h('div', { class: 'player__controls' }, playBtn, seek, time, h('div', { class: 'player__right' }, muteBtn, volume, ccBtn, fsBtn)),
  );

  const toggle = () => (video.paused || video.ended ? video.play().catch(onError) : video.pause());
  const sync = () => {
    const playing = !video.paused && !video.ended;
    root.classList.toggle('is-playing', playing);
    root.classList.toggle('is-ended', video.ended);
    playBtn.innerHTML = playing ? icons.pause : icons.play;
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
    bigPlay.innerHTML = video.ended ? icons.replay : icons.play;
    bigPlay.setAttribute('aria-label', `${video.ended ? 'Replay' : 'Play'} ${title}`);
    syncBodyState();
  };
  const syncTime = () => {
    if (video.duration) seek.value = Math.round((video.currentTime / video.duration) * 1000);
    time.textContent = `${fmt(video.currentTime)} / ${fmt(video.duration)}`;
    seek.setAttribute('aria-valuetext', `${fmt(video.currentTime)} of ${fmt(video.duration)}`);
  };
  const syncVolume = () => {
    muteBtn.innerHTML = video.muted || video.volume === 0 ? icons.mute : icons.volume;
    muteBtn.setAttribute('aria-label', video.muted ? 'Unmute' : 'Mute');
    volume.value = video.muted ? 0 : video.volume;
  };
  let attempt = 0, stallTimer = 0;
  const loaded = () => root.classList.remove('is-loading');
  const clearStall = () => { clearTimeout(stallTimer); stallTimer = 0; };
  /** Loading again: the spinner shows, and if nothing moves for STALL_MS the problem state takes over. */
  const loading = () => {
    root.classList.add('is-loading');
    if (stallTimer || video.paused || root.classList.contains('has-error')) return;
    const at = video.currentTime;
    stallTimer = setTimeout(() => {
      stallTimer = 0;
      if (video.paused || video.currentTime > at + 0.2 || video.readyState >= 3) return; // it got going after all
      problem('stalled');
    }, STALL_MS);
  };
  /** Show what went wrong, say so in the console, and tell the page (once per attempt). */
  function problem(kind = 'error', cause) {
    if (!video.getAttribute('src') || root.classList.contains('has-error')) return; // destroyed on purpose / reported once
    clearStall();
    const err = video.error;
    const info = {
      kind,
      url: video.currentSrc || video.src,
      code: err?.code ?? null,
      name: err ? MEDIA_ERRORS[err.code] || `code ${err.code}` : cause?.name || (kind === 'stalled' ? 'STALLED' : 'PLAY_FAILED'),
      message: err?.message || cause?.message || (kind === 'stalled' ? `no progress for ${STALL_MS / 1000} s (readyState ${video.readyState}, networkState ${video.networkState})` : ''),
    };
    root.classList.remove('is-loading');
    root.classList.add('has-error');
    errorTitle.textContent = kind === 'stalled' ? 'This video is taking too long to load.' : 'This video could not be played.';
    errorHint.textContent = 'Press Retry to load it again.';
    errorBox.hidden = false;
    console.warn(`[player] ${kind === 'stalled' ? 'stalled loading' : 'could not play'} ${info.url}: ${info.name}${info.message ? ` — ${info.message}` : ''}`);
    onErrorCb?.(info);
  }
  const onError = () => { if (video.error) problem('error'); };
  /** Load the file again from a fresh URL (past any damaged cached copy), ready to play. */
  function reload() {
    clearStall();
    attempt += 1;
    root.classList.remove('has-error', 'is-ended');
    root.classList.add('is-loading');
    errorBox.hidden = true;
    const at = video.currentTime;
    video.src = withQuery(url(src), `retry=${attempt}-${Date.now().toString(36)}`);
    video.load();
    if (at > 0) video.addEventListener('loadedmetadata', () => { video.currentTime = at; }, { once: true });
  }
  retryBtn.addEventListener('click', () => (onRetry ? onRetry() : (reload(), video.play().catch((e) => problem('error', e)))));
  skipBtn?.addEventListener('click', () => onSkip());

  bigPlay.addEventListener('click', toggle);
  playBtn.addEventListener('click', toggle);
  video.addEventListener('click', toggle);
  video.addEventListener('play', () => {
    players.forEach((p) => p !== api && p.pause()); // one video at a time
    sync();
  });
  video.addEventListener('playing', () => { clearStall(); sync(); });
  video.addEventListener('pause', () => { clearStall(); sync(); });
  video.addEventListener('ended', () => { sync(); onEnded?.(); });
  video.addEventListener('loadedmetadata', () => { loaded(); syncTime(); });
  video.addEventListener('loadeddata', loaded);
  video.addEventListener('canplay', () => { clearStall(); loaded(); });
  video.addEventListener('waiting', loading);
  video.addEventListener('stalled', () => { if (!video.paused && video.readyState < 3) loading(); });
  video.addEventListener('playing', loaded);
  video.addEventListener('timeupdate', () => { if (video.readyState >= 3) clearStall(); syncTime(); });
  video.addEventListener('volumechange', syncVolume);
  video.addEventListener('error', () => { onError(); sync(); });
  seek.addEventListener('input', () => {
    if (video.duration) video.currentTime = (seek.value / 1000) * video.duration;
  });
  muteBtn.addEventListener('click', () => { video.muted = !video.muted; });
  volume.addEventListener('input', () => {
    video.volume = Number(volume.value);
    video.muted = video.volume === 0;
  });
  ccBtn?.addEventListener('click', () => {
    const track = video.textTracks[0];
    if (!track) return;
    const on = track.mode !== 'showing';
    track.mode = on ? 'showing' : 'hidden';
    ccBtn.setAttribute('aria-pressed', String(on));
  });
  fsBtn.addEventListener('click', () => {
    if (fullscreen) return fullscreen();
    if (document.fullscreenElement === root) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    else video.webkitEnterFullscreen?.(); // iOS Safari
  });
  const onFullscreen = () => {
    if (fullscreen) return;
    const fs = document.fullscreenElement === root;
    fsBtn.innerHTML = fs ? icons.shrink : icons.expand;
    fsBtn.setAttribute('aria-label', fs ? 'Exit full screen' : 'Full screen');
  };
  document.addEventListener('fullscreenchange', onFullscreen);
  root.addEventListener('keydown', (e) => {
    if (e.target === seek || e.target === volume || e.ctrlKey || e.metaKey || e.altKey) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k' || (k === 'enter' && (e.target === root || e.target === video))) { e.preventDefault(); toggle(); }
    else if (k === 'm') video.muted = !video.muted;
    else if (k === 'f') fsBtn.click();
    else if (k === 'arrowright') { e.preventDefault(); video.currentTime = Math.min(video.duration || 0, video.currentTime + 5); }
    else if (k === 'arrowleft') { e.preventDefault(); video.currentTime = Math.max(0, video.currentTime - 5); }
  });

  const api = {
    el: root,
    video,
    fsButton: fsBtn,
    /**
     * Start playing. Resolves 'playing', 'blocked' (the browser wants a click
     * first) or 'error' (the file cannot be played), so the caller never has to
     * guess whether automatic playback really worked.
     */
    play: () => video.play().then(() => 'playing', (err) => {
      if (err?.name === 'NotAllowedError') return 'blocked';
      if (err?.name === 'AbortError') return 'aborted'; // the source changed or was paused before it started
      problem('error', err);
      return 'error';
    }),
    pause: () => { if (!video.paused) video.pause(); },
    /** Load the file again from a fresh URL (see reload); call play() afterwards. */
    retry: reload,
    /** Show the problem state from outside (e.g. a page whose video never started). */
    fail: (kind = 'stalled') => problem(kind),
    /** Words under the problem state's title (e.g. "The presentation moves on in 15 seconds."). */
    setHint: (text) => { errorHint.textContent = text; },
    get failed() { return root.classList.contains('has-error'); },
    destroy() {
      clearStall();
      video.pause();
      video.removeAttribute('src');
      video.load();
      document.removeEventListener('fullscreenchange', onFullscreen);
      players.delete(api);
      syncBodyState();
    },
  };
  players.add(api);
  syncVolume();
  return api;
}

/** Pause every video (used when the presentation moves to another scene). */
export function pauseAll() {
  players.forEach((p) => p.pause());
}
