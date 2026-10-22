// The opening: a full-screen title card shown while the site loads.
// The years count from 1976 to 2026 as real loading progresses (content, fonts,
// first photos, the 3D engine). Then a 3D "50" turns into view with
// "Happy 50th Birthday, Amma". "Begin the celebration" is the first user
// gesture, so it is also what starts the music.

import { $, $$, h, prefersReducedMotion, announce } from '../core/util.js';
import { music } from '../core/audio.js';
import { confetti } from '../core/confetti.js';

const MIN_MS = 2600; // the count deserves a moment, even on a fast connection
let instance = null;
export const getIntro = () => instance;

export function createIntro() {
  const root = $('#intro');
  if (!root) return null;

  // Skip the opening for deep links such as index.html#memories
  const hash = location.hash.replace('#', '');
  if (hash && hash !== 'welcome') {
    root.remove();
    return null;
  }

  const yearEl = $('.intro__year', root);
  const ring = $('.intro__ring-fill', root);
  const enter = $('.intro__enter', root);
  const status = $('.intro__status', root);
  const page = $$('body > header, body > main, body > footer');
  const reduced = prefersReducedMotion();

  // Extruded 3D numerals: stacked layers pushed back in depth
  const fifty = $('.intro__fifty-3d', root);
  const LAYERS = reduced ? 1 : 14;
  for (let i = LAYERS - 1; i >= 0; i--) {
    fifty.append(h('span', { class: `intro__layer${i === 0 ? ' intro__layer--front' : ''}`, style: { '--z': i } }, '50'));
  }

  const tasks = [];
  let shown = 0, started = performance.now(), raf = 0, resolveReady, closed = false;
  const ready = new Promise((r) => { resolveReady = r; });
  const listeners = new Set();

  page.forEach((el) => { el.inert = true; });
  document.documentElement.classList.add('has-intro');

  const sparks = startSparks($('.intro__sparks', root));

  function progress() {
    if (!tasks.length) return 0;
    return tasks.filter((t) => t.done).length / tasks.length;
  }

  function tick(now) {
    const timeCap = reduced ? 1 : Math.min(1, (now - started) / MIN_MS);
    const target = Math.min(progress(), timeCap);
    shown += (target - shown) * (reduced ? 1 : 0.08);
    if (target === 1 && 1 - shown < 0.004) shown = 1;
    yearEl.textContent = String(1976 + Math.round(shown * 50));
    ring.style.strokeDashoffset = String(100 - shown * 100);
    if (shown >= 1) {
      raf = 0;
      showReady();
      return;
    }
    raf = requestAnimationFrame(tick);
  }

  function showReady() {
    root.classList.remove('is-loading');
    root.classList.add('is-ready');
    status.textContent = 'Ready. Happy 50th Birthday, Amma.';
    setTimeout(() => enter.focus({ preventScroll: true }), reduced ? 0 : 1400);
    resolveReady();
  }

  function close() {
    if (closed) return;
    closed = true;
    music.play({ fromStart: true });
    root.classList.add('is-leaving');
    confetti({ x: 0.5, y: 0.7, count: 200 });
    setTimeout(() => confetti({ mode: 'rain', count: 140 }), 600);
    listeners.forEach((fn) => fn('enter'));
    setTimeout(() => {
      root.hidden = true;
      root.classList.remove('is-leaving', 'is-ready');
      page.forEach((el) => { el.inert = false; });
      document.documentElement.classList.remove('has-intro');
      sparks.stop();
      announce('Welcome. 50 Years of Love.');
    }, reduced ? 50 : 1300);
  }

  enter.addEventListener('click', close);
  root.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && root.classList.contains('is-ready')) close();
  });

  instance = {
    /** Register something the opening should wait for. */
    track(promise) {
      const t = { done: false };
      tasks.push(t);
      Promise.resolve(promise).catch(() => {}).finally(() => { t.done = true; });
      return promise;
    },
    ready,
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    /** Show the opening again (the finale's "Replay her journey"). */
    replay() {
      closed = false;
      shown = 0;
      started = performance.now();
      root.hidden = false;
      root.classList.add('is-loading');
      root.classList.remove('is-ready', 'is-leaving');
      page.forEach((el) => { el.inert = true; });
      document.documentElement.classList.add('has-intro');
      sparks.start();
      if (!raf) raf = requestAnimationFrame(tick);
    },
  };

  // Never wait forever: after 12 s show the card anyway
  setTimeout(() => tasks.forEach((t) => { t.done = true; }), 12000);
  raf = requestAnimationFrame(tick);
  return instance;
}

/** Soft golden and blue sparks rising behind the title card (2D canvas, stops when hidden). */
function startSparks(canvas) {
  if (!canvas || prefersReducedMotion()) return { stop() {}, start() {} };
  const g = canvas.getContext('2d');
  let w = 0, hgt = 0, dpr = 1, raf = 0;
  const N = innerWidth < 700 ? 60 : 120;
  const parts = [];
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 2);
    w = canvas.clientWidth; hgt = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = hgt * dpr;
  };
  const spawn = (p, initial) => Object.assign(p, {
    x: Math.random() * w,
    y: initial ? Math.random() * hgt : hgt + 10,
    r: 0.6 + Math.random() * 2.2,
    vy: 0.2 + Math.random() * 0.7,
    vx: (Math.random() - 0.5) * 0.25,
    gold: Math.random() < 0.35,
    a: 0.3 + Math.random() * 0.6,
    tw: Math.random() * Math.PI * 2,
  });
  resize();
  for (let i = 0; i < N; i++) parts.push(spawn({}, true));
  addEventListener('resize', resize);
  const frame = () => {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    for (const p of parts) {
      p.y -= p.vy; p.x += p.vx; p.tw += 0.05;
      if (p.y < -10) spawn(p, false);
      g.globalAlpha = p.a * (0.6 + 0.4 * Math.sin(p.tw));
      g.fillStyle = p.gold ? '#f1dfb2' : '#9fd2ff';
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
    raf = requestAnimationFrame(frame);
  };
  const api = {
    start() { if (!raf) raf = requestAnimationFrame(frame); },
    stop() { cancelAnimationFrame(raf); raf = 0; g.clearRect(0, 0, w, hgt); },
  };
  api.start();
  return api;
}
