// Background music from a file (data/site.json → music.src), all the way through.
// It never starts by itself: Begin the Celebration (or M) starts it.
// There is only ever one <audio> for the whole presentation, and this is the
// one place that decides whether it is heard:
//
//   heard = the host has the music on (Begin / M) and nothing holds it silent.
//
// A video playing holds it silent (core/player.js), and so does a video page
// from just before its film starts until the page is left (sections/cinema.js).
// While anything holds it, the music fades to zero and is paused: it is never
// heard under a film or a family wish. When the last hold lets go, the music
// waits a moment before it returns (RESUME_DELAY_MS), so a video that follows
// straight on — the next wish, the next video page — takes hold again first and
// the music never flashes up between two videos. Switching the music off (M) is
// the host's choice: nothing turns it back on except Begin or M.
// <body data-music> says off / normal / silent (held for a video).

const listeners = new Set();
const FADE_IN_MS = 1200;
const FADE_OUT_MS = 400; // quick: a video pressed into play by hand is heard alone almost at once
const RESUME_DELAY_MS = 450;

let audio = null;
let config = { title: '', volume: 0.4 };
const state = { available: false, on: false, held: false, title: '' };
const holds = new Set();
let fadeRaf = 0, resumeTimer = 0;

function emit() {
  document.body.dataset.music = !state.on ? 'off' : state.held ? 'silent' : 'normal';
  listeners.forEach((fn) => fn({ ...state }));
}

function fadeTo(target, ms, done) {
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

const shouldSound = () => state.available && state.on && !holds.size;

async function sound() {
  try {
    if (audio.paused) await audio.play();
  } catch (err) {
    console.warn('[music] could not start', err);
    state.on = false;
    emit();
    return;
  }
  if (shouldSound()) fadeTo(config.volume, FADE_IN_MS);
  else silence(); // a video took hold while the track was starting
}

function silence() {
  fadeTo(0, FADE_OUT_MS, () => { if (!shouldSound()) audio.pause(); });
}

/** Bring the music in line with the host's choice and the holds. */
function update() {
  clearTimeout(resumeTimer);
  resumeTimer = 0;
  state.held = holds.size > 0;
  emit();
  if (!audio) return;
  if (shouldSound()) sound();
  else if (!audio.paused) silence();
}

export const music = {
  configure(cfg = {}, resolveUrl = (p) => p) {
    config = { title: cfg.title || '', volume: Number.isFinite(cfg.volume) ? cfg.volume : 0.4 };
    state.title = config.title;
    if (!cfg.src) {
      console.info('[music] No music.src set in data/site.json — the music is off.');
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
  /** Something holds the music silent right now, or has only just let go of it. */
  get silenced() { return holds.size > 0 || !!resumeTimer; },
  /** Can the music actually be heard at this moment? (for the browser tests and rehearsal) */
  get audible() { return !!audio && !audio.paused && audio.volume > 0.001; },

  /** The host's choice: music on (Begin the Celebration, M). */
  play() {
    if (!audio || !state.available) return;
    state.on = true;
    update();
  },
  /** The host's choice: music off (M). Nothing but Begin or M turns it on again. */
  pause() {
    state.on = false;
    update();
  },
  toggle() {
    return state.on ? this.pause() : this.play();
  },
  /** A video is playing, or about to (`reason` names who holds it): fade out and pause. */
  hold(reason) {
    const fresh = !holds.has(reason);
    holds.add(reason);
    if (fresh || resumeTimer) update();
  },
  /** That reason no longer needs silence. The music returns a moment after the last one lets go. */
  release(reason) {
    if (!holds.delete(reason) || holds.size) return;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(update, RESUME_DELAY_MS);
  },
};
