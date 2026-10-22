// Welcome centrepiece: a "50" sculpted from thousands of light particles that
// gather out of scattered dust, with real family photographs drifting around it
// in an orbit of depth, a soft sapphire halo and a few slow light streaks.

import { mountScene, glowTexture, disposeTree } from './stage.js';
import { url } from '../core/data.js';
import { seeded, lerp } from '../core/util.js';

const PALETTE = ['#f7faff', '#c8d3e5', '#8fcbff', '#8fcbff', '#5d95ff', '#e4cf9f'];

/** Sample the glyphs "50" from a 2D canvas into a list of [x, y] points. */
async function sampleNumerals(text, count, rand) {
  try {
    // Playfair Display has lining figures (Cormorant's old-style "5" dips below the line)
    await Promise.race([document.fonts.load('600 400px "Playfair Display"', text), new Promise((r) => setTimeout(r, 1800))]);
  } catch { /* fall back to Georgia */ }
  const W = 1000, H = 560;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.fillStyle = '#fff';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '600 500px "Playfair Display", "Times New Roman", serif';
  g.fillText(text, W / 2, H / 2 + 20);
  const data = g.getImageData(0, 0, W, H).data;
  const candidates = [];
  for (let y = 0; y < H; y += 3) {
    for (let x = 0; x < W; x += 3) {
      if (data[(y * W + x) * 4 + 3] > 140) candidates.push([x / W - 0.5, 0.5 - y / H]);
    }
  }
  const pts = [];
  for (let i = 0; i < count; i++) pts.push(candidates[(rand() * candidates.length) | 0] || [0, 0]);
  return { pts, aspect: W / H };
}

export function mountHeroScene(container, { photos = [] } = {}) {
  return mountScene(container, async (THREE, ctx) => {
    const rand = seeded(1976);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x06142e, 12, 34);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(0, 0, 14);

    const installation = new THREE.Group();
    scene.add(installation);
    const sprite = glowTexture(THREE);

    // ---- Particle numerals -------------------------------------------------
    const COUNT = ctx.small ? 2400 : 4200;
    const { pts } = await sampleNumerals('50', COUNT, rand);
    const WIDTH = 9;
    const pos = new Float32Array(COUNT * 3);
    const start = new Float32Array(COUNT * 3);
    const color = new Float32Array(COUNT * 3);
    const seed = new Float32Array(COUNT);
    const size = new Float32Array(COUNT);
    const col = new THREE.Color();
    for (let i = 0; i < COUNT; i++) {
      const [x, y] = pts[i];
      pos[i * 3] = x * WIDTH;
      pos[i * 3 + 1] = y * WIDTH * 0.56;
      pos[i * 3 + 2] = (rand() - 0.5) * 0.9 * (0.4 + rand());
      // scattered starting cloud
      const r = 9 + rand() * 12, th = rand() * Math.PI * 2, ph = Math.acos(2 * rand() - 1);
      start[i * 3] = r * Math.sin(ph) * Math.cos(th);
      start[i * 3 + 1] = r * Math.sin(ph) * Math.sin(th) * 0.6;
      start[i * 3 + 2] = r * Math.cos(ph) - 4;
      col.set(PALETTE[(rand() * PALETTE.length) | 0]);
      if (rand() > 0.94) col.set('#e4cf9f');
      color.set([col.r, col.g, col.b], i * 3);
      seed[i] = rand();
      size[i] = 34 + rand() * 52;
    }
    const numeralGeo = new THREE.BufferGeometry();
    numeralGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    numeralGeo.setAttribute('aStart', new THREE.BufferAttribute(start, 3));
    numeralGeo.setAttribute('aColor', new THREE.BufferAttribute(color, 3));
    numeralGeo.setAttribute('aSeed', new THREE.BufferAttribute(seed, 1));
    numeralGeo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    const numeralMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: {
        uTime: { value: 0 },
        uProgress: { value: ctx.reduced ? 1 : 0 },
        uPixelRatio: { value: ctx.renderer.getPixelRatio() },
        uSprite: { value: sprite },
      },
      vertexShader: /* glsl */ `
        uniform float uTime, uProgress, uPixelRatio;
        attribute vec3 aStart, aColor;
        attribute float aSeed, aSize;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float delay = aSeed * 0.45;
          float p = clamp((uProgress - delay) / 0.55, 0.0, 1.0);
          p = 1.0 - pow(1.0 - p, 3.0);
          // a gentle curl on the way in
          vec3 from = aStart + vec3(sin(aSeed * 31.0) * 2.0, cos(aSeed * 17.0) * 2.0, 0.0) * (1.0 - p);
          vec3 pos = mix(from, position, p);
          pos += 0.035 * vec3(sin(uTime * 0.9 + aSeed * 40.0), cos(uTime * 0.7 + aSeed * 31.0), sin(uTime * 0.6 + aSeed * 17.0));
          vec4 mv = modelViewMatrix * vec4(pos, 1.0);
          gl_Position = projectionMatrix * mv;
          float twinkle = 0.7 + 0.3 * sin(uTime * 2.0 + aSeed * 90.0);
          gl_PointSize = aSize * uPixelRatio * twinkle / -mv.z;
          vColor = aColor;
          vAlpha = mix(0.15, 1.0, p);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSprite;
        varying vec3 vColor;
        varying float vAlpha;
        void main() {
          float a = texture2D(uSprite, gl_PointCoord).a;
          gl_FragColor = vec4(vColor, a * vAlpha);
        }`,
    });
    const numerals = new THREE.Points(numeralGeo, numeralMat);
    installation.add(numerals);

    // ---- Halo behind the numerals -------------------------------------------
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0x2457d6, transparent: true, opacity: 0.38, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.set(17, 11, 1);
    halo.position.z = -2.5;
    installation.add(halo);

    // ---- Ambient dust --------------------------------------------------------
    const DUST = ctx.small ? 500 : 1100;
    const dustPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dustPos.set([(rand() - 0.5) * 44, (rand() - 0.5) * 26, -rand() * 22 + 4], i * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.09, map: sprite, color: 0x8fcbff, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true }));
    scene.add(dust);

    // ---- Light streaks -------------------------------------------------------
    const streakMat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x8fcbff) } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform vec3 uColor; varying vec2 vUv;
        void main(){ float a = smoothstep(0.0, 0.5, vUv.x) * smoothstep(1.0, 0.5, vUv.x) * smoothstep(0.0, 0.5, vUv.y) * smoothstep(1.0, 0.5, vUv.y);
        gl_FragColor = vec4(uColor, a * 0.5); }`,
    });
    const streaks = [];
    for (let i = 0; i < 5; i++) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(16 + rand() * 10, 0.05 + rand() * 0.06), streakMat);
      m.rotation.z = -0.32 + rand() * 0.12;
      m.position.set((rand() - 0.5) * 30, (rand() - 0.5) * 12, -6 - rand() * 8);
      m.userData.speed = 0.6 + rand() * 0.9;
      scene.add(m);
      streaks.push(m);
    }

    // ---- Orbit of real photographs ------------------------------------------
    const loader = new THREE.TextureLoader();
    const frames = [];
    const frameGroup = new THREE.Group();
    installation.add(frameGroup);
    const frameMat = new THREE.MeshBasicMaterial({ color: 0xe8eef8, transparent: true, opacity: 0, toneMapped: false });
    photos.slice(0, ctx.small ? 7 : 12).forEach((item, i, list) => {
      const aspect = item.width / item.height;
      const h = 1.55, w = Math.min(2.4, h * aspect);
      const hh = w / aspect;
      const group = new THREE.Group();
      const border = new THREE.Mesh(new THREE.PlaneGeometry(w + 0.12, hh + 0.12), frameMat.clone());
      const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, toneMapped: false });
      const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), mat);
      photo.position.z = 0.01;
      group.add(border, photo);
      loader.load(url(item.sm), (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        mat.map = tex;
        mat.needsUpdate = true;
        group.userData.loaded = true;
        ctx.requestRender();
      }, undefined, () => console.warn('[hero] photo texture failed', item.file));
      group.userData = { angle: (i / list.length) * Math.PI * 2, y: (rand() - 0.5) * 4.4, speed: 0.045 + rand() * 0.025, tilt: (rand() - 0.5) * 0.3, mat, border: border.material, loaded: false };
      frameGroup.add(group);
      frames.push(group);
    });

    // ---- Layout + interaction -------------------------------------------------
    const pointer = { x: 0, y: 0 };
    // Photos travel on a tilted elliptical wreath around the numerals (never across them).
    let layout = { x: 3.9, y: 0.2, s: 0.95, rx: 7.2, ry: 3.7, cz: -2.6, fade: 'left' };
    let progressStart = null;

    function resize(w, h) {
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      const portrait = w / h < 0.95;
      layout = portrait
        ? { x: 0, y: 2.7, s: Math.min(0.6, (w / h) * 1.05), rx: 3.3, ry: 2.5, cz: -2.4, fade: 'bottom' }
        : w / h < 1.4
          ? { x: 2.5, y: 0.8, s: 0.78, rx: 6, ry: 3.2, cz: -2.6, fade: 'left' }
          : { x: 3.9, y: 0.2, s: 0.95, rx: 7.2, ry: 3.7, cz: -2.6, fade: 'left' };
      installation.position.set(layout.x, layout.y, 0);
      numerals.scale.setScalar(layout.s);
      halo.scale.set(17 * layout.s, 11 * layout.s, 1);
    }

    function update(t, dt) {
      if (progressStart == null) progressStart = t;
      const intro = ctx.reduced ? 1 : Math.min(1, (t - progressStart) / 3.6);
      numeralMat.uniforms.uTime.value = ctx.reduced ? 0 : t;
      numeralMat.uniforms.uProgress.value = intro;

      // Installation sways slowly and leans toward the pointer
      const sway = ctx.reduced ? 0 : Math.sin(t * 0.18) * 0.16;
      installation.rotation.y = lerp(installation.rotation.y, sway + pointer.x * 0.16, 0.04);
      installation.rotation.x = lerp(installation.rotation.x, -pointer.y * 0.06, 0.04);

      const photoFade = ctx.reduced ? 1 : Math.min(1, Math.max(0, (t - progressStart - 1.4) / 2));
      frames.forEach((f) => {
        const d = f.userData;
        if (!ctx.reduced) d.angle += d.speed * dt;
        const TILT = 0.5; // the wreath leans back, so its upper half recedes
        const x = Math.cos(d.angle) * layout.rx;
        const yy = Math.sin(d.angle) * layout.ry;
        const z = layout.cz + yy * Math.sin(TILT) - Math.abs(Math.cos(d.angle)) * 0.8;
        f.position.set(x, yy * Math.cos(TILT), z);
        f.rotation.set(0, -Math.cos(d.angle) * 0.4, d.tilt * 0.3);
        f.scale.setScalar(0.5 + layout.s * 0.32);
        const depth = 1 - (Math.sin(d.angle) + 1) / 2; // lower half is nearer and brighter
        // keep the headline (left) or the text block (bottom, on phones) clear
        const worldX = x + layout.x, worldY = yy * Math.cos(TILT) + layout.y;
        const clear = layout.fade === 'left'
          ? Math.min(1, Math.max(0, (worldX + 2.6) / 3.2))
          : Math.min(1, Math.max(0, (worldY - 0.9) / 1.4));
        const o = (0.3 + depth * 0.45) * clear * photoFade * (d.loaded ? 1 : 0);
        d.mat.opacity = o;
        d.border.opacity = o * 0.85;
        f.renderOrder = -1; // draw photos first so the light particles always sit on top
      });

      if (!ctx.reduced) {
        streaks.forEach((s) => {
          s.position.x += s.userData.speed * dt;
          s.position.y -= s.userData.speed * dt * 0.33;
          if (s.position.x > 20) { s.position.x = -20; s.position.y = (Math.random() - 0.2) * 12; }
        });
        dust.rotation.y = t * 0.008;
        dust.position.y = Math.sin(t * 0.1) * 0.3;
      }
      ctx.renderer.render(scene, camera);
    }

    return {
      update,
      resize,
      pointer(x, y) { pointer.x = x; pointer.y = y; },
      replay() { progressStart = null; },
      dispose() { disposeTree(scene); sprite.dispose(); },
    };
  });
}
