// "50 lights" — the 50 reasons as a constellation. Five clusters (one per
// chapter) sit on a slow ring; the active chapter turns to face the camera and
// its ten lights brighten. Every light is a real, selectable reason.

import { mountScene, glowTexture, disposeTree } from './stage.js';
import { seeded, lerp } from '../core/util.js';

export function mountConstellation(container, { chapters, onSelect, onHover }) {
  return mountScene(container, (THREE, ctx) => {
    const rand = seeded(2710);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    const sprite = glowTexture(THREE);
    const ring = new THREE.Group();
    scene.add(ring);

    const R = 7.2;
    const STAR_COUNT = 50;
    const positions = new Float32Array(STAR_COUNT * 3);
    const glow = new Float32Array(STAR_COUNT);
    const seeds = new Float32Array(STAR_COUNT);
    const chapterOf = [];
    const clusterAngles = chapters.map((_, c) => (c / chapters.length) * Math.PI * 2);

    chapters.forEach((ch, c) => {
      const a = clusterAngles[c];
      const cx = Math.sin(a) * R, cz = Math.cos(a) * R;
      const size = ch.range[1] - ch.range[0] + 1;
      for (let n = ch.range[0]; n <= ch.range[1]; n++) {
        const k = n - ch.range[0];
        // ten lights on a gently irregular wreath, facing the camera
        const theta = Math.PI / 2 - (k / size) * Math.PI * 2 + (rand() - 0.5) * 0.18;
        const r = 1.45 + (rand() - 0.5) * 0.3;
        const lx = Math.cos(theta) * r;
        const ly = Math.sin(theta) * r * 0.92;
        const lz = (rand() - 0.5) * 0.7;
        // rotate the local wreath so it faces outward from the ring centre
        const x = cx + lx * Math.cos(a) + lz * Math.sin(a);
        const z = cz - lx * Math.sin(a) + lz * Math.cos(a);
        positions.set([x, ly, z], (n - 1) * 3);
        seeds[n - 1] = rand();
        chapterOf[n - 1] = c;
      }
    });

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('aGlow', new THREE.BufferAttribute(glow, 1));
    geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uPR: { value: ctx.renderer.getPixelRatio() }, uSprite: { value: sprite } },
      vertexShader: /* glsl */ `
        uniform float uTime, uPR;
        attribute float aGlow, aSeed;
        varying float vGlow;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          float tw = 0.85 + 0.15 * sin(uTime * 1.8 + aSeed * 60.0);
          gl_PointSize = (90.0 + aGlow * 170.0) * tw * uPR / -mv.z;
          vGlow = aGlow;
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSprite;
        varying float vGlow;
        void main() {
          float a = texture2D(uSprite, gl_PointCoord).a;
          vec3 cool = vec3(0.56, 0.80, 1.0);
          vec3 warm = vec3(1.0, 0.93, 0.78);
          vec3 col = mix(cool * 0.8, mix(vec3(0.97, 0.98, 1.0), warm, step(1.5, vGlow)), clamp(vGlow, 0.0, 1.0));
          gl_FragColor = vec4(col, a * (0.35 + 0.65 * clamp(vGlow, 0.0, 1.0)));
        }`,
    });
    const stars = new THREE.Points(geo, mat);
    ring.add(stars);

    // Constellation lines joining the reasons of each chapter in order
    const lines = chapters.map((ch) => {
      const pts = [];
      for (let n = ch.range[0]; n <= ch.range[1]; n++) {
        const next = n === ch.range[1] ? ch.range[0] : n + 1; // close the wreath
        pts.push(new THREE.Vector3().fromArray(positions, (n - 1) * 3), new THREE.Vector3().fromArray(positions, (next - 1) * 3));
      }
      const l = new THREE.LineSegments(
        new THREE.BufferGeometry().setFromPoints(pts),
        new THREE.LineBasicMaterial({ color: 0x8fcbff, transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }),
      );
      ring.add(l);
      return l;
    });

    // Distant dust for depth
    const dustPos = new Float32Array(700 * 3);
    for (let i = 0; i < 700; i++) dustPos.set([(rand() - 0.5) * 50, (rand() - 0.5) * 24, (rand() - 0.5) * 50], i * 3);
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.08, map: sprite, color: 0x6e9fe8, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending })));

    // Halo that marks the selected reason
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0xe4cf9f, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }));
    halo.scale.setScalar(1.6);
    ring.add(halo);

    let activeChapter = 0, selected = 1, targetRot = 0, hovered = -1;
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points.threshold = 0.32;
    const ndc = new THREE.Vector2();

    function targetGlow(i) {
      if (i === selected - 1) return 2;
      return chapterOf[i] === activeChapter ? (i === hovered ? 1.4 : 1) : 0.12;
    }

    function setChapter(c) {
      activeChapter = c;
      // shortest rotation that brings cluster c to the front
      const want = -clusterAngles[c];
      const turns = Math.round((ring.rotation.y - want) / (Math.PI * 2));
      targetRot = want + turns * Math.PI * 2;
      if (ctx.reduced) ring.rotation.y = targetRot;
      ctx.requestRender();
    }
    function setSelected(n) {
      selected = n;
      halo.position.fromArray(positions, (n - 1) * 3);
      ctx.requestRender();
    }

    function pick(x, y) {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      const hits = raycaster.intersectObject(stars).filter((h) => chapterOf[h.index] === activeChapter);
      return hits.length ? hits[0].index : -1;
    }

    const toNdc = (e) => {
      const r = ctx.canvas.getBoundingClientRect();
      return [((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1)];
    };
    const onClick = (e) => {
      const i = pick(...toNdc(e));
      if (i >= 0) onSelect?.(i + 1);
    };
    ctx.canvas.addEventListener('click', onClick);
    ctx.canvas.addEventListener('pointerleave', () => { hovered = -1; onHover?.(null); ctx.canvas.style.cursor = ''; });

    function resize(w, h) {
      camera.aspect = w / h;
      camera.fov = w / h < 0.9 ? 52 : 42;
      camera.position.set(0, 0.6, R + (w / h < 0.9 ? 7.6 : 6.4));
      camera.lookAt(0, 0, R - 0.4);
      camera.updateProjectionMatrix();
    }

    function update(t) {
      mat.uniforms.uTime.value = ctx.reduced ? 0 : t;
      ring.rotation.y = ctx.reduced ? targetRot : lerp(ring.rotation.y, targetRot + Math.sin(t * 0.25) * 0.04, 0.045);
      for (let i = 0; i < STAR_COUNT; i++) glow[i] = ctx.reduced ? targetGlow(i) : lerp(glow[i], targetGlow(i), 0.08);
      geo.attributes.aGlow.needsUpdate = true;
      lines.forEach((l, c) => { l.material.opacity = lerp(l.material.opacity, c === activeChapter ? 0.3 : 0.05, ctx.reduced ? 1 : 0.06); });
      halo.material.opacity = 0.4 + (ctx.reduced ? 0 : Math.sin(t * 2) * 0.12);
      ctx.renderer.render(scene, camera);
    }

    setChapter(0);
    setSelected(1);
    ring.rotation.y = targetRot;

    return {
      update,
      resize,
      setChapter,
      setSelected,
      pointer(x, y, e) {
        const i = pick(x, y);
        if (i !== hovered) {
          hovered = i;
          ctx.canvas.style.cursor = i >= 0 ? 'pointer' : '';
          onHover?.(i >= 0 ? { n: i + 1, x: e.clientX, y: e.clientY } : null);
          ctx.requestRender();
        } else if (i >= 0) {
          onHover?.({ n: i + 1, x: e.clientX, y: e.clientY });
        }
      },
      dispose() {
        ctx.canvas.removeEventListener('click', onClick);
        disposeTree(scene);
        sprite.dispose();
      },
    };
  });
}
