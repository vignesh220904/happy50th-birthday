// Shared lifecycle for every WebGL scene on the site.
//
//  * Three.js is imported lazily (dynamic import) when a scene is mounted.
//  * The render loop runs only while the scene's presentation slide is the
//    active one and the tab is visible; otherwise it is fully stopped (no idle
//    GPU work).
//  * Pixel ratio is capped (lower on small screens) to stay smooth on laptops
//    and phones. With reduced motion, scenes render calmly with no idle drift.
//  * If WebGL is unavailable the container gets `.no-webgl` and the section's
//    CSS fallback is shown instead.

import { prefersReducedMotion, isSmallScreen } from '../core/util.js';

let threePromise;
// Resolved relative to this module, so it works from index.html and pages/*.html alike.
export const loadThree = () => (threePromise ||= import('../vendor/three.module.min.js'));

export function webglAvailable() {
  try {
    const c = document.createElement('canvas');
    return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
  } catch {
    return false;
  }
}

/**
 * mountScene(container, build) — build(THREE, ctx) must return
 *   { update(time, delta), resize?(w, h), dispose?(), pointer?(x, y) }
 * ctx: { renderer, canvas, width, height, reduced, small, requestRender() }
 * Resolves to a controller { ready, scene, dispose() } or null without WebGL.
 */
export async function mountScene(container, build, { alpha = true } = {}) {
  if (!webglAvailable()) {
    container.classList.add('no-webgl');
    return null;
  }

  let THREE;
  try {
    THREE = await loadThree();
  } catch (err) {
    console.error('[3d] could not load three.js', err);
    container.classList.add('no-webgl');
    return null;
  }

  const small = isSmallScreen();
  const renderer = new THREE.WebGLRenderer({ antialias: !small, alpha, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, small ? 1.5 : 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  const canvas = renderer.domElement;
  canvas.classList.add('scene-canvas');
  canvas.setAttribute('aria-hidden', 'true');
  container.prepend(canvas);

  let running = false, raf = 0, last = performance.now(), needsFrame = true;
  // Visible = the presentation slide holding this scene is on screen
  const slide = container.closest('.scene');
  const isVisible = () => !slide || slide.classList.contains('is-active');
  const origin = performance.now();

  const ctx = {
    renderer,
    canvas,
    width: 1,
    height: 1,
    reduced: prefersReducedMotion(),
    small,
    requestRender: () => { needsFrame = true; if (!raf && !running) raf = requestAnimationFrame(frame); },
  };

  let scene;
  try {
    scene = await build(THREE, ctx);
  } catch (err) {
    console.error('[3d] scene failed to build', err);
    renderer.dispose();
    canvas.remove();
    container.classList.add('no-webgl');
    return null;
  }

  function frame(now) {
    raf = 0;
    // rAF timestamps can be a hair earlier than performance.now(): never step backwards
    const delta = Math.max(0, Math.min(0.05, (now - last) / 1000));
    last = now;
    // Scene time follows the real clock, so tweens take the same seconds on any computer
    const elapsed = (performance.now() - origin) / 1000;
    try {
      scene.update(elapsed, delta);
    } catch (err) {
      console.error('[3d] update failed; stopping scene', err);
      stop();
      return;
    }
    needsFrame = false;
    if (running) raf = requestAnimationFrame(frame);
  }
  function start() {
    if (running) return;
    running = true;
    last = performance.now();
    if (!raf) raf = requestAnimationFrame(frame);
  }
  function stop() {
    running = false;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  // With reduced motion there is no continuous loop: frames are drawn on demand only.
  const evaluate = () => {
    if (!isVisible() || document.hidden) return stop();
    if (ctx.reduced) ctx.requestRender();
    else start();
  };

  const resize = () => {
    const rect = container.getBoundingClientRect();
    ctx.width = Math.max(1, Math.round(rect.width));
    ctx.height = Math.max(1, Math.round(rect.height));
    renderer.setSize(ctx.width, ctx.height, false);
    scene.resize?.(ctx.width, ctx.height);
    if (!running) ctx.requestRender();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(container);
  resize();

  document.addEventListener('deck:change', evaluate);
  document.addEventListener('visibilitychange', evaluate);
  evaluate();

  const onPointer = (e) => {
    if (!scene.pointer) return;
    const r = canvas.getBoundingClientRect();
    scene.pointer(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1), e);
  };
  container.addEventListener('pointermove', onPointer, { passive: true });

  container.classList.add('has-webgl');
  requestAnimationFrame(() => container.classList.add('scene-ready'));

  const controller = {
    scene,
    dispose() {
      stop();
      ro.disconnect();
      document.removeEventListener('deck:change', evaluate);
      document.removeEventListener('visibilitychange', evaluate);
      container.removeEventListener('pointermove', onPointer);
      scene.dispose?.();
      renderer.dispose();
      renderer.forceContextLoss?.();
      canvas.remove();
    },
  };
  addEventListener('pagehide', (e) => { if (!e.persisted) controller.dispose(); }, { once: true });
  return controller;
}

/** Dispose every geometry / material / texture under an object. */
export function disposeTree(root) {
  root.traverse((obj) => {
    obj.geometry?.dispose?.();
    const mats = Array.isArray(obj.material) ? obj.material : obj.material ? [obj.material] : [];
    mats.forEach((m) => {
      Object.values(m).forEach((v) => v && v.isTexture && v.dispose());
      m.dispose();
    });
  });
}

/** Soft round sprite texture (used for glows, stars and dust). */
export function glowTexture(THREE, size = 128) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grad.addColorStop(0, 'rgba(255,255,255,1)');
  grad.addColorStop(0.18, 'rgba(255,255,255,0.85)');
  grad.addColorStop(0.45, 'rgba(255,255,255,0.22)');
  grad.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
