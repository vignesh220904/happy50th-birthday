// Chapter IV — Key Memories.
// Every photo in "Memory gallery" (via data/photo_inventory.json), grouped by the
// year recorded in the photo itself. Phone scans of old prints form "The Family
// Album" because their file dates are scan dates, not when the photo was taken.
// Every tile is placed at once with its exact aspect ratio, so the page height
// never changes while scrolling (anchors further down stay where they are);
// the thumbnails themselves load lazily, the full image only in the lightbox.

import { h, prefersReducedMotion } from '../core/util.js';
import { picture } from '../core/data.js';
import { openLightbox } from '../core/lightbox.js';
import { chapterHead } from './shared.js';

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const groupTitle = (g) => (g === 'album' ? 'The Family Album' : g === 'undated' ? 'Undated Moments' : g);
const groupNote = (g) =>
  g === 'album' ? 'Treasured prints from the years before phones, scanned in 2026' : g === 'undated' ? 'Photographs without a recorded date' : '';

function describe(item) {
  if (item.group === 'album') return { caption: 'From the family album', meta: 'A scanned print · year not recorded' };
  if (!item.date) return { caption: 'Family photograph', meta: 'Date not recorded' };
  const [y, m, d] = item.date.split('-').map(Number);
  return { caption: `${d} ${MONTHS[m - 1]} ${y}`, meta: item.dateSource === 'exif' ? 'Date from the photo’s camera information' : 'Date from the photo’s file name' };
}

const altFor = (item) =>
  item.group === 'album' ? 'A scanned family photograph from the family album' : `Family photograph${item.date ? `, ${describe(item).caption}` : ''}`;

export async function mount(el, content) {
  const all = content.media.collection('gallery');
  const groups = [...new Set(all.map((i) => i.group))].sort((a, b) => {
    const rank = (g) => (g === 'album' ? -1 : g === 'undated' ? 1e9 : Number(g));
    return rank(a) - rank(b);
  });
  const sorted = groups.flatMap((g) => all.filter((i) => i.group === g).sort((a, b) => (a.date || '').localeCompare(b.date || '')));

  let filter = 'all', list = sorted;

  const chips = [{ id: 'all', label: 'All memories', count: all.length }, ...groups.map((g) => ({ id: g, label: groupTitle(g), count: all.filter((i) => i.group === g).length }))]
    .map((c) => h('button', { class: 'chip chip--filter', type: 'button', 'aria-pressed': String(c.id === 'all'), 'data-filter': c.id, onclick: () => setFilter(c.id) },
      c.label, h('span', { class: 'chip__count' }, c.count)));
  const status = h('p', { class: 'gallery__status', 'aria-live': 'polite' });
  const groupsEl = h('div', { class: 'gallery__groups' });

  el.append(
    h('div', { class: 'wrap' },
      chapterHead({
        num: 4,
        id: 'memories-title',
        title: 'Key <em>Memories</em>',
        lede: `${all.length} photographs from family albums and phones: festivals, journeys, celebrations and quiet everyday moments.`,
      }),
      h('div', { class: 'gallery' },
        h('div', { class: 'gallery__filters', role: 'group', 'aria-label': 'Show memories from' }, chips),
        status,
        groupsEl,
      ),
    ),
  );

  function groupBlock(g) {
    let block = groupsEl.querySelector(`[data-group="${g}"]`);
    if (!block) {
      const count = list.filter((i) => i.group === g).length;
      block = h('section', { class: 'ggroup', 'data-group': g, 'aria-label': groupTitle(g) },
        h('header', { class: 'ggroup__head' },
          h('h3', { class: 'ggroup__title' }, groupTitle(g)),
          h('p', { class: 'ggroup__meta' }, [groupNote(g), `${count} photograph${count === 1 ? '' : 's'}`].filter(Boolean).join(' · ')),
        ),
        h('div', { class: 'ggrid' }),
      );
      groupsEl.append(block);
    }
    return block.querySelector('.ggrid');
  }

  function tile(item, i) {
    const { caption } = describe(item);
    const alt = altFor(item);
    const btn = h('button', {
      class: `gitem gitem--${item.width > item.height * 1.15 ? 'wide' : item.height > item.width * 1.15 ? 'tall' : 'square'}`,
      type: 'button',
      style: { '--ar': (item.width / item.height).toFixed(3), '--d': Math.min(i, 24) * 18 },
      'aria-label': `Open photo: ${alt}`,
      onclick: () => openLightbox(list.map((it) => ({ media: it, alt: altFor(it), ...describe(it) })), list.indexOf(item)),
    },
    picture(item, { alt, sizes: '(max-width: 600px) 46vw, (max-width: 1100px) 30vw, 300px', className: 'gitem__img' }),
    item.date ? h('span', { class: 'gitem__date', 'aria-hidden': 'true' }, caption) : null,
    );
    return btn;
  }

  function renderAll() {
    list.forEach((item, i) => groupBlock(item.group).append(tile(item, i)));
    status.textContent = `Showing ${list.length} photograph${list.length === 1 ? '' : 's'}`;
  }

  function setFilter(id) {
    filter = id;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c.dataset.filter === id)));
    list = filter === 'all' ? sorted : sorted.filter((i) => i.group === filter);
    groupsEl.replaceChildren();
    renderAll();
    if (!prefersReducedMotion()) groupsEl.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 });
  }

  if (!all.length) {
    groupsEl.append(h('p', { class: 'empty-note' }, 'Photographs will appear here once they are added to the “Memory gallery” folder.'));
    return;
  }
  renderAll();
}
