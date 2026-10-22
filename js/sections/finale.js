// Chapter VII — The Celebration & 50 Gifts.
// A 3D gift (open it to release the light and wake the ring of 50 gifts), the
// family's final greeting, the 50 gifts from data/gifts.json (names appear only
// once the family fills them in), the celebration details and a replay button.

import { h, icons, pad, roman, prefersReducedMotion } from '../core/util.js';
import { picture } from '../core/data.js';
import { createPlayer } from '../core/player.js';
import { confetti } from '../core/confetti.js';
import { mountGiftScene } from '../three/gift-scene.js';
import { replayWelcome } from './welcome.js';
import { isStandalone, fullExperienceHref } from '../core/nav.js';

function countdownText(dateIso) {
  const [y, m, d] = dateIso.split('-').map(Number);
  const today = new Date();
  const start = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const days = Math.round((new Date(y, m - 1, d) - start) / 86400000);
  if (days > 1) return `${days} days to go`;
  if (days === 1) return 'Tomorrow';
  if (days === 0) return 'Today is the day';
  return 'Celebrated with love';
}

export async function mount(el, content) {
  const f = content.site.finale;
  const { person, event } = content.site;
  const gifts = content.gifts?.gifts || [];
  const total = content.gifts?.total || 50;
  const named = gifts.filter((g) => g.name).length;

  const openBtn = h('button', { class: 'btn btn--primary', type: 'button', 'aria-pressed': 'false' });
  const scene = h('div', { class: 'finale__scene' },
    h('div', { class: 'finale__fallback', 'aria-hidden': 'true' },
      h('span', { class: 'cssgift' }, h('span', { class: 'cssgift__lid' }), h('span', { class: 'cssgift__box' })),
    ),
  );
  const stageEl = h('div', { class: 'finale__stage' },
    scene,
    h('div', { class: 'finale__overlay wrap' },
      h('p', { class: 'eyebrow' }, `Chapter ${roman(7)}`),
      h('h2', { class: 'chapter-title finale__title', id: 'finale-title', html: 'Fifty Gifts, <em>Fifty Years</em>' }),
      h('p', { class: 'chapter-lede' }, `The family is preparing ${total} gifts, one for every year of her life.`),
      h('div', { class: 'finale__open' }, openBtn),
    ),
  );

  const setOpenLabel = (open) => {
    openBtn.replaceChildren(h('span', { html: icons.gift }), h('span', {}, open ? 'Close the gift' : 'Open the gift'));
    openBtn.setAttribute('aria-pressed', String(open));
    el.classList.toggle('is-open', open);
  };
  setOpenLabel(false);

  let gift = null;
  const onOpenChange = (open) => {
    setOpenLabel(open);
    if (open) {
      confetti({ x: 0.5, y: 0.55, count: 140 });
      greeting.classList.add('is-celebrating');
    }
  };
  openBtn.addEventListener('click', () => {
    if (gift) gift.scene.setOpen(!gift.scene.open);
    else onOpenChange(openBtn.getAttribute('aria-pressed') !== 'true'); // no WebGL: the CSS gift opens instead
  });

  // ---- Greeting ------------------------------------------------------------------
  const greeting = h('article', { class: 'finale__greeting', 'data-reveal': '' },
    h('h3', { class: 'finale__headline' }, f.headline),
    h('p', { class: 'finale__subline' }, f.subline),
    h('p', { class: 'finale__message' }, f.message),
    h('p', { class: 'finale__sign' }, 'With all our love, always'),
  );

  // ---- The birthday film ---------------------------------------------------------
  const film = content.media.film('film-birthday');
  const filmMeta = content.site.films?.['film-birthday'] || {};
  let filmSection = null;
  if (film) {
    const player = createPlayer({ src: film.src, poster: film.poster, title: filmMeta.title || 'The Birthday Film' });
    const mins = `${Math.floor(film.duration / 60)} min ${Math.round(film.duration % 60)} s`;
    filmSection = h('section', { class: 'bfilm', id: 'birthday-film', 'aria-labelledby': 'bfilm-title', 'data-reveal': '' },
      h('header', { class: 'bfilm__head' },
        h('p', { class: 'eyebrow' }, filmMeta.title || 'The Birthday Film'),
        h('h3', { class: 'bfilm__title', id: 'bfilm-title' }, 'Fifty ', h('em', {}, '&'), ' Fabulous'),
        h('p', { class: 'bfilm__lede' }, filmMeta.description || ''),
        h('p', { class: 'bfilm__meta' }, h('span', { class: 'media-label' }, filmMeta.label || 'Family film'), h('span', {}, mins)),
      ),
      h('div', { class: 'theatre__frame bfilm__frame' }, h('div', { class: 'bfilm__screen' }, player.el)),
    );
  }

  // ---- 50 gifts ------------------------------------------------------------------
  const giftTiles = Array.from({ length: total }, (_, i) => {
    const g = gifts.find((x) => x.n === i + 1) || { n: i + 1 };
    return h('li', { class: `gtile ${g.name ? 'has-name' : ''} ${g.given ? 'is-given' : ''}`, style: { '--i': i } },
      h('span', { class: 'gtile__box', 'aria-hidden': 'true' }, h('span', { class: 'gtile__ribbon' })),
      h('span', { class: 'gtile__num' }, `Gift ${pad(g.n)}`),
      h('span', { class: 'gtile__name' }, g.name || 'Wrapped with love'),
      g.from ? h('span', { class: 'gtile__from' }, `From ${g.from}`) : null,
      g.note ? h('span', { class: 'gtile__note' }, g.note) : null,
      g.given ? h('span', { class: 'gtile__given' }, 'Given') : null,
    );
  });
  const giftsSection = h('section', { class: 'gifts', 'aria-labelledby': 'gifts-title', 'data-reveal': '' },
    h('header', { class: 'gifts__head' },
      h('h3', { class: 'gifts__title', id: 'gifts-title' }, `${total} Gifts for ${total} Years`),
      h('p', { class: 'gifts__lede' }, named
        ? `${named} of ${total} gifts are named so far. Each one is a thank-you for a year of her love.`
        : 'Each gift is a thank-you for a year of her love. Their names will be revealed at the celebration.'),
    ),
    h('ol', { class: 'gifts__grid' }, giftTiles),
  );

  // ---- Celebration details ---------------------------------------------------------
  const photo = content.media.get(f.photo);
  const details = h('section', { class: 'celebration glass', 'aria-label': 'Celebration details', 'data-reveal': '' },
    photo ? h('div', { class: 'celebration__photo' }, picture(photo, { alt: 'Buvana with her family at Vikky’s wedding, 2026', sizes: '(max-width: 900px) 92vw, 560px' })) : null,
    h('div', { class: 'celebration__info' },
      h('p', { class: 'eyebrow' }, 'The celebration'),
      h('p', { class: 'celebration__name' }, person.fullName),
      h('ul', { class: 'celebration__list' },
        h('li', {}, h('span', { class: 'celebration__icon', html: icons.calendar }), h('span', {}, h('strong', {}, event.dateLabel), h('small', {}, countdownText(event.date)))),
        h('li', {}, h('span', { class: 'celebration__icon', html: icons.pin }), h('span', {}, h('strong', {}, event.venue), h('small', {}, event.area))),
      ),
      h('div', { class: 'celebration__actions' },
        h(isStandalone() ? 'a' : 'button', {
          class: 'btn btn--gold',
          type: isStandalone() ? null : 'button',
          href: isStandalone() ? fullExperienceHref() : null,
          onclick: isStandalone() ? null : () => { gift?.scene.setOpen(false); replayWelcome(content); },
        }, h('span', { html: icons.replay }), 'Replay her journey'),
        h('button', { class: 'btn btn--ghost', type: 'button', onclick: () => confetti({ mode: 'rain', count: 220 }) }, h('span', { html: icons.sparkle }), 'Celebrate again'),
      ),
    ),
  );

  el.append(stageEl, h('div', { class: 'wrap finale__content' }, greeting, filmSection, giftsSection, details));

  if (prefersReducedMotion()) el.classList.add('is-static');
  // Not awaited: the 3D scene starts by itself when the finale nears the viewport
  mountGiftScene(scene, { count: total, onOpenChange }).then((c) => { gift = c; });
}
