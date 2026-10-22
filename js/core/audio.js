// Background music from a file (data/site.json → music.src), all the way through.
// It never starts by itself: Begin the Celebration (or M) starts it.
// There is only ever one <audio> for the whole presentation.
// Volume fades gently. On ordinary pages it plays at `volume`; while a film or
// a family wish plays it carries on softly underneath (`softVolume`, "ducked")
// and returns to its normal level afterwards. Several things can hold it soft
// at once (a video playing, the wishes between two videos); it returns to
// normal when the last one lets go. <body data-music> says off / normal / soft.

const listeners = new Set();
const FADE_MS = 900;

let audio = null;
let config = { title: '', volume: 0.4, soft: 0.1 };
const state = { available: false, on: false, muted: false, ducked: false, title: '' };
let fadeRaf = 0;
const duckers = new Set();

function emit() {
  document.body.dataset.music = !state.on ? 'off' : state.ducked ? 'soft' : 'normal';
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

const audibleVolume = () => (state.muted ? 0 : state.ducked ? config.soft : config.volume);

export const music = {
  configure(cfg = {}, resolveUrl = (p) => p) {
    const volume = Number.isFinite(cfg.volume) ? cfg.volume : 0.4;
    config = { title: cfg.title || '', volume, soft: Number.isFinite(cfg.softVolume) ? cfg.softVolume : volume / 4 };
    state.title = config.title;
    if (!cfg.src) {
      console.info('[music] No music.src set in data/site.json — the music button is disabled.');
      emit();
      return;
    }
    audio = new Audio();
    audio.src = resolveUrl(cfg.src);
    audio.loop = true;
    audio.preload = 'metadata'; // a long track streams as it plays; nothing big is fetched before Begin
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
    fadeTo(0, 600, () => { if (!state.on) audio.pause(); });
  },
  toggle() {
    return state.on ? this.pause() : this.play();
  },
  setMuted(muted) {
    state.muted = !!muted;
    emit();
    if (audio && state.on) fadeTo(audibleVolume(), 400);
  },
  /** A film or wish is playing (or the wishes are running): the music carries on softly underneath. */
  duck(reason = 'video') {
    duckers.add(reason);
    if (state.ducked) return;
    state.ducked = true;
    emit();
    if (audio && state.on) fadeTo(audibleVolume(), 800);
  },
  /** The video paused or ended: back to the normal level. */
  unduck(reason = 'video') {
    duckers.delete(reason);
    if (!state.ducked || duckers.size) return;
    state.ducked = false;
    emit();
    if (audio && state.on) fadeTo(audibleVolume(), 1200);
  },
};
