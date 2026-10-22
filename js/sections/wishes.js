// Scene 8 — Family Wishes (data/wishes.json).
// A light-blue screening room for the family members' wishes video. Until the
// file is saved at the configured path, the screen shows the family's line:
// "Messages filled with love, from the people who make her world special."
// With more than one video available, a small playlist appears.

import { h, icons } from '../core/util.js';
import { url } from '../core/data.js';
import { videoStage, fileExists } from './shared.js';

export async function mount(el, content, deck) {
  const wishes = content.wishes || { videos: [] };
  const listed = (wishes.videos || []).filter((v) => v && v.src);
  const emptyMessage = wishes.emptyMessage || 'Messages filled with love, from the people who make her world special.';

  const screen = h('div', { class: 'wishes__screen' });
  const playlist = h('ol', { class: 'wishes__playlist', 'aria-label': 'Wishes videos', hidden: true });
  const nowShowing = h('p', { class: 'wishes__now' });
  const endCard = h('div', { class: 'cinema__end cinema__end--light', hidden: true });
  let stage = null, current = 0, available = [], anyExists = false;

  function load(i, autoplay = false) {
    stage?.pause();
    current = i;
    const v = available[i];
    endCard.hidden = true;
    stage = videoStage({
      src: v.src,
      poster: v.poster,
      title: v.title || 'Family wishes',
      missingText: emptyMessage,
      missingIcon: icons.heart,
      theme: 'light',
      exists: anyExists,
      onEnded: () => {
        const nextVideo = available[current + 1];
        endCard.replaceChildren(
          nextVideo
            ? h('button', { class: 'btn btn--primary', type: 'button', onclick: () => load(current + 1, true) }, h('span', { html: icons.play }), `Next: ${nextVideo.title || 'wishes'}`)
            : h('button', { class: 'btn btn--primary', type: 'button', onclick: () => deck.next() }, h('span', {}, 'To the celebration'), h('span', { html: icons.gift })),
          h('button', { class: 'btn', type: 'button', onclick: () => { endCard.hidden = true; stage.player?.play(); } }, h('span', { html: icons.replay }), 'Watch again'),
        );
        endCard.hidden = false;
      },
    });
    screen.replaceChildren(stage.el, endCard);
    stage.ready.then((ok) => {
      if (!ok) return;
      const vid = stage.player.video;
      vid.addEventListener('loadedmetadata', () => vid.videoWidth && screen.style.setProperty('--ar', (vid.videoWidth / vid.videoHeight).toFixed(4)));
      if (autoplay) stage.player.play();
    });
    nowShowing.textContent = available.length > 1 ? `${v.title || 'Family wishes'}${v.from ? ` · from ${v.from}` : ''}` : '';
    playlist.querySelectorAll('button').forEach((b, k) => b.setAttribute('aria-current', k === i ? 'true' : 'false'));
  }

  el.append(h('div', { class: 'scene__frame wishes' },
    h('div', { class: 'wishes__text' },
      h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, 'Family Wishes'),
      h('h2', { class: 'scene-title wishes__title', id: 'wishes-title', 'data-enter': '', style: { '--enter': 1 }, html: 'With Love, <em>From Family</em>' }),
      h('p', { class: 'scene-lede', 'data-enter': '', style: { '--enter': 2 } }, wishes.intro || 'The people who love you most have something to say.'),
      nowShowing,
      playlist,
    ),
    h('div', { class: 'wishes__stage', 'data-enter': '', style: { '--enter': 1 } }, screen),
  ));

  // Only videos whose file exists are offered; with none, the first entry's placeholder is shown.
  const exists = await Promise.all(listed.map((v) => fileExists(v.src)));
  available = listed.filter((_, i) => exists[i]);
  anyExists = available.length > 0;
  if (!available.length) {
    available = [listed[0] || { src: '', title: 'Family wishes' }];
    if (listed.length) console.info(`[wishes] The family wishes video is not added yet. Save it as ${listed[0].src} (see assets/videos/family/README.txt).`);
  }
  if (available.length > 1) {
    playlist.hidden = false;
    playlist.replaceChildren(...available.map((v, i) => h('li', {},
      h('button', { class: 'wish-item', type: 'button', onclick: () => load(i, true) },
        h('span', { class: 'wish-item__thumb', style: v.poster ? { backgroundImage: `url("${url(v.poster)}")` } : {} }, h('span', { html: icons.play })),
        h('span', { class: 'wish-item__title' }, v.title || 'Family wishes', v.from ? h('small', {}, v.from) : null),
      ),
    )));
  }
  load(0);

  return {
    leave() { stage?.pause(); },
  };
}
