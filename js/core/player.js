// A small, accessible video player around native <video>: play/pause, seek,
// time, mute + volume, captions (if a .vtt is supplied), full screen, a poster,
// a loading spinner, keyboard shortcuts and a graceful error state.
//
// Presentation behaviour: only one video plays at a time; the background music
// fades out while a video plays and returns afterwards; and <body> gets
// `.video-playing` so the presentation controls can step aside.

import { h, icons, pad } from './util.js';
import { url } from './data.js';
import { music } from './audio.js';

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}` : '0:00');
const players = new Set();

function syncBodyState() {
  const playing = [...players].some((p) => !p.video.paused && !p.video.ended);
  document.body.classList.toggle('video-playing', playing);
  if (playing) music.duck(); else music.unduck();
}

export function createPlayer({ src, poster, title = 'Video', captions = '', onEnded, onError: onErrorCb }) {
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
  const fsBtn = h('button', { class: 'player__btn', type: 'button', 'aria-label': 'Full screen', html: icons.expand });
  const errorBox = h('div', { class: 'player__error', hidden: true, role: 'status' },
    h('p', {}, 'This video could not be played.'),
    h('p', { class: 'player__error-hint' }, 'Please check that the file is an MP4 (H.264) video.'),
  );

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
  const loaded = () => root.classList.remove('is-loading');
  function onError() {
    if (!video.error) return;
    root.classList.remove('is-loading');
    root.classList.add('has-error');
    errorBox.hidden = false;
    console.warn(`[player] could not play ${src}`, video.error);
    onErrorCb?.(video.error);
  }

  bigPlay.addEventListener('click', toggle);
  playBtn.addEventListener('click', toggle);
  video.addEventListener('click', toggle);
  video.addEventListener('play', () => {
    players.forEach((p) => p !== api && p.pause()); // one video at a time
    sync();
  });
  video.addEventListener('pause', sync);
  video.addEventListener('ended', () => { sync(); onEnded?.(); });
  video.addEventListener('loadedmetadata', () => { loaded(); syncTime(); });
  video.addEventListener('loadeddata', loaded);
  video.addEventListener('waiting', () => root.classList.add('is-loading'));
  video.addEventListener('playing', loaded);
  video.addEventListener('timeupdate', syncTime);
  video.addEventListener('volumechange', syncVolume);
  video.addEventListener('error', onError);
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
    if (document.fullscreenElement === root) document.exitFullscreen();
    else if (root.requestFullscreen) root.requestFullscreen().catch(() => video.webkitEnterFullscreen?.());
    else video.webkitEnterFullscreen?.(); // iOS Safari
  });
  const onFullscreen = () => {
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
    play: () => video.play().catch(onError),
    pause: () => { if (!video.paused) video.pause(); },
    destroy() {
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
