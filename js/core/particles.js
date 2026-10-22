// Soft floating light behind every scene: champagne-gold, ivory and blue
// bokeh, tiny golden sparkles and a few slowly falling golden leaves.
// Fast enough for a projector laptop: every shape is pre-rendered once to a
// small sprite and only drawn (drawImage) each frame, the canvas runs at a
// capped resolution, it stops in background tabs, and while a video plays it
// rests. With reduced motion it is drawn once, still.

import { prefersReducedMotion, seeded } from './util.js';

const BOKEH = ['217,182,111', '217,182,111', '236,220,178', '198,219,245', '127,166,227', '47,98,192', '255,255,255'];
const PETALS = ['#ecdcb2', '#f6ebcf', '#e4effd', '#fff4ea'];

function sprite(size, draw) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  draw(c.getContext('2d'), size);
  return c;
}
const bokehSprite = (rgb) => sprite(64, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  grad.addColorStop(0, `rgba(${rgb},1)`);
  grad.addColorStop(0.6, `rgba(${rgb},0.55)`);
  grad.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grad;
  g.fillRect(0, 0, s, s);
});
const sparkSprite = (rgb) => sprite(16, (g, s) => {
  g.fillStyle = `rgb(${rgb})`;
  g.beginPath();
  g.arc(s / 2, s / 2, s / 2 - 1, 0, Math.PI * 2);
  g.fill();
});
const petalSprite = (color) => sprite(48, (g, s) => {
  g.translate(s / 2, s / 2);
  const grad = g.createLinearGradient(0, -s / 2, 0, s / 2);
  grad.addColorStop(0, '#ffffff');
  grad.addColorStop(1, color);
  g.fillStyle = grad;
  g.beginPath();
  g.moveTo(0, -s * 0.42);
  g.bezierCurveTo(s * 0.34, -s * 0.3, s * 0.3, s * 0.3, 0, s * 0.44);
  g.bezierCurveTo(-s * 0.3, s * 0.3, -s * 0.34, -s * 0.3, 0, -s * 0.42);
  g.fill();
  g.strokeStyle = 'rgba(201,102,138,0.18)';
  g.lineWidth = 1;
  g.beginPath();
  g.moveTo(0, -s * 0.3);
  g.lineTo(0, s * 0.3);
  g.stroke();
});

export function startParticles(canvas) {
  if (!canvas) return;
  const g = canvas.getContext('2d');
  const rand = seeded(2026);
  const reduced = prefersReducedMotion();
  const bokeh = BOKEH.map(bokehSprite);
  const sparks = ['217,182,111', '255,255,255', '201,102,138'].map(sparkSprite);
  const petals = PETALS.map(petalSprite);
  let w = 0, hgt = 0, dpr = 1, raf = 0;
  const parts = [];

  function spawn(p, initial) {
    const r = rand();
    const kind = r < 0.38 ? 'bokeh' : r < 0.86 ? 'spark' : 'petal';
    const petal = kind === 'petal';
    return Object.assign(p, {
      kind,
      img: kind === 'bokeh' ? bokeh[(rand() * bokeh.length) | 0] : petal ? petals[(rand() * petals.length) | 0] : sparks[(rand() * sparks.length) | 0],
      x: rand() * w,
      y: initial ? rand() * hgt : petal ? -30 : hgt + 30,
      size: kind === 'bokeh' ? 14 + rand() * 34 : petal ? 12 + rand() * 12 : 2 + rand() * 3.5,
      vy: petal ? 0.25 + rand() * 0.35 : -((kind === 'bokeh' ? 0.08 : 0.18) + rand() * 0.3),
      vx: (rand() - 0.5) * (petal ? 0.4 : 0.12),
      a: kind === 'bokeh' ? 0.14 + rand() * 0.18 : petal ? 0.55 + rand() * 0.3 : 0.45 + rand() * 0.45,
      tw: rand() * Math.PI * 2,
      rot: rand() * Math.PI * 2,
      vr: (rand() - 0.5) * 0.02,
    });
  }
  const resize = () => {
    dpr = Math.min(devicePixelRatio || 1, 1.25);
    w = canvas.clientWidth;
    hgt = canvas.clientHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(hgt * dpr);
    const target = Math.round(Math.min(90, Math.max(30, (w * hgt) / 26000)));
    while (parts.length < target) parts.push(spawn({}, true));
    parts.length = target;
    if (reduced) draw();
  };
  function draw() {
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, hgt);
    for (const p of parts) {
      g.globalAlpha = p.a * (p.kind === 'petal' ? 1 : 0.75 + 0.25 * Math.sin(p.tw));
      if (p.kind === 'petal') {
        g.save();
        g.translate(p.x, p.y);
        g.rotate(p.rot);
        g.scale(1, 0.55 + 0.45 * Math.abs(Math.cos(p.tw))); // the petal turning as it falls
        g.drawImage(p.img, -p.size / 2, -p.size / 2, p.size, p.size);
        g.restore();
      } else {
        g.drawImage(p.img, p.x - p.size / 2, p.y - p.size / 2, p.size, p.size);
      }
    }
    g.globalAlpha = 1;
  }
  function frame() {
    raf = 0;
    for (const p of parts) {
      p.y += p.vy;
      p.x += p.vx + Math.sin(p.tw * 0.5) * (p.kind === 'petal' ? 0.35 : 0.05);
      p.tw += p.kind === 'petal' ? 0.02 : 0.012;
      p.rot += p.vr;
      if (p.y < -40 || p.y > hgt + 40) spawn(p, false);
    }
    draw();
    schedule();
  }
  // Rest while the tab is hidden or a video is playing (the viewer is watching the film)
  const resting = () => document.hidden || document.body.classList.contains('video-playing');
  function schedule() {
    if (!raf && !resting()) raf = requestAnimationFrame(frame);
  }
  resize();
  addEventListener('resize', resize);
  if (reduced) return;
  schedule();
  document.addEventListener('visibilitychange', schedule);
  new MutationObserver(schedule).observe(document.body, { attributes: true, attributeFilter: ['class'] });
}
