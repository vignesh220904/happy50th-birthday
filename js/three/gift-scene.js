// Finale centrepiece: a royal-blue gift with silver ribbons on a dark stage,
// encircled by a slow ring of 50 small gifts — one for every year. Opening the
// lid releases light, and the 50 gifts light up one after another.

import { mountScene, glowTexture, disposeTree } from './stage.js';
import { seeded, lerp, easeOutCubic, easeInOutCubic } from '../core/util.js';

/** Box geometry with rounded edges (core three.js has no RoundedBoxGeometry). */
function roundedBox(THREE, w, h, d, r, seg = 4) {
  const geo = new THREE.BoxGeometry(w, h, d, seg * 2, seg * 2, seg * 2);
  const p = geo.attributes.position;
  const v = new THREE.Vector3(), inner = new THREE.Vector3();
  const hw = w / 2 - r, hh = h / 2 - r, hd = d / 2 - r;
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    inner.set(Math.max(-hw, Math.min(hw, v.x)), Math.max(-hh, Math.min(hh, v.y)), Math.max(-hd, Math.min(hd, v.z)));
    v.sub(inner).normalize().multiplyScalar(r).add(inner);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  geo.computeVertexNormals();
  return geo;
}

/** Merge indexed geometries that share the same attributes (position/normal/uv). */
function merge(THREE, geos) {
  const out = new THREE.BufferGeometry();
  const names = ['position', 'normal', 'uv'];
  const arrays = Object.fromEntries(names.map((n) => [n, []]));
  const index = [];
  let offset = 0;
  geos.forEach((g) => {
    names.forEach((n) => arrays[n].push(...g.attributes[n].array));
    g.index.array.forEach((i) => index.push(i + offset));
    offset += g.attributes.position.count;
    g.dispose();
  });
  out.setAttribute('position', new THREE.Float32BufferAttribute(arrays.position, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(arrays.normal, 3));
  out.setAttribute('uv', new THREE.Float32BufferAttribute(arrays.uv, 2));
  out.setIndex(index);
  return out;
}

/** A tiny procedural studio so metals and clearcoat have something to reflect. */
function studioEnvironment(THREE, renderer) {
  const env = new THREE.Scene();
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(20, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      vertexShader: 'varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'varying vec3 vP; void main(){ float y = normalize(vP).y; vec3 c = mix(vec3(0.02,0.06,0.16), vec3(0.35,0.55,0.95), smoothstep(-0.3, 0.9, y)); gl_FragColor = vec4(c,1.0); }',
    }),
  );
  env.add(dome);
  const panel = (color, intensity, pos, size) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(...size), new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide }));
    m.position.set(...pos);
    m.lookAt(0, 0, 0);
    env.add(m);
  };
  panel('#ffffff', 5, [6, 8, 6], [8, 4]);
  panel('#8fcbff', 3, [-9, 3, -2], [5, 10]);
  panel('#ffe8c2', 2.2, [2, 2, -9], [6, 4]);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.04).texture;
  pmrem.dispose();
  disposeTree(env);
  return tex;
}

export function mountGiftScene(container, { count = 50, onOpenChange } = {}) {
  return mountScene(container, (THREE, ctx) => {
    const rand = seeded(5050);
    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(0x06142e, 14, 30);
    scene.environment = studioEnvironment(THREE, ctx.renderer);
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 100);
    const sprite = glowTexture(THREE);

    scene.add(new THREE.HemisphereLight(0xa9d4ff, 0x061230, 0.7));
    const key = new THREE.DirectionalLight(0xfff4e6, 1.6);
    key.position.set(4, 7, 5);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x5d95ff, 1.4);
    rim.position.set(-6, 3, -5);
    scene.add(rim);
    const inner = new THREE.PointLight(0xffe7b8, 0, 9, 1.6);
    inner.position.set(0, 1.1, 0);
    scene.add(inner);

    // ---- Stage ---------------------------------------------------------------
    const floor = new THREE.Mesh(
      new THREE.CircleGeometry(60, 72),
      new THREE.MeshStandardMaterial({ color: 0x061533, roughness: 0.55, metalness: 0.15, envMapIntensity: 0.5 }),
    );
    floor.rotation.x = -Math.PI / 2;
    scene.add(floor);
    const pool = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 9),
      new THREE.MeshBasicMaterial({ map: sprite, color: 0x2457d6, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.y = 0.01;
    scene.add(pool);

    // ---- The gift ------------------------------------------------------------
    const blue = new THREE.MeshPhysicalMaterial({ color: 0x2457d6, roughness: 0.32, metalness: 0.05, clearcoat: 1, clearcoatRoughness: 0.18, envMapIntensity: 1 });
    const silver = new THREE.MeshStandardMaterial({ color: 0xdfe6f2, roughness: 0.22, metalness: 1, envMapIntensity: 1.3 });
    const gift = new THREE.Group();
    scene.add(gift);

    const body = new THREE.Mesh(roundedBox(THREE, 2.2, 1.7, 2.2, 0.09), blue);
    body.position.y = 0.85;
    gift.add(body);
    const ribbonV = new THREE.Mesh(roundedBox(THREE, 0.34, 1.72, 2.24, 0.03, 2), silver);
    ribbonV.position.y = 0.85;
    const ribbonH = new THREE.Mesh(roundedBox(THREE, 2.24, 1.72, 0.34, 0.03, 2), silver);
    ribbonH.position.y = 0.85;
    gift.add(ribbonV, ribbonH);

    // Lid pivots on its back edge
    const lidPivot = new THREE.Group();
    lidPivot.position.set(0, 1.7, -1.16);
    gift.add(lidPivot);
    const lid = new THREE.Group();
    lid.position.set(0, 0, 1.16);
    lidPivot.add(lid);
    lid.add(new THREE.Mesh(roundedBox(THREE, 2.4, 0.42, 2.4, 0.08), blue));
    const lidRibbon1 = new THREE.Mesh(roundedBox(THREE, 0.36, 0.44, 2.44, 0.03, 2), silver);
    const lidRibbon2 = new THREE.Mesh(roundedBox(THREE, 2.44, 0.44, 0.36, 0.03, 2), silver);
    lid.add(lidRibbon1, lidRibbon2);
    // Bow: two loops and a knot
    const loopGeo = new THREE.TorusGeometry(0.42, 0.1, 16, 48);
    [-1, 1].forEach((side) => {
      // each loop stands upright, stretched sideways and tilted up like a ribbon bow
      const loop = new THREE.Mesh(loopGeo, silver);
      loop.position.set(side * 0.44, 0.52, 0);
      loop.rotation.set(0, side * 0.55, side * -0.38);
      loop.scale.set(1.35, 0.95, 1);
      lid.add(loop);
    });
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.17, 24, 16), silver);
    knot.position.y = 0.36;
    lid.add(knot);

    const hitTargets = [body, ribbonV, ribbonH, lid];

    // Light released from inside the gift
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(1.0, 0.85, 7, 40, 1, true),
      new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide,
        uniforms: { uOpen: { value: 0 }, uTime: { value: 0 } },
        vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
        fragmentShader: `uniform float uOpen, uTime; varying vec2 vUv;
          void main(){ float fade = pow(1.0 - vUv.y, 1.6); float rays = 0.6 + 0.4 * sin(vUv.x * 40.0 + uTime * 0.8);
          gl_FragColor = vec4(vec3(1.0, 0.92, 0.78), fade * rays * uOpen * 0.32); }`,
      }),
    );
    beam.position.y = 1.7 + 3.5;
    gift.add(beam);
    const glowCore = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0xffe2a8, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
    glowCore.scale.set(4, 3, 1);
    glowCore.position.y = 1.9;
    gift.add(glowCore);

    // ---- Ring of 50 small gifts (instanced) -----------------------------------
    const smallBox = roundedBox(THREE, 0.5, 0.5, 0.5, 0.05, 2);
    const smallRibbon = merge(THREE, [
      roundedBox(THREE, 0.12, 0.52, 0.52, 0.015, 1),
      roundedBox(THREE, 0.52, 0.52, 0.12, 0.015, 1),
    ]);
    const boxes = new THREE.InstancedMesh(smallBox, new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.8, clearcoatRoughness: 0.2, emissive: 0x2457d6, emissiveIntensity: 0.0 }), count);
    const ribbons = new THREE.InstancedMesh(smallRibbon, silver, count);
    const shades = [0x2457d6, 0x164e9a, 0x2f6be8, 0x8fcbff, 0xc8d3e5, 0x0a2148];
    const ringData = [];
    for (let i = 0; i < count; i++) {
      boxes.setColorAt(i, new THREE.Color(shades[i % shades.length]));
      ringData.push({ a: (i / count) * Math.PI * 2, y: 0.5 + Math.sin(i * 1.7) * 0.45 + rand() * 0.5, r: 4.6 + Math.sin(i * 2.3) * 0.6, spin: rand() * Math.PI, s: 0.6 + rand() * 0.45 });
    }
    boxes.instanceColor.needsUpdate = true;
    scene.add(boxes, ribbons);
    // A glow sprite per small gift, revealed in sequence when the gift opens
    const twinkles = new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: sprite, color: 0xbfe0ff, transparent: true, opacity: 0.0, depthWrite: false, blending: THREE.AdditiveBlending }),
      count,
    );
    scene.add(twinkles);

    // ---- Sparkles ------------------------------------------------------------
    const SP = ctx.small ? 260 : 520;
    const spPos = new Float32Array(SP * 3);
    const spSeed = new Float32Array(SP);
    for (let i = 0; i < SP; i++) {
      const a = rand() * Math.PI * 2, r = 1 + rand() * 9;
      spPos.set([Math.cos(a) * r, rand() * 8, Math.sin(a) * r], i * 3);
      spSeed[i] = rand();
    }
    const spGeo = new THREE.BufferGeometry();
    spGeo.setAttribute('position', new THREE.BufferAttribute(spPos, 3));
    spGeo.setAttribute('aSeed', new THREE.BufferAttribute(spSeed, 1));
    const spMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      uniforms: { uTime: { value: 0 }, uOpen: { value: 0 }, uPR: { value: ctx.renderer.getPixelRatio() }, uSprite: { value: sprite } },
      vertexShader: /* glsl */ `
        uniform float uTime, uOpen, uPR; attribute float aSeed; varying float vA; varying float vWarm;
        void main(){
          vec3 p = position;
          p.y = mod(p.y + uTime * (0.25 + aSeed * 0.35) * (0.4 + uOpen), 8.0);
          p.x += sin(uTime * 0.5 + aSeed * 30.0) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = (18.0 + aSeed * 30.0) * uPR / -mv.z;
          vA = (0.25 + 0.75 * uOpen) * smoothstep(0.0, 1.0, p.y) * smoothstep(8.0, 5.0, p.y);
          vWarm = step(0.7, aSeed);
        }`,
      fragmentShader: /* glsl */ `
        uniform sampler2D uSprite; varying float vA; varying float vWarm;
        void main(){ float a = texture2D(uSprite, gl_PointCoord).a; vec3 c = mix(vec3(0.75, 0.87, 1.0), vec3(1.0, 0.9, 0.72), vWarm); gl_FragColor = vec4(c, a * vA); }`,
    });
    scene.add(new THREE.Points(spGeo, spMat));

    // ---- State + animation -----------------------------------------------------
    let open = false, openT = 0, openedAt = 0, now = 0;
    const pointer = { x: 0, y: 0 };
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), sV = new THREE.Vector3(), pV = new THREE.Vector3();
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    let camDist = 14.5;

    function setOpen(value) {
      if (open === value) return;
      open = value;
      openedAt = now;
      if (ctx.reduced) openT = open ? 1 : 0;
      onOpenChange?.(open);
      ctx.requestRender();
    }

    function resize(w, h) {
      camera.aspect = w / h;
      camDist = w / h < 0.8 ? 21 : w / h < 1.2 ? 17 : 14.5;
      // fog follows the camera distance: the gift stays crisp, the floor's edge dissolves
      scene.fog.near = camDist + 2;
      scene.fog.far = camDist + 20;
      camera.updateProjectionMatrix();
    }

    function update(t, dt) {
      now = t;
      const target = open ? 1 : 0;
      openT = ctx.reduced ? target : lerp(openT, target, Math.min(1, dt * 1.8));
      const o = easeInOutCubic(Math.min(1, openT));

      lidPivot.rotation.x = -o * 1.95;
      lidPivot.position.y = 1.7 + o * 0.25;
      inner.intensity = o * 18;
      beam.material.uniforms.uOpen.value = o;
      beam.material.uniforms.uTime.value = t;
      glowCore.material.opacity = o * 0.9;
      spMat.uniforms.uOpen.value = o;
      spMat.uniforms.uTime.value = ctx.reduced ? 0 : t;
      gift.rotation.y = ctx.reduced ? -0.5 : -0.5 + Math.sin(t * 0.3) * 0.25 + pointer.x * 0.2;
      gift.position.y = ctx.reduced ? 0 : Math.sin(t * 1.1) * 0.04;

      // 50 gifts: a slow orbit; after opening they rise and light up one by one
      const since = open ? t - openedAt : 0;
      for (let i = 0; i < count; i++) {
        const d = ringData[i];
        const a = d.a + (ctx.reduced ? 0 : t * 0.06);
        const lit = ctx.reduced ? (open ? 1 : 0) : open ? easeOutCubic(Math.min(1, Math.max(0, (since - i * 0.06) / 0.8))) : 0;
        pV.set(Math.cos(a) * d.r, d.y + lit * 0.9 + (ctx.reduced ? 0 : Math.sin(t * 0.9 + i) * 0.08), Math.sin(a) * d.r);
        e.set(0.15, d.spin + (ctx.reduced ? 0 : t * 0.3), 0.1);
        q.setFromEuler(e);
        sV.setScalar(d.s * (1 + lit * 0.12));
        m4.compose(pV, q, sV);
        boxes.setMatrixAt(i, m4);
        ribbons.setMatrixAt(i, m4);
        // twinkle billboard faces the camera
        q.copy(camera.quaternion);
        sV.setScalar(lit * 1.5 * d.s);
        m4.compose(pV, q, sV);
        twinkles.setMatrixAt(i, m4);
      }
      boxes.material.emissiveIntensity = o * 0.35;
      twinkles.material.opacity = 0.7;
      boxes.instanceMatrix.needsUpdate = ribbons.instanceMatrix.needsUpdate = twinkles.instanceMatrix.needsUpdate = true;

      // Camera: a gentle orbit that leans toward the pointer
      const ca = ctx.reduced ? 0.25 : 0.25 + Math.sin(t * 0.07) * 0.18 + pointer.x * 0.12;
      // looking above the gift places it in the lower half, clear of the headline
      camera.position.set(Math.sin(ca) * camDist, 4.6 + o * 0.6 - pointer.y * 0.4, Math.cos(ca) * camDist);
      camera.lookAt(0, 2.9 + o * 0.4, 0);
      ctx.renderer.render(scene, camera);
    }

    const onClick = (ev) => {
      const r = ctx.canvas.getBoundingClientRect();
      ndc.set(((ev.clientX - r.left) / r.width) * 2 - 1, -(((ev.clientY - r.top) / r.height) * 2 - 1));
      raycaster.setFromCamera(ndc, camera);
      if (raycaster.intersectObjects(hitTargets, true).length) setOpen(!open);
    };
    ctx.canvas.addEventListener('click', onClick);

    return {
      update,
      resize,
      setOpen,
      get open() { return open; },
      pointer(x, y) {
        pointer.x = x; pointer.y = y;
        ndc.set(x, y);
        raycaster.setFromCamera(ndc, camera);
        ctx.canvas.style.cursor = raycaster.intersectObjects(hitTargets, true).length ? 'pointer' : '';
      },
      dispose() {
        ctx.canvas.removeEventListener('click', onClick);
        scene.environment?.dispose();
        disposeTree(scene);
        sprite.dispose();
      },
    };
  });
}
