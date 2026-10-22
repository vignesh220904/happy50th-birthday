// Loads the JSON content files and resolves media ids from the central manifest
// (data/photo_inventory.json, produced by scripts/build_media.py).

import { h } from './util.js';

/** '' on index.html, '../' on pages/*.html — set via <html data-base>. */
export const BASE = document.documentElement.dataset.base || '';

/** Turn a project-relative path into a safe URL (handles spaces, brackets, etc.). */
export function url(path) {
  if (!path) return '';
  if (/^(https?:|data:|blob:)/.test(path)) return path;
  return BASE + path.split('/').map(encodeURIComponent).join('/');
}

const cache = new Map();
export function loadJSON(name) {
  if (!cache.has(name)) {
    cache.set(
      name,
      fetch(url(`data/${name}.json`), { cache: 'no-cache' }).then((res) => {
        if (!res.ok) throw new Error(`Could not load data/${name}.json (${res.status})`);
        return res.json();
      }),
    );
  }
  return cache.get(name);
}

export async function loadContent() {
  const names = ['site', 'photo_inventory', 'timeline', 'reasons', 'wishes'];
  const results = await Promise.allSettled(names.map(loadJSON));
  const out = {};
  results.forEach((r, i) => {
    if (r.status === 'fulfilled') out[names[i]] = r.value;
    else console.error(r.reason);
  });
  if (!out.photo_inventory) out.photo_inventory = { collections: {}, films: [] };
  out.media = createMediaIndex(out.photo_inventory);
  return out;
}

function createMediaIndex(manifest) {
  const byId = new Map();
  for (const [collection, items] of Object.entries(manifest.collections || {})) {
    for (const item of items) byId.set(item.id, { ...item, collection });
  }
  const films = new Map((manifest.films || []).map((f) => [f.id, f]));
  return {
    get(id) {
      const item = byId.get(id);
      if (!item) console.warn(`[media] Unknown media id "${id}" — check data/photo_inventory.json`);
      return item || null;
    },
    collection: (name) => (manifest.collections?.[name] || []).map((i) => byId.get(i.id)),
    film: (id) => films.get(id) || null,
    films: () => [...films.values()],
  };
}

export const srcset = (item) => `${url(item.sm)} ${item.smW}w, ${url(item.lg)} ${item.lgW}w`;

/**
 * Build a responsive <img> for a manifest entry. Width/height attributes are
 * set from the manifest so the browser reserves space (no layout shift).
 */
export function picture(item, { alt = '', sizes = '100vw', eager = false, className = '', large = false } = {}) {
  if (!item) return h('div', { class: `img-missing ${className}`, role: 'img', 'aria-label': alt || 'Photo unavailable' });
  const img = h('img', {
    class: className,
    alt,
    width: item.width,
    height: item.height,
    loading: eager ? 'eager' : 'lazy',
    decoding: 'async',
    sizes,
    srcset: large ? null : srcset(item),
    src: url(large ? item.lg : item.sm),
    style: { backgroundColor: item.color || '' },
  });
  if (eager) img.setAttribute('fetchpriority', 'high');
  img.addEventListener('error', () => {
    img.classList.add('is-broken');
    console.warn(`[media] Failed to load image for ${item.id} (${item.file})`);
  }, { once: true });
  return img;
}

/** Year label for an age, e.g. age 34 → "2010 – 11" (she turns a year older each 27 October). */
export function yearsForAge(age, bornYear = 1976) {
  const start = bornYear + age;
  return `${start} – ${String(start + 1).slice(-2)}`;
}
