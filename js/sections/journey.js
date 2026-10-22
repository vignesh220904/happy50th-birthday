// Scene 4 — Her Life Journey, 1976–2026 (data/timeline.json).
// The milestones are grouped into era pages of up to five, laid out across the
// landscape screen as framed cards with their real photographs. Next moves
// through the eras, then on to the 50 Reasons. Tapping a card opens its photos.

import { h, icons, pad, fitText, $$, prefersReducedMotion } from '../core/util.js';
import { picture, url } from '../core/data.js';
import { openLightbox } from '../core/lightbox.js';
import { mediaLabel } from './shared.js';

const PER_PAGE = 5;
const shortYear = (y) => (String(y).match(/\d{4}s?/) || [y])[0];

/** Group milestones by era, merge small neighbouring eras, split long ones. */
function paginate(eras, milestones) {
  const byEra = eras.map((e) => ({ eras: [e], items: milestones.filter((m) => m.era === e.id) })).filter((g) => g.items.length);
  const merged = [];
  for (const g of byEra) {
    const last = merged[merged.length - 1];
    if (last && last.items.length + g.items.length <= PER_PAGE && (last.items.length < 3 || g.items.length < 3)) {
      last.eras.push(...g.eras);
      last.items.push(...g.items);
    } else merged.push({ eras: [...g.eras], items: [...g.items] });
  }
  return merged.flatMap((g) => {
    const parts = Math.ceil(g.items.length / PER_PAGE);
    const size = Math.ceil(g.items.length / parts);
    return Array.from({ length: parts }, (_, i) => ({
      title: g.eras.map((e) => e.title).join(' · '),
      part: parts > 1 ? `Part ${i + 1} of ${parts}` : '',
      items: g.items.slice(i * size, (i + 1) * size),
    }));
  });
}

export async function mount(el, content) {
  const { eras, milestones } = content.timeline;
  const pages = paginate(eras, milestones);
  const resolve = (m) => m.media.map((ref) => ({ ...ref, item: content.media.get(ref.id) })).filter((r) => r.item);
  let page = 0;

  const lightboxFor = (m) => resolve(m).map((r) => ({
    media: r.item,
    alt: r.alt,
    caption: `${m.year} · ${m.title}`,
    meta: r.item.kind === 'illustration' ? 'An illustration, not an original photograph.' : m.caption,
  }));

  function card(m, i) {
    const media = resolve(m);
    const main = media[0];
    const visual = main
      ? h('button', {
        class: `jcard__photo ${main.item.kind === 'illustration' ? 'is-illustration' : ''}`,
        type: 'button',
        'aria-label': `View ${media.length > 1 ? `the ${media.length} photos` : 'the photo'}: ${m.title}`,
        onclick: () => openLightbox(lightboxFor(m), 0),
      },
      picture(main.item, { alt: main.alt, sizes: '(max-width: 760px) 90vw, 20vw', className: 'jcard__img' }),
      media[1] ? h('span', { class: 'jcard__inset', 'aria-hidden': 'true' }, picture(media[1].item, { alt: '', sizes: '8vw', className: 'jcard__inset-img' }), mediaLabel(media[1].item)) : null,
      media.length > 1 ? h('span', { class: 'jcard__count' }, h('span', { html: icons.grid }), `${media.length}`) : null,
      mediaLabel(main.item),
      )
      : h('div', { class: `jcard__photo jcard__photo--type ${m.id === 'fifty' ? 'is-fifty' : ''}`, 'aria-hidden': 'true' },
        h('span', {}, m.id === 'fifty' ? '50' : shortYear(m.year)));

    return h('article', { class: 'jcard', style: { '--i': i } },
      visual,
      h('div', { class: 'jcard__text' },
        h('p', { class: 'jcard__year' }, m.year),
        h('h3', { class: 'jcard__title' }, m.title),
        h('p', { class: 'jcard__caption' }, m.caption),
        m.noPhoto ? h('p', { class: 'jcard__note' }, m.noPhoto) : null,
      ),
    );
  }

  const eraTabs = pages.map((p, i) => h('button', {
    class: 'jera',
    type: 'button',
    'aria-label': `${p.title}${p.part ? `, ${p.part.toLowerCase()}` : ''}`,
    onclick: () => show(i),
  }, h('span', { class: 'jera__years' }, `${shortYear(p.items[0].year)}`), h('span', { class: 'jera__dot', 'aria-hidden': 'true' })));
  const pageTitle = h('h2', { class: 'scene-title journey__title', id: 'journey-title' });
  const pagePart = h('p', { class: 'journey__part' });
  const cardsEl = h('div', { class: 'journey__cards' });
  const fillEl = h('span', { class: 'jrail__fill', 'aria-hidden': 'true' });

  el.append(h('div', { class: 'scene__frame journey' },
    h('header', { class: 'journey__head' },
      h('div', {},
        h('p', { class: 'eyebrow', 'data-enter': '', style: { '--enter': 0 } }, 'Her Life Journey · 1976 – 2026'),
        h('div', { class: 'journey__heading', 'data-enter': '', style: { '--enter': 1 } }, pageTitle, pagePart),
      ),
      h('nav', { class: 'jrail', 'aria-label': 'Eras of her life', 'data-enter': '', style: { '--enter': 2 } },
        h('div', { class: 'jrail__line', 'aria-hidden': 'true' }, fillEl), h('div', { class: 'jrail__stops' }, eraTabs)),
    ),
    cardsEl,
  ));

  function show(i, { animate = true } = {}) {
    page = Math.max(0, Math.min(pages.length - 1, i));
    const p = pages[page];
    const first = shortYear(p.items[0].year), last = shortYear(p.items[p.items.length - 1].year);
    pageTitle.textContent = p.title;
    pagePart.textContent = [first === last ? first : `${first} – ${last}`, p.part].filter(Boolean).join(' · ');
    cardsEl.style.setProperty('--n', p.items.length);
    cardsEl.replaceChildren(...p.items.map(card));
    cardsEl.classList.toggle('is-animating', animate && !prefersReducedMotion());
    eraTabs.forEach((t, k) => {
      t.classList.toggle('is-active', k === page);
      t.classList.toggle('is-past', k < page);
      if (k === page) t.setAttribute('aria-current', 'step'); else t.removeAttribute('aria-current');
    });
    fillEl.style.transform = `scaleX(${pages.length > 1 ? page / (pages.length - 1) : 1})`;
    // preload the next page's photos
    pages[page + 1]?.items.forEach((m) => resolve(m).slice(0, 1).forEach((r) => { new Image().src = url(r.item.sm); }));
    requestAnimationFrame(fit);
  }

  function fit() {
    $$('.jcard__text', cardsEl).forEach((t) => fitText(t, { min: 0.7 }));
  }

  show(0, { animate: false });

  return {
    hint: `${milestones.length} milestones in ${pages.length} pages`,
    enter({ atEnd }) { show(atEnd ? pages.length - 1 : 0); },
    step(dir) {
      const target = page + dir;
      if (target < 0 || target >= pages.length) return false;
      show(target);
      return true;
    },
    steps: () => ({ index: page, count: pages.length, label: `${pad(page + 1)} / ${pad(pages.length)}` }),
    fit,
  };
}
