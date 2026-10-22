// Page 1 — A Golden Beginning: the screen on the projector while guests arrive.
// The words are already in index.html (so they paint immediately); this fills
// them from data/site.json and draws the golden laurel wreath around the "50".
// There is one action, "Begin the Celebration": it starts the music and the
// automatic presentation. Next, Space, Enter or a clicker do the same, so the
// welcome needs no separate Next button.

import { h, $ } from '../core/util.js';
import { music } from '../core/audio.js';

const NS = 'http://www.w3.org/2000/svg';
const svgEl = (tag, attrs) => {
  const el = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  return el;
};

/** Two laurel branches curving up around the emblem, leaf by leaf. */
function drawWreath(svg) {
  const g = svgEl('g', { fill: 'none' });
  const defs = svgEl('defs', {});
  const grad = svgEl('linearGradient', { id: 'leaf-gold', x1: '0', y1: '0', x2: '1', y2: '1' });
  [['0', '#f7e7bd'], ['0.5', '#d9b66f'], ['1', '#b08435']].forEach(([o, c]) => grad.append(svgEl('stop', { offset: o, 'stop-color': c })));
  defs.append(grad);
  svg.append(defs, g); // in the document first, so the curve can be measured
  for (const side of [-1, 1]) {
    const stem = svgEl('path', {
      d: side < 0 ? 'M200 352 C 92 336, 40 250, 64 128' : 'M200 352 C 308 336, 360 250, 336 128',
      stroke: '#c9a14f', 'stroke-width': '2.4', 'stroke-linecap': 'round', opacity: '0.85',
    });
    g.append(stem);
    const len = stem.getTotalLength?.() || 0;
    for (let i = 1; i <= 13; i++) {
      const t = i / 14;
      // positions follow the same curve the stem uses
      const p = len ? stem.getPointAtLength(len * t) : { x: 200 + side * 130 * t, y: 352 - 220 * t };
      const q = len ? stem.getPointAtLength(Math.min(len, len * t + 1)) : { x: p.x + side, y: p.y - 1 };
      const angle = (Math.atan2(q.y - p.y, q.x - p.x) * 180) / Math.PI;
      const size = 1 - t * 0.35;
      for (const out of [1, -1]) {
        g.append(svgEl('ellipse', {
          cx: '0', cy: '0', rx: `${15 * size}`, ry: `${6 * size}`,
          fill: 'url(#leaf-gold)',
          opacity: out > 0 ? '0.95' : '0.7',
          transform: `translate(${p.x} ${p.y}) rotate(${angle + out * side * 38}) translate(${13 * size} 0)`,
        }));
      }
    }
    g.append(svgEl('circle', { cx: side < 0 ? '64' : '336', cy: '122', r: '5', fill: '#d9b66f' }));
  }
}

export async function mount(el, content, deck) {
  const w = content.site.welcome || {};
  for (const key of ['eyebrow', 'intro', 'supporting', 'dates', 'begin']) {
    const n = $(`[data-welcome="${key}"]`, el);
    if (n && w[key]) n.textContent = w[key];
  }
  if (Array.isArray(w.title) && w.title.length) {
    // one line each; the spaces between them are for screen readers (the grid ignores them)
    $('[data-welcome="title"]', el).replaceChildren(...w.title.flatMap((line, i) => [i ? ' ' : null, h('span', {
      class: `welcome__line ${i === w.title.length - 1 ? 'welcome__line--gold' : ''}`,
      'data-enter': '',
      style: { '--enter': i + 1 },
    }, line)].filter(Boolean)));
  }
  drawWreath($('.emblem__wreath', el));

  const begin = () => {
    music.play(); // a click or key press: browsers allow the sound now
    deck.setAuto(true, 'The celebration has begun. It moves on by itself; press the pause button, or the arrow keys, at any time.');
    deck.goTo('reveal');
  };
  $('[data-welcome="begin"]', el).addEventListener('click', begin);

  return {
    hint: 'Begin the Celebration starts the music and the automatic presentation',
    // Next / Space / Enter / a clicker on the welcome = Begin the Celebration
    step(dir) {
      if (dir < 0) return false;
      begin();
      return true;
    },
    // the welcome waits for the host: automatic playback never leaves it on its own
    auto: () => 'wait',
  };
}
