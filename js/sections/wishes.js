// Messages Filled With Love — the family's video wishes (data/wishes.json,
// built by scripts/build_wishes.py from the "Family video wishes" Drive folder).
// The page opens on its introduction ("Messages Filled With Love") for about
// 7 seconds; then the theatre opens and every confirmed wish plays in the
// family's order, one at a time, each to its end before the next. A name
// appears only when it came from the filename. A missing file is left out; a
// file that cannot be played is skipped. Until the videos are added the screen
// shows the family's line, "Messages filled with love, from the people who make
// her world special.", and the presentation moves on to the cake.

import { icons } from '../core/util.js';
import { mountCinema } from './cinema.js';

const INTRO_MS = 7000; // the introduction stays about 7 seconds before the first message

export async function mount(el, content, deck) {
  const wishes = content.wishes || {};
  const all = (wishes.videos || []).filter((v) => v && v.src);
  const pending = all.filter((v) => v.confirmed === false);
  if (pending.length) console.info(`[wishes] Waiting for the family's confirmation, not shown: ${pending.map((v) => v.file || v.src).join(', ')}`);
  const title = wishes.title || 'Messages Filled With Love';
  return mountCinema(el, deck, {
    id: 'wishes-title',
    eyebrow: 'Family Video Wishes',
    title: title.replace(/\s(With Love)$/i, ' <em>$1</em>'),
    lede: wishes.intro || 'The people who love you most have something to say.',
    playlist: all.filter((v) => v.confirmed !== false),
    introMs: INTRO_MS,
    itemLabel: 'Message',
    playLabel: 'Play the messages',
    startingText: 'The messages begin in a moment',
    missingText: wishes.emptyMessage || 'Messages filled with love, from the people who make her world special.',
    missingIcon: icons.heart,
  });
}
