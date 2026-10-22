// Ambient music. Never autoplays: it starts only from a user gesture.
// If data/site.json → music.src is set, that file is played on a loop.
// Otherwise a soft "music box" is synthesised with the Web Audio API:
// one gentle Happy Birthday melody, then a slow, quiet arpeggio loop.

const listeners = new Set();
let state = { on: false };
let engine = null;

function emit() {
  listeners.forEach((fn) => fn(state.on));
}

export const music = {
  configure(config = {}, resolveUrl = (p) => p) {
    engine = config.src ? fileEngine(resolveUrl(config.src)) : synthEngine();
  },
  subscribe(fn) {
    listeners.add(fn);
    fn(state.on);
    return () => listeners.delete(fn);
  },
  get on() { return state.on; },
  async play({ fromStart = false } = {}) {
    if (!engine) engine = synthEngine();
    try {
      await engine.play(fromStart);
      state.on = true;
    } catch (err) {
      console.warn('[music] could not start', err);
      state.on = false;
    }
    emit();
  },
  pause() {
    engine?.pause();
    state.on = false;
    emit();
  },
  toggle() {
    return state.on ? this.pause() : this.play();
  },
};

function fileEngine(src) {
  const audio = new Audio();
  audio.src = src;
  audio.loop = true;
  audio.preload = 'none';
  audio.volume = 0.45;
  audio.addEventListener('error', () => {
    console.warn(`[music] could not load ${src}; falling back to the music box`);
    engine = synthEngine();
    if (state.on) engine.play(true);
  });
  return {
    play: (fromStart) => { if (fromStart) audio.currentTime = 0; return audio.play(); },
    pause: () => audio.pause(),
  };
}

function synthEngine() {
  let ctx, master, wet, timer, nextTime = 0, step = 0, melodyDone = false;

  // Happy Birthday in G major — [midi note, beats]
  const MELODY = [
    [67, 0.75], [67, 0.25], [69, 1], [67, 1], [72, 1], [71, 2],
    [67, 0.75], [67, 0.25], [69, 1], [67, 1], [74, 1], [72, 2],
    [67, 0.75], [67, 0.25], [79, 1], [76, 1], [72, 1], [71, 1], [69, 2],
    [77, 0.75], [77, 0.25], [76, 1], [72, 1], [74, 1], [72, 3],
  ];
  const BASS = { 0: 43, 6: 50, 12: 43, 19: 48, 25: 43 }; // root notes under each phrase
  // Ambient progression: Gmaj7 – Em7 – Cmaj7 – D(add9)
  const CHORDS = [
    [55, 62, 66, 69, 74],
    [52, 59, 62, 67, 71],
    [48, 55, 59, 64, 67],
    [50, 57, 62, 64, 69],
  ];
  const PATTERN = [0, 2, 4, 3, 1, 3, 2, 4];
  const BEAT = 0.6;

  const freq = (m) => 440 * Math.pow(2, (m - 69) / 12);

  function init() {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain();
    master.gain.value = 0;
    const lowpass = ctx.createBiquadFilter();
    lowpass.type = 'lowpass';
    lowpass.frequency.value = 5200;
    // Generated impulse response → soft hall reverb
    const reverb = ctx.createConvolver();
    const len = ctx.sampleRate * 3.2;
    const ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let c = 0; c < 2; c++) {
      const d = ir.getChannelData(c);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2);
    }
    reverb.buffer = ir;
    wet = ctx.createGain();
    wet.gain.value = 0.55;
    master.connect(lowpass).connect(ctx.destination);
    master.connect(reverb).connect(wet).connect(ctx.destination);
  }

  function bell(midi, time, { gain = 0.16, decay = 2.2 } = {}) {
    const f = freq(midi);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, time);
    env.gain.linearRampToValueAtTime(gain, time + 0.008);
    env.gain.exponentialRampToValueAtTime(0.0008, time + decay);
    env.connect(master);
    // Fundamental + soft inharmonic partials: a music-box tine
    [[1, 1], [2.01, 0.28], [3.98, 0.08]].forEach(([mult, amp]) => {
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = f * mult;
      g.gain.value = amp;
      osc.connect(g).connect(env);
      osc.start(time);
      osc.stop(time + decay + 0.05);
    });
  }

  function schedule() {
    const horizon = ctx.currentTime + 1.2;
    while (nextTime < horizon) {
      if (!melodyDone) {
        const [note, beats] = MELODY[step];
        bell(note, nextTime, { gain: 0.2, decay: 2.4 });
        if (BASS[step] != null) bell(BASS[step], nextTime, { gain: 0.1, decay: 3 });
        nextTime += beats * BEAT;
        step += 1;
        if (step >= MELODY.length) { melodyDone = true; step = 0; nextTime += BEAT * 2; }
      } else {
        const chord = CHORDS[Math.floor(step / 8) % CHORDS.length];
        const idx = PATTERN[step % 8];
        bell(chord[idx] + 12, nextTime, { gain: 0.075, decay: 2.8 });
        if (step % 8 === 0) bell(chord[0], nextTime, { gain: 0.06, decay: 4 });
        nextTime += BEAT * 0.75;
        step += 1;
      }
    }
  }

  return {
    async play(fromStart) {
      if (!ctx) init();
      if (fromStart) { step = 0; melodyDone = false; }
      await ctx.resume();
      nextTime = Math.max(nextTime, ctx.currentTime + 0.1);
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(0.9, ctx.currentTime, 0.4);
      clearInterval(timer);
      timer = setInterval(schedule, 250);
      schedule();
    },
    pause() {
      if (!ctx) return;
      clearInterval(timer);
      timer = null;
      master.gain.setTargetAtTime(0, ctx.currentTime, 0.25);
      setTimeout(() => { if (!state.on) ctx.suspend(); }, 900);
    },
  };
}
