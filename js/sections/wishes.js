// Chapter V — Family Wishes.
// Videos are listed in data/wishes.json. With no videos yet, the "theatre"
// shows a gentle message instead of an empty player. With one or more, the
// first plays in the theatre and the rest appear as a playlist.

import { h, icons } from '../core/util.js';
import { url } from '../core/data.js';
import { createPlayer } from '../core/player.js';
import { chapterHead } from './shared.js';

export async function mount(el, content) {
  const wishes = content.wishes || { videos: [] };
  const videos = (wishes.videos || []).filter((v) => v && v.src);

  const screen = h('div', { class: 'theatre__screen' });
  const titleEl = h('p', { class: 'theatre__now' });
  const playlist = h('ul', { class: 'theatre__playlist', 'aria-label': 'Family wishes videos' });
  let player = null;

  function load(i, autoplay = false) {
    const v = videos[i];
    player?.destroy();
    player = createPlayer({ src: v.src, poster: v.poster, title: v.title || `Wishes from ${v.from || 'family'}`, captions: v.captions, autoplay });
    screen.replaceChildren(player.el);
    titleEl.replaceChildren(
      h('span', { class: 'theatre__label' }, 'Now showing'),
      h('span', { class: 'theatre__title' }, v.title || 'Family wishes'),
      v.from ? h('span', { class: 'theatre__from' }, `From ${v.from}`) : null,
    );
    playlist.querySelectorAll('.wish-card').forEach((c, k) => c.setAttribute('aria-current', k === i ? 'true' : 'false'));
  }

  if (videos.length) {
    videos.forEach((v, i) => {
      playlist.append(h('li', {},
        h('button', { class: 'wish-card', type: 'button', onclick: () => { load(i, true); screen.scrollIntoView({ behavior: 'smooth', block: 'center' }); } },
          h('span', { class: 'wish-card__thumb', style: v.poster ? { backgroundImage: `url("${url(v.poster)}")` } : {} }, h('span', { class: 'wish-card__play', html: icons.play })),
          h('span', { class: 'wish-card__text' },
            h('span', { class: 'wish-card__title' }, v.title || 'Family wishes'),
            v.from ? h('span', { class: 'wish-card__from' }, v.from) : null,
          ),
        ),
      ));
    });
    load(0);
  } else {
    screen.classList.add('is-empty');
    screen.append(
      h('div', { class: 'theatre__empty', role: 'status' },
        h('span', { class: 'theatre__empty-icon', html: icons.heart }),
        h('p', { class: 'theatre__empty-text' }, wishes.emptyMessage || 'Beautiful words from the people who love you are on their way.'),
      ),
    );
    // A note for whoever maintains the site — not shown to guests.
    console.info('[wishes] No videos yet. Add entries to data/wishes.json (see its "_note").');
  }

  el.append(
    h('div', { class: 'wrap' },
      chapterHead({ num: 5, id: 'wishes-title', title: 'Family <em>Wishes</em>', lede: wishes.intro }),
      h('div', { class: 'theatre', 'data-reveal': '' },
        h('div', { class: 'theatre__curtain', 'aria-hidden': 'true' }),
        h('div', { class: 'theatre__frame' }, screen),
        videos.length ? titleEl : null,
        videos.length > 1 ? playlist : null,
      ),
    ),
  );
}
