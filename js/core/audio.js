// Background music from a file (data/site.json → music.src).
// It never starts by itself: only the host's music button (or M) starts it.
// Volume fades in and out gently. While a video with sound plays, the music
// fades out ("ducks") and comes back when the video pauses or ends — but only
// if it was playing before. Several things can hold it down at once (a video
// playing, a playlist of wishes between two videos); it returns when the last
// one lets go.

const listeners = new Set();
const FADE_MS = 900;

let audio = null;
let config = { title: '', volume: 0.4 };
const state = { available: false, on: false, muted: false, ducked: false, title: '' };
let fadeRaf = 0;
const duckers = new Set();

function emit() {
  listeners.forEach((fn) => fn({ ...state }));
}

function fadeTo(target, ms = FADE_MS, done) {
  cancelAnimationFrame(fadeRaf);
  if (!audio) return;
  const from = audio.volume;
  const t0 = performance.now();
  const step = (now) => {
    const k = Math.min(1, (now - t0) / ms);
    audio.volume = Math.max(0, Math.min(1, from + (target - from) * k));
    if (k < 1) fadeRaf = requestAnimationFrame(step);
    else done?.();
  };
  fadeRaf = requestAnimationFrame(step);
}

const audibleVolume = () => (state.muted ? 0 : config.volume);

export const music = {
  configure(cfg = {}, resolveUrl = (p) => p) {
    config = { title: cfg.title || '', volume: Number.isFinite(cfg.volume) ? cfg.volume : 0.4 };
    state.title = config.title;
    if (!cfg.src) {
      console.info('[music] No music.src set in data/site.json — the music button is disabled.');
      emit();
      return;
    }
    audio = new Audio();
    audio.src = resolveUrl(cfg.src);
    audio.loop = true;
    audio.preload = 'auto';
    audio.volume = 0;
    state.available = true;
    audio.addEventListener('error', () => {
      console.warn(`[music] Could not load ${cfg.src}. Check data/site.json → music.src.`);
      state.available = false;
      state.on = false;
      emit();
    });
    emit();
  },
  subscribe(fn) {
    listeners.add(fn);
    fn({ ...state });
    return () => listeners.delete(fn);
  },
  get on() { return state.on; },
  get muted() { return state.muted; },

  async play() {
    if (!audio || !state.available) return;
    state.on = true;
    emit();
    if (state.ducked) return; // a video is playing; the music joins in when it stops
    try {
      await audio.play();
      fadeTo(audibleVolume());
    } catch (err) {
      console.warn('[music] could not start', err);
      state.on = false;
      emit();
    }
  },
  pause() {
    if (!audio) return;
    state.on = false;
    emit();
    fadeTo(0, 600, () => { if (!state.on || state.ducked) audio.pause(); });
  },
  toggle() {
    return state.on ? this.pause() : this.play();
  },
  setMuted(muted) {
    state.muted = !!muted;
    emit();
    if (audio && state.on && !state.ducked) fadeTo(audibleVolume(), 400);
  },
  /** A video with sound started (or a playlist is running): fade the music out. */
  duck(reason = 'video') {
    duckers.add(reason);
    if (state.ducked) return;
    state.ducked = true;
    emit();
    if (audio && state.on) fadeTo(0, 700, () => { if (state.ducked) audio.pause(); });
  },
  /** The video paused or ended: bring the music back if the host had it on. */
  unduck(reason = 'video') {
    duckers.delete(reason);
    if (!state.ducked || duckers.size) return;
    state.ducked = false;
    emit();
    if (audio && state.on) audio.play().then(() => fadeTo(audibleVolume(), 1400)).catch(() => {});
  },
};
