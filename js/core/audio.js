// Background music from a file (data/site.json → music.src), all the way through.
// It never starts by itself: Begin the Celebration (or M) starts it.
// There is only ever one <audio> for the whole presentation, and this is the
// one place that decides how loud it is:
//
//   off    — the host switched it off (M); nothing but Begin or M turns it on again
//   normal — `volume` on ordinary pages
//   soft   — `videoLevel` × `volume` (about 12 %) while something holds it soft
//
// A video playing holds it soft (core/player.js, from the video's own play /
// playing / pause / ended / error events), and so does a video page's theatre,
// so it stays soft from one family wish to the next (sections/cinema.js). The
// music keeps playing underneath — it is never muted or restarted — and the
// videos' own sound is left as it is. When the last hold lets go, the music
// waits a moment before it comes back up (RESUME_DELAY_MS): a video that follows
// straight on takes hold again first, so the volume never jumps up between two
// videos. <body data-music> says off / normal / soft.

const listeners = new Set();
const SOFTEN_MS = 800;
const RESTORE_MS = 1200;
const STOP_MS = 600;
const RESUME_DELAY_MS = 450;

let audio = null;
let config = { title: '', volume: 0.4, videoLevel: 0.12 };
const state = { available: false, on: false, held: false, title: '' };
const holds = new Set();
let fadeRaf = 0, resumeTimer = 0;

function emit() {
  document.body.dataset.music = !state.on ? 'off' : state.held ? 'soft' : 'normal';
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

/** The level the music should be at now: normal, or soft under a video. */
const level = () => config.volume * (holds.size ? config.videoLevel : 1);

async function sound() {
  try {
    if (audio.paused) await audio.play(); // only if it is not already playing: never restarted
  } catch (err) {
    console.warn('[music] could not start', err);
    state.on = false;
    emit();
    return;
  }
  if (state.on) fadeTo(level(), holds.size ? SOFTEN_MS : RESTORE_MS);
}

/** Bring the music in line with the host's choice and the holds. */
function update() {
  clearTimeout(resumeTimer);
  resumeTimer = 0;
  state.held = holds.size > 0;
  emit();
  if (!audio || !state.available) return;
  if (state.on) sound();
  else if (!audio.paused) fadeTo(0, STOP_MS, () => { if (!state.on) audio.pause(); });
}

export const music = {
  configure(cfg = {}, resolveUrl = (p) => p) {
    const lvl = Number(cfg.videoLevel);
    config = {
      title: cfg.title || '',
      volume: Number.isFinite(cfg.volume) ? cfg.volume : 0.4,
      videoLevel: Number.isFinite(lvl) && lvl > 0 && lvl < 1 ? lvl : 0.12,
    };
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
  /** Can the music be heard at this moment? (for the browser tests and rehearsal) */
  get audible() { return !!audio && !audio.paused && audio.volume > 0.001; },
  /** Its volume now, as a share of its normal volume (1 = normal, about 0.12 = soft under a video). */
  get level() { return audio && !audio.paused ? audio.volume / config.volume : 0; },

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
  /** A video is playing, or the theatre is open between two of them (`reason` names who): soften. */
  hold(reason) {
    const fresh = !holds.has(reason);
    holds.add(reason);
    if (fresh || resumeTimer) update();
  },
  /** That reason no longer needs the music soft. It comes back up a moment after the last one lets go. */
  release(reason) {
    if (!holds.delete(reason) || holds.size) return;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(update, RESUME_DELAY_MS);
  },
};
