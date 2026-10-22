// A cinema scene: a deep-blue screening room with the title on the left and a
// large landscape video screen on the right. Used for the family's Life Journey
// film and the Family Memories film. When a film ends, a clear "continue"
// button appears on the screen; the presentation never moves on by itself.

import { h, icons } from '../core/util.js';
import { videoStage } from './shared.js';

export function mountCinema(el, deck, { id, eyebrow, title, lede, meta, src, poster, missingText, continueLabel }) {
  const continueBtn = h('button', { class: 'btn btn--light cinema__continue', type: 'button', onclick: () => deck.next() },
    h('span', {}, continueLabel), h('span', { html: icons.next }));
  const endCard = h('div', { class: 'cinema__end', hidden: true },
    h('button', { class: 'btn btn--primary', type: 'button', onclick: () => deck.next() }, h('span', {}, continueLabel), h('span', { html: icons.next })),
    h('button', { class: 'btn btn--light', type: 'button', onclick: () => { endCard.hidden = true; stage.player?.play(); } }, h('span', { html: icons.replay }), 'Watch again'),
  );

  const stage = videoStage({
    src,
    poster,
    title: title.replace(/<[^>]+>/g, ''),
    missingText,
    onEnded: () => { endCard.hidden = false; continueBtn.classList.add('is-highlighted'); },
  });
  const playBtn = h('button', { class: 'btn btn--primary cinema__play', type: 'button', hidden: true, onclick: () => { endCard.hidden = true; stage.player?.play(); } },
    h('span', { html: icons.play }), 'Play the film');

  const screen = h('div', { class: 'cinema__screen' }, stage.el, endCard);
  stage.ready.then((ok) => {
    playBtn.hidden = !ok;
    if (!ok) return;
    const v = stage.player.video;
    const setRatio = () => v.videoWidth && screen.style.setProperty('--ar', (v.videoWidth / v.videoHeight).toFixed(4));
    v.addEventListener('loadedmetadata', setRatio);
    setRatio();
    v.addEventListener('play', () => { endCard.hidden = true; });
  });

  el.append(h('div', { class: 'scene__frame cinema' },
    h('div', { class: 'cinema__text' },
      h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, eyebrow),
      h('h2', { class: 'cinema__title', id, 'data-enter': '', style: { '--enter': 1 }, html: title }),
      lede ? h('p', { class: 'cinema__lede', 'data-enter': '', style: { '--enter': 2 } }, lede) : null,
      meta ? h('p', { class: 'cinema__meta', 'data-enter': '', style: { '--enter': 3 } }, meta) : null,
      h('div', { class: 'cinema__actions', 'data-enter': '', style: { '--enter': 4 } }, playBtn, continueBtn),
    ),
    h('div', { class: 'cinema__stage', 'data-enter': '', style: { '--enter': 1 } }, screen),
  ));

  return {
    leave() { stage.pause(); },
  };
}
