// Tasteful confetti for a light background: Ramar and sapphire blues, powder
// blue, champagne gold and a little silver. One shared full-screen canvas,
// created on first use and stopped as soon as it is empty.

import { prefersReducedMotion } from './util.js';

const COLORS = ['#2f6fd6', '#1f55b0', '#6daae8', '#bbddf8', '#d9b66f', '#c9a14f', '#e8d6a6', '#9fb3cc'];
let canvas, ctx, pieces = [], raf = 0, dpr = 1;

function ensureCanvas() {
  if (canvas) return;
  canvas = document.createElement('canvas');
  canvas.className = 'confetti-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  document.body.append(canvas);
  ctx = canvas.getContext('2d');
  const resize = () => {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr;
    canvas.height = innerHeight * dpr;
  };
  resize();
  addEventListener('resize', resize);
}

/**
 * burst({ x, y }) — x/y are 0..1 fractions of the viewport.
 * mode 'cannon' fires from the origin (straight up, or toward `angle` in radians), 'rain' falls from the top.
 * shape 'petal' draws flower petals; `colors` overrides the palette.
 */
export function confetti({ x = 0.5, y = 0.6, count = 160, mode = 'cannon', angle: aim = -Math.PI / 2, colors = COLORS, shape = 'paper' } = {}) {
  if (prefersReducedMotion()) return; // a still page is kinder than falling paper
  ensureCanvas();
  // A modal <dialog> lives in the browser's top layer; follow it so confetti stays visible.
  const host = document.querySelector('dialog[open]') || document.body;
  if (canvas.parentNode !== host) host.append(canvas);
  const w = innerWidth, hgt = innerHeight;
  const n = innerWidth < 700 ? Math.round(count * 0.6) : count;
  for (let i = 0; i < n; i++) {
    const angle = mode === 'rain' ? Math.PI / 2 : aim + (Math.random() - 0.5) * 1.1;
    const speed = mode === 'rain' ? 1 + Math.random() * 2 : 9 + Math.random() * 9;
    pieces.push({
      x: mode === 'rain' ? Math.random() * w : x * w,
      y: mode === 'rain' ? -20 - Math.random() * hgt * 0.5 : y * hgt,
      vx: Math.cos(angle) * speed * (mode === 'rain' ? 0.3 : 1),
      vy: Math.sin(angle) * speed,
      size: 6 + Math.random() * 7,
      ratio: 0.35 + Math.random() * 0.4,
      rot: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.25,
      flip: Math.random() * Math.PI,
      vf: 0.08 + Math.random() * 0.12,
      color: colors[(Math.random() * colors.length) | 0],
      round: shape === 'paper' && Math.random() < 0.18,
      petal: shape === 'petal',
      life: 0,
    });
  }
  if (!raf) raf = requestAnimationFrame(tick);
}

function tick() {
  const w = canvas.width, hgt = canvas.height;
  ctx.clearRect(0, 0, w, hgt);
  ctx.save();
  ctx.scale(dpr, dpr);
  pieces = pieces.filter((p) => p.y < innerHeight + 40 && p.life < 600);
  for (const p of pieces) {
    p.life++;
    p.vx *= 0.985;
    p.vy = p.vy * 0.985 + 0.22;
    p.x += p.vx + Math.sin(p.life * 0.05 + p.flip) * 0.6;
    p.y += p.vy;
    p.rot += p.vr;
    p.flip += p.vf;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.rot);
    ctx.scale(1, Math.cos(p.flip)); // paper flipping in 3D
    ctx.fillStyle = p.color;
    ctx.globalAlpha = Math.min(1, (600 - p.life) / 120);
    if (p.petal) {
      ctx.beginPath();
      ctx.ellipse(0, 0, p.size * 0.42, p.size * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();
    } else if (p.round) {
      ctx.beginPath();
      ctx.arc(0, 0, p.size * 0.35, 0, Math.PI * 2);
      ctx.fill();
    } else {
      ctx.fillRect(-p.size / 2, (-p.size * p.ratio) / 2, p.size, p.size * p.ratio);
    }
    ctx.restore();
  }
  ctx.restore();
  raf = pieces.length ? requestAnimationFrame(tick) : 0;
  if (!raf) ctx.clearRect(0, 0, w, hgt);
}
