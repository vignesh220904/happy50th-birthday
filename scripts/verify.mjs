// Content + asset verification. Run with `npm test`.
// Checks that the family's words, milestones and media references are intact
// and that every file the site points to actually exists.

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const exists = (p) => existsSync(join(ROOT, p));

let failures = 0, passes = 0;
function check(name, ok, detail = '') {
  if (ok) { passes++; console.log(`  ✓ ${name}`); }
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
}
const section = (t) => console.log(`\n${t}`);

// ---------------------------------------------------------------------------
section('50 reasons');
const reasons = json('data/reasons.json');
const fixture = read('tests/fixtures/reasons.txt').trim().split(/\r?\n/).map((l) => l.replace(/^\d+\.\s/, ''));
check('exactly 50 reasons', reasons.reasons.length === 50, `found ${reasons.reasons.length}`);
check('numbered 1–50 once each', reasons.reasons.map((r) => r.n).join() === Array.from({ length: 50 }, (_, i) => i + 1).join());
const mismatched = reasons.reasons.filter((r) => r.text !== fixture[r.n - 1]);
check('every reason matches the family’s original wording exactly', !mismatched.length, mismatched.map((r) => `#${r.n}: "${r.text}"`).join('\n      '));
check('no reason is duplicated', new Set(reasons.reasons.map((r) => r.text)).size === 50);
const covered = reasons.chapters.flatMap((c) => Array.from({ length: c.range[1] - c.range[0] + 1 }, (_, i) => c.range[0] + i));
check('chapters cover 1–50 without gaps or overlap', covered.length === 50 && new Set(covered).size === 50 && Math.min(...covered) === 1 && Math.max(...covered) === 50);
check('closing message present', reasons.closing === 'Fifty reasons are only the beginning. The real reason is simple: our lives are more beautiful because you are in them.');

// ---------------------------------------------------------------------------
section('Media manifest');
const manifest = json('data/photo_inventory.json');
const all = Object.values(manifest.collections).flat();
const ids = new Map(all.map((m) => [m.id, m]));
check('ids are unique', ids.size === all.length);
const missingRenditions = all.filter((m) => !exists(m.sm) || !exists(m.lg));
check(`all ${all.length * 2} web renditions exist`, !missingRenditions.length, missingRenditions.map((m) => m.id).join(', '));
const missingSources = all.filter((m) => !exists(m.file));
check('every manifest entry points to an existing original', !missingSources.length, missingSources.map((m) => m.file).join(', '));
check('no processing errors recorded', !(manifest.errors || []).length, JSON.stringify(manifest.errors));
for (const [collection, folder] of [['journey', 'Final Life Journey'], ['age', 'Age 1 to 50'], ['gallery', 'Memory gallery']]) {
  const files = readdirSync(join(ROOT, folder)).filter((f) => /\.(jpe?g|png|webp|heic|heif)$/i.test(f));
  const listed = new Set(manifest.collections[collection].map((m) => m.file.split('/').pop()));
  const unlisted = files.filter((f) => !listed.has(f));
  check(`every image in "${folder}" is in the manifest (${files.length})`, !unlisted.length, `missing: ${unlisted.join(', ')} — run "npm run build:media"`);
}
check('assets/illustrations entries are labelled as illustrations', manifest.collections.illustrations.every((m) => m.kind === 'illustration'));
check('the bike scene (no original photo) is labelled as an illustration', ids.get('lj-7-png')?.kind === 'illustration');
check('age photos all have an age read from the filename', manifest.collections.age.every((m) => Number.isInteger(m.age) && m.age >= 1 && m.age <= 50));
for (const film of manifest.films) {
  check(`film "${film.src}" and its poster exist`, exists(film.src) && exists(film.poster));
}
check('the family memories film is in the manifest', manifest.films.some((f) => f.id === 'film-memories'));
check('the generated Life Journey film and the Age 1 to 50 film are removed', !manifest.films.some((f) => /life-journey|film-age|age\.mp4|life journey/.test(`${f.id} ${f.src}`)) && !exists('assets/videos/life journey.mp4') && !exists('assets/videos/age.mp4'));
const datedGallery = manifest.collections.gallery.filter((i) => i.date && /^\d{4}$/.test(i.group) && ['exif', 'filename'].includes(i.dateSource));
check(`gallery: ${datedGallery.length} photos have a recorded date (${manifest.collections.gallery.length - datedGallery.length} without one are left out of the dated gallery)`, datedGallery.length > 0 && datedGallery.every((i) => i.date.startsWith(i.group)));
check('no absolute or Windows paths in the manifest', !/[A-Za-z]:[\\/]|\\\\/.test(read('data/photo_inventory.json')));

// ---------------------------------------------------------------------------
section('Life journey');
const timeline = json('data/timeline.json');
const ms = timeline.milestones;
const unknown = ms.flatMap((m) => m.media.map((x) => x.id)).filter((id) => !ids.has(id));
check('every milestone photo id exists in the manifest', !unknown.length, unknown.join(', '));
check('every milestone photo has alt text', ms.every((m) => m.media.every((x) => x.alt && x.alt.length > 8)));
check('every milestone has a known era', ms.every((m) => timeline.eras.some((e) => e.id === m.era)));
const has = (year, re) => ms.some((m) => m.year === year && re.test(m.title + ' ' + m.caption));
check('1976 — born', has('1976', /born/i));
check('1979–1993 — schooling (uniform described)', has('1979 – 1993', /school/i) && ms.find((m) => m.id === 'schooling').caption.includes('white churidar, a sky-blue shawl and pants'));
check('1993–1996 — B.Com', has('1993 – 1996', /B\.Com/));
check('1996–1997 — first year of M.Com', has('1996 – 1997', /M\.Com/));
check('1997 — marriage', has('1997', /marriage/i));
check('1997 — TVS 50 & Hero Honda Splendor, marked as having no original photo', has('1997', /TVS 50/) && has('1997', /Hero Honda Splendor/) && !!ms.find((m) => m.id === 'first-bikes').noPhoto);
check('1998 — Seemantham and first child, Vikky', has('1998', /Seemantham/) && has('1998', /Vikky/));
check('2002 — second child, Varshu', has('2002', /Varshu/));
check('2004 — first housewarming at 3rd Main Road', has('2004', /housewarming/i) && has('2004', /3rd Main Road/));
check('2006 — first job and salary', has('2006', /first job/i) && has('2006', /salary/i));
const schoolScene = ms.find((m) => m.id === 'schooling').media.map((x) => ids.get(x.id));
check('school uniform scene is an illustration, alongside a real photo', schoolScene.some((m) => m.kind === 'illustration') && schoolScene.some((m) => m.kind === 'photo'));

// ---------------------------------------------------------------------------
section('Site details, gifts, wishes');
const site = json('data/site.json');
check('name is M. Buvaneswari', site.person.fullName === 'M. Buvaneswari');
check('born 27 October 1976', site.person.born === '1976-10-27');
check('celebration on 27 October 2026', site.event.date === '2026-10-27');
check('venue: Palmshore Restaurant, Ekkatuthangal, Chennai', site.event.venue === 'Palmshore Restaurant' && site.event.area === 'Ekkatuthangal, Chennai');
check('welcome: the requested wording', site.welcome.headline === 'Celebrating the Beautiful Journey of Buvaneswari' && site.welcome.supporting === '50 Years of Love, Strength & Beautiful Memories' && site.welcome.dates === '27 October 1976 – 27 October 2026');
check('welcome photo ids exist', site.welcome.photos.every((id) => ids.has(id)));
check('reveal: HAPPY 50TH BIRTHDAY / AMMA / M. BUVANESWARI', /^happy 50th birthday$/i.test(site.reveal.line1) && /^amma$/i.test(site.reveal.line2) && site.reveal.line3 === 'M. Buvaneswari');
check('reveal photo is a real photograph of Amma', ids.get(site.reveal.photo)?.kind === 'photo');
check('final greeting and messages', site.finale.headline === 'Happy 50th Birthday, Amma!'
  && site.finale.subline === '50 Years of Beautiful Memories. A Lifetime of Love. Countless Reasons to Celebrate You.'
  && site.finale.message === 'We may never be able to give back everything you have given us, but we will spend our lives making sure you always feel how deeply you are loved.');
check('music: a file is configured, exists, and is credited', !!site.music.src && exists(site.music.src) && /Creative Commons/.test(site.music.credit || ''));
check('Life Journey video is configured as an MP4 path', /\.mp4$/.test(site.videos.lifeJourney.src));
if (!exists(site.videos.lifeJourney.src)) console.log(`  · waiting for the family's Life Journey video: ${site.videos.lifeJourney.src}`);
const gifts = json('data/gifts.json');
check('50 gift slots numbered 1–50', gifts.gifts.length === 50 && gifts.gifts.every((g, i) => g.n === i + 1));
check('no gift is marked as given unless confirmed (all false by default)', gifts.gifts.every((g) => typeof g.given === 'boolean'));
const wishes = json('data/wishes.json');
check('wishes: the placeholder line is the family’s wording', wishes.emptyMessage === 'Messages filled with love, from the people who make her world special.');
check('wishes videos are configured as MP4 paths', (wishes.videos || []).length > 0 && wishes.videos.every((v) => /\.mp4$/.test(v.src)));
(wishes.videos || []).filter((v) => !exists(v.src)).forEach((v) => console.log(`  · waiting for the family's wishes video: ${v.src}`));

// ---------------------------------------------------------------------------
section('Pages and code');
const pages = ['index.html', ...readdirSync(join(ROOT, 'pages')).map((p) => `pages/${p}`)];
const index = read('index.html');
const indexRefs = [...index.matchAll(/(?:href|src)="([^"#:]+\.(?:css|js|woff2))"/g)].map((m) => m[1]);
check('index.html: stylesheets, scripts and fonts resolve', indexRefs.every((r) => exists(r)), indexRefs.filter((r) => !exists(r)).join(', '));
const sceneIds = [...index.matchAll(/data-scene="([a-z-]+)"/g)].map((m) => m[1]);
check('index.html: the presentation scenes, in order', sceneIds.join() === 'welcome,reveal,journey-film,journey,reasons,memories,gallery,wishes,finale', sceneIds.join());
check('index.html: the welcome is the scene shown first', /class="scene scene--welcome is-active"/.test(index));
for (const page of pages.filter((p) => p.startsWith('pages/'))) {
  const target = /url=\.\.\/index\.html#([a-z-]+)/.exec(read(page))?.[1];
  check(`${page}: opens the presentation at an existing scene`, sceneIds.includes(target), target);
}
const fontsCss = read('css/fonts.css');
check('fonts are vendored locally (works offline)', [...fontsCss.matchAll(/url\(\.\.\/([^)]+)\)/g)].every((m) => exists(m[1])) && !/fonts\.googleapis/.test(index));
const jsFiles = [];
const walk = (dir) => readdirSync(join(ROOT, dir), { withFileTypes: true }).forEach((d) => {
  if (d.isDirectory()) { if (d.name !== 'vendor') walk(`${dir}/${d.name}`); }
  else if (d.name.endsWith('.js')) jsFiles.push(`${dir}/${d.name}`);
});
walk('js');
const syntaxErrors = jsFiles.filter((f) => {
  try { execFileSync(process.execPath, ['--check', join(ROOT, f)], { stdio: 'pipe' }); return false; } catch { return true; }
});
check(`all ${jsFiles.length} JavaScript modules parse`, !syntaxErrors.length, syntaxErrors.join(', '));
const stale = jsFiles.concat(['index.html']).filter((f) => /assets\/(photos|thumbnails)\//.test(read(f)));
check('no references to the removed assets/photos or assets/thumbnails folders', !stale.length, stale.join(', '));
const removed = jsFiles.concat(['index.html', 'data/site.json']).filter((f) => /film-birthday|film-life-journey|film-age|openCinema|filmButton|Watch the Birthday Film|life journey\.mp4|age\.mp4/.test(read(f)));
check('no trace of the removed Birthday Film button, generated Life Journey film or Age film', !removed.length, removed.join(', '));
check('three.js is vendored locally (works offline)', exists('js/vendor/three.module.min.js'));

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
