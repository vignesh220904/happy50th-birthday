// A small, accessible video player around native <video>: play/pause, seek,
// time, mute + volume, captions (if a .vtt is supplied), full screen, a poster,
// keyboard shortcuts and a graceful error state. Used for the family films
// and for the family-wishes videos.

import { h, icons, pad } from './util.js';
import { url } from './data.js';
import { music } from './audio.js';

const fmt = (s) => (Number.isFinite(s) ? `${Math.floor(s / 60)}:${pad(Math.floor(s % 60))}` : '0:00');
const players = new Set();

export function createPlayer({ src, poster, title = 'Video', captions = '', autoplay = false }) {
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
  const playBtn = h('button', { class: 'player__btn', type: 'button', 'aria-label': 'Play', html: icons.play });
  const seek = h('input', { class: 'player__seek', type: 'range', min: 0, max: 1000, value: 0, step: 1, 'aria-label': 'Seek' });
  const time = h('span', { class: 'player__time', 'aria-live': 'off' }, '0:00 / 0:00');
  const muteBtn = h('button', { class: 'player__btn', type: 'button', 'aria-label': 'Mute', html: icons.volume });
  const volume = h('input', { class: 'player__volume', type: 'range', min: 0, max: 1, step: 0.05, value: 1, 'aria-label': 'Volume' });
  const ccBtn = captions ? h('button', { class: 'player__btn', type: 'button', 'aria-label': 'Captions', 'aria-pressed': 'true', html: icons.captions }) : null;
  const fsBtn = h('button', { class: 'player__btn', type: 'button', 'aria-label': 'Full screen', html: icons.expand });
  const errorBox = h('div', { class: 'player__error', hidden: true, role: 'status' },
    h('p', {}, 'This video could not be played.'),
    h('p', { class: 'player__error-hint' }, 'Please check that the file exists and is an MP4 (H.264) video.'),
  );

  const root = h('div', { class: 'player', tabindex: '-1' },
    video,
    bigPlay,
    errorBox,
    h('div', { class: 'player__controls' }, playBtn, seek, time, h('div', { class: 'player__right' }, muteBtn, volume, ccBtn, fsBtn)),
  );

  const toggle = () => (video.paused ? video.play().catch(onError) : video.pause());
  const sync = () => {
    const playing = !video.paused && !video.ended;
    root.classList.toggle('is-playing', playing);
    playBtn.innerHTML = playing ? icons.pause : icons.play;
    playBtn.setAttribute('aria-label', playing ? 'Pause' : 'Play');
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
  function onError() {
    if (!video.error) return;
    root.classList.add('has-error');
    errorBox.hidden = false;
    console.warn(`[player] could not play ${src}`, video.error);
  }

  bigPlay.addEventListener('click', toggle);
  playBtn.addEventListener('click', toggle);
  video.addEventListener('click', toggle);
  video.addEventListener('play', () => {
    // Only one video at a time, and let the background music rest
    players.forEach((p) => p !== api && p.pause());
    if (music.on) { music.pause(); api.resumeMusic = true; }
    sync();
  });
  video.addEventListener('pause', () => {
    sync();
    if (api.resumeMusic) { api.resumeMusic = false; music.play(); }
  });
  video.addEventListener('ended', sync);
  video.addEventListener('timeupdate', syncTime);
  video.addEventListener('loadedmetadata', syncTime);
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
    if (document.fullscreenElement) document.exitFullscreen();
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
    if (e.target === seek || e.target === volume) return;
    const k = e.key.toLowerCase();
    if (k === ' ' || k === 'k') { e.preventDefault(); toggle(); }
    else if (k === 'm') video.muted = !video.muted;
    else if (k === 'f') fsBtn.click();
    else if (k === 'arrowright') video.currentTime = Math.min(video.duration || 0, video.currentTime + 5);
    else if (k === 'arrowleft') video.currentTime = Math.max(0, video.currentTime - 5);
  });

  const api = {
    el: root,
    video,
    resumeMusic: false,
    play: () => video.play().catch(onError),
    pause: () => video.pause(),
    destroy() {
      video.pause();
      video.removeAttribute('src');
      video.load();
      document.removeEventListener('fullscreenchange', onFullscreen);
      players.delete(api);
    },
  };
  players.add(api);
  syncVolume();
  if (autoplay) requestAnimationFrame(() => api.play());
  return api;
}

let cinema, cinemaPlayer;

/** Open a film full-screen in a modal "cinema" dialog. */
export function openCinema({ src, poster, title, description, label }) {
  if (!cinema) {
    cinema = h('dialog', { class: 'cinema', 'aria-label': 'Film player' });
    cinema.addEventListener('close', () => {
      cinemaPlayer?.destroy();
      cinemaPlayer = null;
      document.documentElement.classList.remove('has-modal');
    });
    cinema.addEventListener('click', (e) => { if (e.target === cinema) cinema.close(); });
    document.body.append(cinema);
  }
  cinema.replaceChildren();
  cinemaPlayer = createPlayer({ src, poster, title, autoplay: true });
  cinema.append(
    h('div', { class: 'cinema__bar' },
      h('div', {},
        label ? h('span', { class: `media-label ${/AI/.test(label) ? 'media-label--illustration' : ''}` }, label) : null,
        h('h2', { class: 'cinema__title' }, title),
      ),
      h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Close film', html: icons.close, onclick: () => cinema.close() }),
    ),
    cinemaPlayer.el,
    description ? h('p', { class: 'cinema__desc' }, description) : null,
  );
  document.documentElement.classList.add('has-modal');
  cinema.showModal();
  cinemaPlayer.el.focus({ preventScroll: true });
}
