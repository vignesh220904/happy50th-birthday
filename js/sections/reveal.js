// Scene 2 — The birthday reveal, shown when the host presses Next as Amma
// arrives. Her real photograph (data/site.json → reveal.photo) in a pearl arch
// frame with a soft halo, beside the greeting on three lines:
//   HAPPY 50TH BIRTHDAY / AMMA / M. BUVANESWARI
// Each time the scene opens, the words rise in and confetti falls.

import { h } from '../core/util.js';
import { picture } from '../core/data.js';
import { confetti } from '../core/confetti.js';

export async function mount(el, content) {
  const r = content.site.reveal || {};
  const photo = content.media.get(r.photo);
  if (!photo) console.warn(`[reveal] Photo "${r.photo}" not found — set data/site.json → reveal.photo to a photo id.`);

  el.append(h('div', { class: 'scene__frame reveal' },
    h('div', { class: 'reveal__portrait', 'data-enter': '', style: { '--enter': 0 } },
      h('div', { class: 'reveal__halo', 'aria-hidden': 'true' }),
      h('div', { class: 'reveal__ring', 'aria-hidden': 'true' }),
      h('div', { class: 'reveal__plate', 'aria-hidden': 'true' }),
      h('figure', { class: 'reveal__frame' },
        photo
          ? picture(photo, { alt: r.photoAlt || 'Amma', eager: true, large: true, className: 'reveal__img' })
          : h('div', { class: 'reveal__img reveal__img--missing', role: 'img', 'aria-label': 'Photo of Amma' }),
      ),
    ),
    h('div', { class: 'reveal__text' },
      h('h2', { class: 'reveal__title', id: 'reveal-title' },
        h('span', { class: 'reveal__line1', 'data-enter': '', style: { '--enter': 1 } }, r.line1 || 'Happy 50th Birthday'),
        h('span', { class: 'reveal__line2', 'data-enter': '', style: { '--enter': 3 } }, r.line2 || 'Amma'),
        h('span', { class: 'reveal__line3', 'data-enter': '', style: { '--enter': 5 } },
          h('span', { class: 'ornament', 'aria-hidden': 'true' }), h('span', {}, r.line3 || content.site.person.fullName), h('span', { class: 'ornament', 'aria-hidden': 'true' })),
      ),
      r.message ? h('p', { class: 'reveal__message', 'data-enter': '', style: { '--enter': 7 } }, r.message) : null,
    ),
  ));

  let timers = [];
  return {
    enter({ dir }) {
      if (dir < 0) return; // coming back from the journey: no second celebration
      timers.push(setTimeout(() => confetti({ x: 0.08, y: 0.95, count: 120, angle: -1.05 }), 650));
      timers.push(setTimeout(() => confetti({ x: 0.92, y: 0.95, count: 120, angle: -2.1 }), 800));
      timers.push(setTimeout(() => confetti({ mode: 'rain', count: 140 }), 1500));
    },
    leave() {
      timers.forEach(clearTimeout);
      timers = [];
    },
  };
}
