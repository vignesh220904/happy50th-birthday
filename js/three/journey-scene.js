// Life Journey in 3D: a camera glides through space along a glowing "river of
// time". Each milestone is a station with its photographs floating at different
// depths and its year written large in the darkness behind. Moving to another
// milestone flies the camera along the path (farther jumps fly a little longer),
// so the whole fifty years pass by on the way.
//
// Performance: only stations near the camera are drawn, photo textures load as
// stations approach (small first, sharp version once you arrive), and far-away
// sharp textures are released again.

import { mountScene, glowTexture, disposeTree } from './stage.js';
import { url } from '../core/data.js';
import { seeded, lerp, easeInOutCubic } from '../core/util.js';

const STEP = 22;       // distance between stations along the path (more than any camera distance)
const MAIN_H = 4.6;    // height of a station's main photograph
const SIDE_H = 2.6;

function textTexture(THREE, text, { width = 1024, height = 400, size = 300, color = '#ffffff', glow = '#2f6be8' } = {}) {
  const c = document.createElement('canvas');
  c.width = width;
  c.height = height;
  const g = c.getContext('2d');
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `500 ${size}px "Playfair Display", "Times New Roman", serif`;
  // shrink long labels ("1979 – 1993") so they fit the canvas
  const w = g.measureText(text).width;
  if (w > width * 0.94) g.font = `500 ${Math.floor((size * width * 0.94) / w)}px "Playfair Display", "Times New Roman", serif`;
  g.shadowColor = glow;
  g.shadowBlur = 40;
  const grad = g.createLinearGradient(0, 0, 0, height);
  grad.addColorStop(0, color);
  grad.addColorStop(1, '#8fcbff');
  g.fillStyle = grad;
  g.fillText(text, width / 2, height / 2 + 10);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function labelTexture(THREE, text) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 96;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(60,46,18,0.88)';
  g.beginPath();
  g.roundRect(4, 8, 504, 80, 40);
  g.fill();
  g.strokeStyle = 'rgba(228,207,159,0.8)';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#fff3d6';
  g.font = '700 36px Manrope, "Segoe UI", sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(text, 256, 50);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/**
 * stations: [{ year, media: [{ item, alt }], special: 'fifty' | null }]
 * onPick(stationIndex, photoIndex) is called when a photograph is clicked.
 */
export function mountJourneyScene(container, { stations, onPick }) {
  return mountScene(container, async (THREE, ctx) => {
    try {
      await Promise.race([document.fonts.load('500 100px "Playfair Display"', '0123456789'), new Promise((r) => setTimeout(r, 1500))]);
    } catch { /* fallback font */ }

    const rand = seeded(1997);
    const n = stations.length;
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x06142e, 0.03);
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
    const sprite = glowTexture(THREE);
    const loader = new THREE.TextureLoader();

    // ---- Path -------------------------------------------------------------------
    const anchors = stations.map((_, i) => new THREE.Vector3(Math.sin(i * 0.7) * 5, Math.sin(i * 0.45) * 1.4, -i * STEP));

    // ---- River of time: a glowing line beneath the stations, with light flowing along it
    const riverCurve = new THREE.CatmullRomCurve3(anchors.map((p) => p.clone().add(new THREE.Vector3(0, -3.6, 0))));
    const river = new THREE.Mesh(
      new THREE.TubeGeometry(riverCurve, n * 24, 0.04, 6, false),
      new THREE.MeshBasicMaterial({ color: 0x8fcbff, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false }),
    );
    scene.add(river);
    const FLOW = ctx.small ? 90 : 180;
    const flowPos = new Float32Array(FLOW * 3);
    const flowT = Array.from({ length: FLOW }, () => rand());
    const flowGeo = new THREE.BufferGeometry();
    flowGeo.setAttribute('position', new THREE.BufferAttribute(flowPos, 3));
    const flow = new THREE.Points(flowGeo, new THREE.PointsMaterial({ size: 0.35, map: sprite, color: 0xbfe0ff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
    scene.add(flow);

    // ---- Dust through the whole journey -----------------------------------------
    const DUST = ctx.small ? 1200 : 2400;
    const dustPos = new Float32Array(DUST * 3);
    for (let i = 0; i < DUST; i++) {
      dustPos.set([(rand() - 0.5) * 60, (rand() - 0.5) * 30, 20 - rand() * (n * STEP + 40)], i * 3);
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
    scene.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({ size: 0.12, map: sprite, color: 0x8fcbff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })));

    // ---- Stations ---------------------------------------------------------------
    const paper = new THREE.Color(0xf4f6fb), parchment = new THREE.Color(0xe9dcb8);
    const SIDE_SLOTS = [
      new THREE.Vector3(5.6, 1.6, -3.2),
      new THREE.Vector3(6.2, -1.9, -1.6),
      new THREE.Vector3(4.2, 3.4, -5.5),
    ];
    const pickables = [];
    const builtStations = stations.map((st, i) => {
      const group = new THREE.Group();
      group.position.copy(anchors[i]);
      scene.add(group);

      // the year, large and soft, behind the photographs
      const yearTex = textTexture(THREE, st.special === 'fifty' ? '50' : st.year, st.special === 'fifty' ? { color: '#fff4dc', glow: '#e4cf9f' } : {});
      const empty = !st.media.length;
      const year = new THREE.Mesh(
        new THREE.PlaneGeometry(empty ? 13 : 17, empty ? 5.1 : 6.6),
        new THREE.MeshBasicMaterial({ map: yearTex, transparent: true, opacity: empty ? 0.95 : 0.2, depthWrite: false, fog: !empty }),
      );
      year.position.set(empty ? 0 : -1, empty ? 0.4 : 1.4, empty ? 0 : -7);
      group.add(year);

      if (empty) {
        // a slowly turning ring of light for chapters without a photograph
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(st.special === 'fifty' ? 4.2 : 3.6, 0.03, 8, 160),
          new THREE.MeshBasicMaterial({ color: st.special === 'fifty' ? 0xe4cf9f : 0x8fcbff, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        ring.position.set(0, 0.4, -0.5);
        group.add(ring);
        group.userData.ring = ring;
        const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: st.special === 'fifty' ? 0xe4cf9f : 0x2457d6, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending }));
        halo.scale.set(16, 12, 1);
        halo.position.set(0, 0.4, -2);
        group.add(halo);
      }

      const frames = st.media.map((m, k) => {
        const isMain = k === 0;
        const h = isMain ? MAIN_H : SIDE_H;
        const aspect = m.item.width / m.item.height;
        let w = h * aspect;
        let hh = h;
        const maxW = isMain ? 7.6 : 4;
        if (w > maxW) { w = maxW; hh = w / aspect; }
        const frame = new THREE.Group();
        const pad = isMain ? 0.22 : 0.13;
        const illustration = m.item.kind === 'illustration';

        // photographs keep their true colours: no tone mapping, no fog
        const shadow = new THREE.Mesh(new THREE.PlaneGeometry(w + 1.8, hh + 1.8), new THREE.MeshBasicMaterial({ map: sprite, color: 0x000000, transparent: true, opacity: 0.55, depthWrite: false, fog: false }));
        shadow.position.set(0.25, -0.35, -0.06);
        const border = new THREE.Mesh(new THREE.PlaneGeometry(w + pad * 2, hh + pad * 2), new THREE.MeshBasicMaterial({ color: illustration ? parchment : paper, transparent: true, opacity: 0, toneMapped: false, fog: false }));
        const photoMat = new THREE.MeshBasicMaterial({ color: 0x0a2148, transparent: true, opacity: 0, toneMapped: false, fog: false });
        const photo = new THREE.Mesh(new THREE.PlaneGeometry(w, hh), photoMat);
        photo.position.z = 0.02;
        photo.userData = { station: i, index: k };
        frame.add(shadow, border, photo);
        pickables.push(photo);

        if (illustration) {
          const tag = new THREE.Mesh(new THREE.PlaneGeometry(isMain ? 2.4 : 1.6, isMain ? 0.45 : 0.3), new THREE.MeshBasicMaterial({ map: labelTexture(THREE, 'ILLUSTRATION'), transparent: true, depthWrite: false, toneMapped: false, fog: false }));
          tag.position.set(0, -hh / 2 - pad - (isMain ? 0.45 : 0.32), 0.03);
          frame.add(tag);
        }

        if (isMain) frame.position.set(0, 0, 0);
        else frame.position.copy(SIDE_SLOTS[(k - 1) % SIDE_SLOTS.length]);
        frame.rotation.y = isMain ? -0.08 : -0.28;
        frame.userData = { photoMat, border: border.material, item: m.item, isMain, loaded: false, sharp: false, float: rand() * Math.PI * 2 };
        group.add(frame);
        return frame;
      });

      // node of light where the station meets the river
      const node = new THREE.Sprite(new THREE.SpriteMaterial({ map: sprite, color: 0x8fcbff, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending }));
      node.position.set(0, -3.6, 0);
      node.scale.setScalar(1.2);
      group.add(node);

      return { group, frames, node, year };
    });

    // ---- Texture streaming -------------------------------------------------------
    function loadInto(frame, src, sharp) {
      const d = frame.userData;
      loader.load(src, (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        // ignore late arrivals that are no longer wanted
        if ((sharp && !d.wantSharp) || (!sharp && d.sharp && d.wantSharp)) { tex.dispose(); return; }
        const old = d.photoMat.map;
        d.photoMat.map = tex;
        d.photoMat.color.set(0xffffff);
        d.photoMat.needsUpdate = true;
        if (old && old !== tex) old.dispose();
        if (!d.loaded) d.loadedAt = performance.now(); // fade in by the clock, not by frames
        d.loaded = true;
        d.sharp = sharp;
        ctx.requestRender();
      }, undefined, () => console.warn('[journey] could not load', d.item.file));
    }
    function stream(center) {
      builtStations.forEach((s, i) => {
        const near = Math.abs(i - center) <= 3;
        s.frames.forEach((f) => {
          const d = f.userData;
          if (near && !d.requested) { d.requested = true; loadInto(f, url(d.item.sm), false); }
          // sharp version only for the station you are looking at
          const wantSharp = i === center && d.isMain;
          if (wantSharp && !d.wantSharp) { d.wantSharp = true; loadInto(f, url(d.item.lg), true); }
          if (!wantSharp && d.wantSharp && Math.abs(i - center) > 2) {
            // far away again: swap the sharp texture back for the small one to free memory
            d.wantSharp = false;
            if (d.sharp) loadInto(f, url(d.item.sm), false);
          }
        });
      });
    }

    // ---- Camera path -------------------------------------------------------------
    let camCurve, lookCurve, layout = 'wide';
    function buildCurves(aspect) {
      layout = aspect < 0.9 ? 'portrait' : aspect < 1.35 ? 'square' : 'wide';
      // wide: photo sits right of centre (text on the left); portrait: photo above the text
      const off = layout === 'portrait'
        ? { cam: new THREE.Vector3(0.6, -5.4, 19), look: new THREE.Vector3(0.6, -5.4, 0) } // photo in the upper third
        : layout === 'square'
          ? { cam: new THREE.Vector3(-2.4, 0.2, 14.5), look: new THREE.Vector3(-2.4, 0, 0) }
          : { cam: new THREE.Vector3(-3.8, 0.4, 13), look: new THREE.Vector3(-3.8, 0.1, 0) };
      camCurve = new THREE.CatmullRomCurve3(anchors.map((p) => p.clone().add(off.cam)));
      lookCurve = new THREE.CatmullRomCurve3(anchors.map((p) => p.clone().add(off.look)));
    }

    let pos = 0, from = 0, to = 0, t0 = 0, dur = 1, now = 0, current = 0;
    const pointer = { x: 0, y: 0, sx: 0, sy: 0 };
    const tmp = new THREE.Vector3(), look = new THREE.Vector3();

    function goTo(i) {
      current = Math.max(0, Math.min(n - 1, i));
      from = pos;
      to = current;
      t0 = now;
      const distance = Math.abs(to - from);
      dur = ctx.reduced ? 0.001 : Math.min(4.2, 1.5 + distance * 0.16);
      stream(current);
      ctx.requestRender();
    }

    function resize(w, h) {
      camera.aspect = w / h;
      camera.fov = w / h < 0.9 ? 50 : 40;
      camera.updateProjectionMatrix();
      buildCurves(w / h);
    }

    function update(t, dt) {
      now = t;
      if (pos !== to) {
        const k = Math.min(1, (t - t0) / dur);
        pos = lerp(from, to, easeInOutCubic(k));
        if (k >= 1) pos = to;
      }
      const u = n > 1 ? pos / (n - 1) : 0;
      camCurve.getPoint(u, tmp);
      lookCurve.getPoint(u, look);
      // gentle breathing + lean toward the pointer
      pointer.sx = lerp(pointer.sx, pointer.x, 0.05);
      pointer.sy = lerp(pointer.sy, pointer.y, 0.05);
      const breathe = ctx.reduced ? 0 : Math.sin(t * 0.4) * 0.15;
      camera.position.set(tmp.x + pointer.sx * 0.9, tmp.y + breathe + pointer.sy * 0.5, tmp.z);
      camera.lookAt(look);

      // draw only what is near; float the photographs a little
      builtStations.forEach((s, i) => {
        // draw stations ahead of the camera only (one beside or behind it would block the view)
        const near = Math.abs(i - pos) < 4.5 && anchors[i].z < camera.position.z - 4;
        s.group.visible = near;
        if (!near) return;
        const focus = Math.max(0, 1 - Math.abs(i - pos)); // 1 at the station you are on
        s.frames.forEach((f) => {
          const d = f.userData;
          if (!ctx.reduced) f.position.y += Math.sin(t * 0.8 + d.float) * 0.0015;
          const o = d.loaded ? Math.min(1, (performance.now() - d.loadedAt) / 700) : 0;
          d.photoMat.opacity = o;
          d.border.opacity = o;
        });
        s.node.material.color.setHex(focus > 0.5 ? 0xe4cf9f : 0x8fcbff);
        s.node.scale.setScalar(1.2 + focus * 1.4);
        s.year.material.opacity = s.frames.length ? 0.12 + focus * 0.18 : 0.5 + focus * 0.45;
        if (s.group.userData.ring && !ctx.reduced) s.group.userData.ring.rotation.z = t * 0.15;
      });

      for (let i = 0; i < FLOW; i++) {
        flowT[i] = (((flowT[i] + dt * 0.006) % 1) + 1) % 1;
        riverCurve.getPointAt(flowT[i], tmp);
        flowPos[i * 3] = tmp.x; flowPos[i * 3 + 1] = tmp.y; flowPos[i * 3 + 2] = tmp.z;
      }
      flowGeo.attributes.position.needsUpdate = true;
      ctx.renderer.render(scene, camera);
    }

    // ---- Picking -----------------------------------------------------------------
    const raycaster = new THREE.Raycaster();
    const ndc = new THREE.Vector2();
    const hit = (x, y) => {
      ndc.set(x, y);
      raycaster.setFromCamera(ndc, camera);
      return raycaster.intersectObjects(pickables.filter((p) => p.parent.parent.visible && p.material.opacity > 0.5), false)[0];
    };
    const onClick = (e) => {
      const r = ctx.canvas.getBoundingClientRect();
      const h = hit(((e.clientX - r.left) / r.width) * 2 - 1, -(((e.clientY - r.top) / r.height) * 2 - 1));
      if (h) onPick?.(h.object.userData.station, h.object.userData.index);
    };
    ctx.canvas.addEventListener('click', onClick);

    buildCurves(1.6);
    stream(0);

    return {
      update,
      resize,
      goTo,
      pointer(x, y) {
        pointer.x = x; pointer.y = y;
        ctx.canvas.style.cursor = hit(x, y) ? 'zoom-in' : '';
      },
      dispose() {
        ctx.canvas.removeEventListener('click', onClick);
        disposeTree(scene);
        sprite.dispose();
      },
    };
  }, { eager: false });
}
