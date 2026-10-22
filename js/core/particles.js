// Soft floating light behind every scene: champagne and blue bokeh with a few
// tiny sparkles, drifting slowly upward. A light-friendly 2D canvas (normal
// blending, so the particles stay visible on the pale background). It stops
// in background tabs, and with reduced motion it is drawn once, still.

import { prefersReducedMotion, seeded } from './util.js';

const COLORS = [
  [217, 182, 111], // champagne gold
  [217, 182, 111],
  [109, 170, 232], // light sapphire
  [47, 111, 214],  // Ramar blue
  [187, 221, 248], // powder blue
  [255, 255, 255], // pearl
];

export function startParticles(canvas) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const rand = seeded(2026);
  const reduced = prefersReducedMotion();
  let w = 0, hgt = 0, dpr = 1, raf = 0;
  const parts = [];

  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth;
    hgt = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
    const target = Math.round(Math.min(110, Math.max(36, (w * hgt) / 22000)));
    while (parts.length < target) parts.push(spawn({}, true));
    parts.length = target;
    if (reduced) draw();
  };
  function spawn(p, initial) {
    const bokeh = rand() < 0.42;
    const [r, gg, b] = COLORS[(rand() * COLORS.length) | 0];
    return Object.assign(p, {
      x: rand() * w,
      y: initial ? rand() * hgt : hgt + 20,
      r: bokeh ? 6 + rand() * 18 : 1 + rand() * 2.2,
      vy: (bokeh ? 0.08 : 0.18) + rand() * 0.3,
      vx: (rand() - 0.5) * 0.12,
      a: bokeh ? 0.12 + rand() * 0.16 : 0.45 + rand() * 0.4,
      tw: rand() * Math.PI * 2,
      rgb: `${r},${gg},${b}`,
      bokeh,
    });
  }
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    for (const p of parts) {
      const alpha = p.a * (0.75 + 0.25 * Math.sin(p.tw));
      if (p.bokeh) {
        const grad = g.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r);
        grad.addColorStop(0, `rgba(${p.rgb},${alpha})`);
        grad.addColorStop(0.65, `rgba(${p.rgb},${alpha * 0.55})`);
        grad.addColorStop(1, `rgba(${p.rgb},0)`);
        g.fillStyle = grad;
      } else {
        g.fillStyle = `rgba(${p.rgb},${alpha})`;
      }
      g.beginPath();
      g.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      g.fill();
    }
  }
  function frame() {
    for (const p of parts) {
      p.y -= p.vy;
      p.x += p.vx + Math.sin(p.tw * 0.5) * 0.05;
      p.tw += 0.012;
      if (p.y < -30) spawn(p, false);
    }
    draw();
    raf = requestAnimationFrame(frame);
  }
  resize();
  addEventListener('resize', resize);
  if (reduced) return;
  raf = requestAnimationFrame(frame);
  document.addEventListener('visibilitychange', () => {
    cancelAnimationFrame(raf);
    if (!document.hidden) raf = requestAnimationFrame(frame);
  });
}
