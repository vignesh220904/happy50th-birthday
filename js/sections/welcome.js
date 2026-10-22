// Scene 1 — Welcome: the default idle screen on the projector while guests arrive.
// The text is already in index.html (so it paints immediately); this fills it
// from data/site.json and adds a layered 3D composition of real family
// photographs around a silver-blue "50". Nothing here needs interaction.

import { h, $ } from '../core/util.js';
import { picture } from '../core/data.js';

// Positions of the framed photographs in the 3D composition (percent of the visual box, depth in --u)
const SLOTS = [
  { x: 58, y: 63, w: 56, z: 4, r: -2 },   // the main photograph, below the "50"
  { x: 16, y: 72, w: 27, z: 10, r: -6 },
  { x: 88, y: 25, w: 23, z: 2, r: 6 },
  { x: 90, y: 82, w: 21, z: 12, r: 4 },
];

export async function mount(el, content) {
  const w = content.site.welcome || {};
  const set = (key, text) => { const n = $(`[data-welcome="${key}"]`, el); if (n && text) n.textContent = text; };
  set('eyebrow', w.eyebrow);
  set('supporting', w.supporting);
  set('dates', w.dates);
  // Headline: keep the designed three-line break when it matches the default wording
  const title = $('#welcome-title', el);
  const m = /^(Celebrating the)\s+(Beautiful Journey)\s+(of .+)$/i.exec(w.headline || '');
  if (w.headline && !m) title.textContent = w.headline;
  else if (m) title.replaceChildren(
    h('span', { class: 'welcome__line welcome__line--lead' }, m[1]),
    h('span', { class: 'welcome__line' }, m[2]),
    h('span', { class: 'welcome__line welcome__line--name' }, m[3]),
  );

  const photos = (w.photos || []).map((id) => content.media.get(id)).filter(Boolean).slice(0, SLOTS.length);
  $('.welcome__photos', el).replaceChildren(...photos.map((item, i) => {
    const s = SLOTS[i];
    return h('figure', {
      class: `wphoto ${i === 0 ? 'wphoto--main' : ''}`,
      style: { '--x': s.x, '--y': s.y, '--w': s.w, '--z': s.z, '--r': `${s.r}deg`, '--ar': (item.width / item.height).toFixed(3), '--i': i },
    }, picture(item, { alt: '', eager: true, sizes: '(max-width: 760px) 50vw, 26vw', className: 'wphoto__img' }));
  }));

  return {};
}
