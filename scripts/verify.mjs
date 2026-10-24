// Content + asset verification. Run with `npm test`.
// Checks that the family's words, milestones and media references are intact
// and that every file the site points to actually exists.

import { readFileSync, existsSync, readdirSync, statSync, openSync, readSync, closeSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(fileURLToPath(new URL('..', import.meta.url)));
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const json = (p) => JSON.parse(read(p));
const exists = (p) => existsSync(join(ROOT, p));
const mb = (p) => statSync(join(ROOT, p)).size / 1e6;
const GITHUB_MAX_MB = 100;

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
check('the old generated film copies stay out of assets/videos', !manifest.films.some((f) => /film-life-journey|film-age|film-childhood|age\.mp4|life journey/.test(`${f.id} ${f.src}`)) && !exists('assets/videos/life journey.mp4') && !exists('assets/videos/age.mp4'));
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
const chapters = timeline.chapters || [];
const inChapter = (c) => ms.filter((m) => m.sortYear >= c.from && m.sortYear <= c.to);
const journeyCh = chapters.find((c) => c.id === 'journey'), proudCh = chapters.find((c) => c.id === 'proud');
check('slideshow 1: "A Journey Through Time", 1976 – 2005', journeyCh?.title === 'A Journey Through Time' && journeyCh.from === 1976 && journeyCh.to === 2005);
check('slideshow 2: "Proud Moments", from 2006, with every Proud Moments milestone', proudCh?.title === 'Proud Moments' && proudCh.from === 2006 && ms.filter((m) => m.era === 'pride').every((m) => inChapter(proudCh).includes(m)));
check('every milestone appears in exactly one slideshow', ms.every((m) => chapters.filter((c) => inChapter(c).includes(m)).length === 1));
const photoUse = ms.flatMap((m) => m.media.map((x) => x.id));
check('no photograph is repeated across the slideshows', new Set(photoUse).size === photoUse.length);
const mcom = ms.find((m) => m.id === 'mcom');
check('1996 (M.Com): no approved photo yet, so its year card is clearly marked as pending', mcom.media.length > 0 || !!mcom.pendingPhoto);
const mcomFirst = ids.get(mcom.media[0]?.id);
check('1996 (M.Com): a 1990s college illustration, labelled as an illustration (never passed off as a photograph of her)', !!mcomFirst && mcomFirst.kind === 'illustration' && /college/.test(mcomFirst.id) && /illustration/i.test(mcom.media[0].alt), mcom.media[0]?.id);
check('1996 (M.Com): the year and the approved caption are kept', mcom.year === '1996 – 1997' && mcom.caption === 'She went on to complete the first year of her Master of Commerce.');
const fifty = ms.find((m) => m.id === 'fifty');
const fiftyPhotos = fifty.media.map((x) => ids.get(x.id));
check('Fifty: Amma\'s own photographs fill the slot (the approved portrait, Age 1 to 50/46.1.jpg, first; no blank card)', fiftyPhotos.length > 0 && fiftyPhotos.every((m) => m?.kind === 'photo' && m.collection === undefined && /^Age 1 to 50\//.test(m.file)) && fifty.media[0].id === 'age-46-1', fifty.media.map((x) => x.id).join(', '));
check('Fifty: the date and caption are kept', fifty.year === '27 October 2026' && /^Fifty years of love, strength, sacrifice and beautiful memories\./.test(fifty.caption));

// ---------------------------------------------------------------------------
section('Site details and wishes');
const site = json('data/site.json');
check('name is M. Buvaneswari', site.person.fullName === 'M. Buvaneswari');
check('born 27 October 1976', site.person.born === '1976-10-27');
check('celebration on 27 October 2026', site.event.date === '2026-10-27');
check('venue: Palmshore Restaurant, Ekkatuthangal, Chennai', site.event.venue === 'Palmshore Restaurant' && site.event.area === 'Ekkatuthangal, Chennai');
check('welcome: "Fifty Years. A Thousand Memories. One Beautiful Life."', (site.welcome.title || []).join(' ') === 'Fifty Years. A Thousand Memories. One Beautiful Life.');
check('welcome: the approved earlier wording is kept', site.welcome.intro === 'Celebrating the Beautiful Journey of Buvaneswari' && site.welcome.supporting === '50 Years of Love, Strength & Beautiful Memories' && site.welcome.dates === '27 October 1976 – 27 October 2026');
check('welcome: one action, "Begin the Celebration", and no photo collage', site.welcome.begin === 'Begin the Celebration' && !site.welcome.photos && !site.welcome.explore);
check('reveal: HAPPY 50TH BIRTHDAY / AMMA / M. BUVANESWARI', /^happy 50th birthday$/i.test(site.reveal.line1) && /^amma$/i.test(site.reveal.line2) && site.reveal.line3 === 'M. Buvaneswari');
check('reveal photo is a real photograph of Amma', ids.get(site.reveal.photo)?.kind === 'photo');
check('reveal photo is the replacement the family chose (Age 1 to 50/46.1.jpg)', ids.get(site.reveal.photo)?.file === 'Age 1 to 50/46.1.jpg');
check('final greeting and messages', site.finale.headline === 'Happy 50th Birthday, Amma!'
  && site.finale.subline === '50 Years of Beautiful Memories. A Lifetime of Love. Countless Reasons to Celebrate You.'
  && site.finale.message === 'We may never be able to give back everything you have given us, but we will spend our lives making sure you always feel how deeply you are loved.');
check('music: the family’s track is configured, exists, and is credited', site.music.src === 'assets/audio/music.mp3' && exists(site.music.src) && !!site.music.credit);
const audioJs = read('js/core/audio.js');
check('music: soft under the videos, 10–15 % of its normal volume (videoLevel), never muted', site.music.videoLevel >= 0.1 && site.music.videoLevel <= 0.15 && /config\.volume \* \(holds\.size \? config\.videoLevel : 1\)/.test(audioJs));
check('music: a video never pauses or restarts it (only the host\'s M switches it off)', (audioJs.match(/audio\.pause\(\)/g) || []).length === 1 && /if \(!state\.on\) audio\.pause\(\)/.test(audioJs) && /if \(audio\.paused\) await audio\.play\(\)/.test(audioJs));
check('music: the videos\' own sound is never changed by it (the controller touches only its own <audio>)', !/\.muted|querySelector|HTMLVideoElement|video\.volume/.test(audioJs) && !/music[^\n]*\b(video|v)\.(volume|muted)/.test(read('js/core/player.js') + read('js/sections/cinema.js')));
check('music: one controller, driven by the videos\' own play / playing / pause / ended / error events', ['play', 'playing', 'pause', 'ended', 'error'].every((ev) => new RegExp(`addEventListener\\('${ev}'`).test(read('js/core/player.js'))) && /music\.hold\('video'\)/.test(read('js/core/player.js')) && (read('js/core/audio.js').match(/new Audio\(/g) || []).length === 1);
check('music: kept low (volume 0.4 or less)', site.music.volume > 0 && site.music.volume <= 0.4);
// The family's three films, from VIDEOS/ (prepared by npm run build:films)
const FILMS = [['storyFilm', 'VIDEOS/age 1 to 5 story video.mp4'], ['ageFilm', 'VIDEOS/updated/AGE 1 TO 50 - real video-update.mp4'], ['lifeJourney', 'VIDEOS/updated/LIFE JOURNEY-update.mp4']];
for (const [key, original] of FILMS) {
  const f = site.videos[key] || {};
  // (an original that is not in the presentation may have been moved away; its web copy is what counts)
  check(`film ${key}: made from the family's own "${original.split('/').pop()}"`, f.source === original && (!existsSync(join(ROOT, 'VIDEOS')) || exists(original) || f.inPresentation === false), f.source);
  check(`film ${key}: its web copy (MP4) and poster exist`, /^assets\/videos\/family\/[\w-]+\.mp4$/.test(f.src || '') && exists(f.src) && !!f.poster && exists(f.poster), `${f.src} · ${f.poster}`);
  if (f.src && exists(f.src)) check(`film ${key}: under ${GITHUB_MAX_MB} MB (${mb(f.src).toFixed(1)} MB)`, mb(f.src) < GITHUB_MAX_MB);
}
check('the three films are three different files', new Set(FILMS.map(([k]) => site.videos[k]?.src)).size === 3);
check('page 3 is "Age 1 to 50 — Her Story" (not "Age 1 to 5"), made from the story film', site.videos.storyFilm.title === 'Age 1 to 50' && site.videos.storyFilm.titleAccent === '— Her Story' && site.videos.storyFilm.playerTitle === 'Age 1 to 50 — Her Story' && site.videos.storyFilm.inPresentation !== false);
check('the separate "Age 1 to 50 – Real Journey" video is left out of the presentation (its file stays)', site.videos.ageFilm.inPresentation === false && exists(site.videos.ageFilm.src));
check('"Her Life Journey" (the LIFE JOURNEY-update video) is in the presentation, with its proper title and a short title before it', site.videos.lifeJourney.inPresentation !== false && exists(site.videos.lifeJourney.src) && site.videos.lifeJourney.source === 'VIDEOS/updated/LIFE JOURNEY-update.mp4'
  && `${site.videos.lifeJourney.title} ${site.videos.lifeJourney.titleAccent}` === 'Her Life Journey' && site.videos.lifeJourney.playerTitle === 'Her Life Journey' && site.videos.lifeJourney.introSeconds > 0 && site.videos.lifeJourney.introSeconds < 10);
const appJs = read('js/app.js');
const order = [...appJs.matchAll(/\{ id: '([a-z-]+)'/g)].map((m) => m[1]);
check('running order after Our Memory Film: 8 the wishes, 9 Her Life Journey, 10 Happy Birthday, Amma, then A Final Gift of Love', order.slice(order.indexOf('memories')).join() === 'memories,wishes,age-film,journey-film,cake,finale' && site.videos.ageFilm.inPresentation === false
  && /id: 'journey-film', title: 'Her Life Journey'/.test(appJs) && /id: 'cake', title: 'Happy Birthday, Amma'/.test(appJs), order.join());
check('the closing page is not counted ("Final", never "11 of 10")', /id: 'finale', title: 'A Final Gift of Love', mod: finale, numbered: false/.test(appJs) && /numberOf\(i\) \? `\$\{numberOf\(i\)\} of \$\{counted\(\)\}` : 'Final'/.test(read('js/core/deck.js')));
const visibleCopy = ['js/app.js', 'js/sections/family-film.js', 'js/sections/story-film.js', 'scripts/build_pages.py', ...readdirSync(join(ROOT, 'pages')).map((f) => `pages/${f}`)];
const oldTitle = visibleCopy.filter((f) => /Age 1 to 5[:\s]*Her Story|'Age 1 to 5'|Real Journey"\)/.test(read(f)));
check('no visible "Age 1 to 5" or "Real Journey" film titles left in the presentation or its links', !oldTitle.length && !/"title": "Age 1 to 5"/.test(read('data/site.json')), oldTitle.join(', '));
check("the memories film is the family's own film", site.videos.memories.film === 'film-memories');
const wishes = json('data/wishes.json');
const wv = wishes.videos || [];
check('wishes: the placeholder line is the family’s wording', wishes.emptyMessage === 'Messages filled with love, from the people who make her world special.');
check('wishes: every listed video is an MP4 that exists', wv.every((v) => /\.mp4$/.test(v.src) && exists(v.src)), wv.filter((v) => !exists(v.src)).map((v) => v.src).join(', '));
check('wishes: numbered 1, 2, 3 … in the family’s order', wv.every((v, i) => v.n === i + 1));
const leading = (f) => { const m = /^\s*(\d+)/.exec((f || '').split('/').pop()); return m ? Number(m[1]) : Infinity; };
const ww = wv.filter((v) => v.kind !== 'film'); // the family's messages (without the film placed among them)
check('wishes: the order follows the numbers in the family’s filenames', ww.every((v, i) => i === 0 || leading(ww[i - 1].file) <= leading(v.file)));
check('wishes: captions come only from the filenames (none from marks like "(1)", "a" or "002")', ww.every((v) => !v.from || (v.file || '').includes(v.from)) && ww.every((v) => !/^\(?\d+\)?$|^[a-z]$/i.test(v.from)));
check('wishes: the family’s numbers, in numeric order (2 before 10); a second file for a number follows the plain one', ww.every((v, i) => v.number === leading(v.file) && (i === 0 || ww[i - 1].number <= v.number))
  && ['13', '16'].every((n) => ww.findIndex((v) => v.file.endsWith(`/${n}.mp4`)) + 1 === ww.findIndex((v) => v.file.endsWith(`/${n}(1).mp4`)))
  && ww.findIndex((v) => v.file.endsWith('/17 - a.mp4')) + 1 === ww.findIndex((v) => v.file.endsWith('/17 - b.mp4')));
const at = (f) => ww.findIndex((v) => v.file.endsWith(`/${f}`));
check('wishes: 15 a (the newest) plays right after 15 and right before 16', at('15 a.MOV') > 0 && at('15.mp4') + 1 === at('15 a.MOV') && at('15 a.MOV') + 1 === at('16.mp4') && ww[at('15 a.MOV')].from === '');
check('wishes: from the "family wishes updated video" folder, all 34 videos, every one confirmed', wishes.source === 'family wishes updated video' && ww.length === 34 && ww.every((v) => v.file.startsWith('family wishes updated video/') && v.confirmed === true));
check('wishes: only the 34 family messages — Life Journey is not among them (it has its own page, after the wishes)', wv.length === 34 && !wv.some((v) => v.kind === 'film' || /life-journey/i.test(v.src)) && !(wishes.films || []).length && /\/30\.mp4$/.test(wv.at(-1).file));
const sha1 = (p) => createHash('sha1').update(readFileSync(join(ROOT, p))).digest('hex');
const staleRev = wv.filter((v) => !v.rev || !exists(v.src) || sha1(v.src).slice(0, 10) !== v.rev);
check('wishes: every video has a fingerprint ("rev") that matches its file, so a replaced file gets a new URL', !staleRev.length, staleRev.map((v) => v.src).join(', '));
/** The MP4's top-level boxes and its codecs, read from the file itself (no renamed extension can pass). */
function mp4Info(p) {
  const fd = openSync(join(ROOT, p), 'r');
  const size = statSync(join(ROOT, p)).size;
  const boxes = [];
  let moov = null;
  try {
    for (let pos = 0; pos + 8 <= size;) {
      const head = Buffer.alloc(16);
      readSync(fd, head, 0, 16, pos);
      let len = head.readUInt32BE(0);
      const type = head.toString('latin1', 4, 8);
      if (len === 1) len = Number(head.readBigUInt64BE(8));
      if (len === 0) len = size - pos;
      if (len < 8) break;
      boxes.push(type);
      if (type === 'moov') { moov = Buffer.alloc(len); readSync(fd, moov, 0, len, pos); }
      pos += len;
    }
  } finally { closeSync(fd); }
  const m = moov ? moov.toString('latin1') : '';
  return { faststart: boxes.indexOf('moov') > -1 && boxes.indexOf('moov') < boxes.indexOf('mdat'), avc: m.includes('avc1'), hevc: /hvc1|hev1/.test(m), aac: m.includes('mp4a') };
}
const badCodec = wv.map((v) => [v.src, exists(v.src) ? mp4Info(v.src) : null]).filter(([, i]) => !i || !i.avc || i.hevc || !i.aac || !i.faststart);
check(`wishes: every playlist video is a browser-ready MP4: H.264 (avc1) + AAC, no HEVC, index at the front (${wv.length})`, !badCodec.length, badCodec.map(([s, i]) => `${s} ${JSON.stringify(i)}`).join('\n      '));
const bigWishes = wv.filter((v) => exists(v.src) && mb(v.src) >= GITHUB_MAX_MB);
check(`wishes: every web copy is under ${GITHUB_MAX_MB} MB`, !bigWishes.length, bigWishes.map((v) => v.src).join(', '));
if (existsSync(join(ROOT, wishes.source || 'Family video wishes'))) {
  const folder = wishes.source || 'Family video wishes';
  const sources = readdirSync(join(ROOT, folder)).filter((f) => /\.(mp4|mov|m4v|webm|3gp|mkv|avi)$/i.test(f));
  const unlisted = sources.filter((f) => !wv.some((v) => v.file === `${folder}/${f}`));
  check(`wishes: every video in "${folder}" is in the playlist (${sources.length})`, !unlisted.length, `not listed (run npm run build:wishes; it reports files that cannot be decoded): ${unlisted.join(', ')}`);
}
if (!wv.length) console.log('  · waiting for the "Family video wishes" folder (then run: npm run build:wishes)');
else console.log(`  · ${wv.filter((v) => v.confirmed !== false).length} of ${wv.length} wishes will play; ${wv.filter((v) => v.confirmed === false).length} wait for the family's confirmation`);

// ---------------------------------------------------------------------------
section('Pages and code');
const pages = ['index.html', ...readdirSync(join(ROOT, 'pages')).map((p) => `pages/${p}`)];
const index = read('index.html');
const indexRefs = [...index.matchAll(/(?:href|src)="([^"#:]+\.(?:css|js|woff2))"/g)].map((m) => m[1]);
check('index.html: stylesheets, scripts and fonts resolve', indexRefs.every((r) => exists(r)), indexRefs.filter((r) => !exists(r)).join(', '));
const sceneIds = [...index.matchAll(/data-scene="([a-z-]+)"/g)].map((m) => m[1]);
check('index.html: the scenes, in order (age-film stays as a switched-off slot)', sceneIds.join() === 'welcome,reveal,story-film,journey,proud,reasons,memories,wishes,age-film,journey-film,cake,finale', sceneIds.join());
check('the presentation skips a film the family left out (inPresentation: false)', /inPresentation === false\) return \{ absent: true \}/.test(read('js/sections/family-film.js')));
check('the separate Family Photo Gallery is removed (its photographs stay in "Memory gallery/")', !sceneIds.includes('gallery') && !exists('js/sections/gallery.js') && manifest.collections.gallery.length > 0);
check('no loading screen before the welcome', !/class="loader"/.test(index));
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
const presentation = ['js/app.js', 'js/core/deck.js', 'js/core/player.js', 'js/core/audio.js', ...jsFiles.filter((f) => f.startsWith('js/sections/') && !/childhood/.test(f))];
const removed = presentation.concat(['index.html', 'data/site.json', 'data/photo_inventory.json']).filter((f) => /film-birthday|film-life-journey|film-childhood|film-age|openCinema|filmButton|Watch the Birthday Film|assets\/videos\/(life journey|age)\.mp4/i.test(read(f)) || /(^|["'\s])VIDEOS\//.test(f.endsWith('.json') ? '' : read(f)));
check('no trace of the removed Childhood film, the old film copies or the Birthday Film button', !removed.length, removed.join(', '));
check('the site plays the prepared copies, never the VIDEOS/ originals directly', !Object.values(site.videos).some((v) => /^VIDEOS\//.test(v?.src || '')));
const app = read('js/app.js');
const importsOf = (f) => [...read(f).matchAll(/from\s+['"]([^'"]+)['"]/g)].map((m) => m[1]);
const reachable = new Set();
const visit = (f) => { if (reachable.has(f) || !exists(f)) return; reachable.add(f); importsOf(f).forEach((i) => visit(join(f, '..', i).replace(/\\/g, '/'))); };
visit('js/app.js');
check('no synthesised "Happy Birthday" song, 3D pink cake or childhood film in the presentation', ![...reachable].some((f) => /birthday-song|cake-scene|childhood/.test(f)) && !/childhood|birthday-song|cake-scene/.test(app), [...reachable].filter((f) => /birthday-song|cake-scene|childhood/.test(f)).join(', '));
check('cake: in the blue, ivory and gold palette (no pink or lavender)', !/pink|lavender|#e7889f|#f4a6c0|#c8a2c8/i.test(read('js/sections/cake.js')) && reachable.has('js/sections/cake.js'));
const num = (f, name) => Number(new RegExp(`${name} = ([0-9]+)`).exec(read(f))?.[1]);
check('slideshows: faster (milestone 4–5 s, other photos 3–4 s, cross-fade 0.4–0.7 s)', num('js/sections/timeline-show.js', 'FIRST_PHOTO_MS') <= 5000 && num('js/sections/timeline-show.js', 'NEXT_PHOTO_MS') <= 4000 && num('js/sections/timeline-show.js', 'FADE_MS') >= 400 && num('js/sections/timeline-show.js', 'FADE_MS') <= 700 && /tslide-in 600ms/.test(read('css/scenes.css')));
check('50 Reasons: no separate "All 50 Reasons" view', !/All 50 Reasons|id: 'all'/.test(read('js/sections/reasons.js')));
check('final page: no numbered gift tracker', !/gtile|gtracker|Mark all given/.test(read('js/sections/finale.js')));
const finaleJs = read('js/sections/finale.js');
check('final page: an animated gift (no still image): it floats, the lid opens, golden light, the 50 rises, sparkles, then the words', !/<img|picture\(/.test(finaleJs) && ['is-playing', 'is-wiggling', 'is-open', 'is-rising', 'is-revealed'].every((c) => finaleJs.includes(`'${c}'`)) && ['fgift__lid', 'fgift__beam', 'fgift__fifty', 'fgift__sparks'].every((c) => finaleJs.includes(c) && read('css/scenes.css').includes(`.${c}`)));
check('final page: Replay and Start Again; reduced motion shows the finished scene at once', /'Replay'/.test(finaleJs) && /'Start Again'/.test(finaleJs) && /prefersReducedMotion\(\)\) \{ el\.classList\.add\(\.\.\.STATES\)/.test(finaleJs));
check('videos: the films wait 10 s on their introduction before playing', num('js/sections/cinema.js', 'INTRO_MS') === 10000);
check('videos: Messages Filled With Love waits about 7 s (5–10 s) before the first message', num('js/sections/wishes.js', 'INTRO_MS') >= 5000 && num('js/sections/wishes.js', 'INTRO_MS') <= 10000 && /introMs: INTRO_MS/.test(read('js/sections/wishes.js')));
check('videos: each video and poster is asked for with its fingerprint ("?v=rev"), and url() keeps that query', /src: versioned\(v\.src, v\.rev\)/.test(read('js/sections/cinema.js')) && /poster: versioned\(v\.poster, v\.rev\)/.test(read('js/sections/cinema.js')) && /const \[file, query\] = path\.split\('\?'\)/.test(read('js/core/data.js')));
const vercel = json('vercel.json');
const cacheFor = (src) => vercel.headers.find((x) => x.source === src)?.headers.find((x) => x.key === 'Cache-Control')?.value || '';
check('deploy: code and styles are checked for updates on every visit (never run stale)', /max-age=0, must-revalidate/.test(cacheFor('/(css|js)/(.*)')));
check('videos: a failed video is tried once more from a fresh URL, then shows Retry and Skip (never skipped silently)', /retryNow\(\);\s+return;/.test(read('js/sections/cinema.js')) && /'Retry'/.test(read('js/core/player.js')) && /'Skip'/.test(read('js/core/player.js')) && !/SKIP_MS/.test(read('js/sections/cinema.js')) && /STALL_MS = \d+/.test(read('js/core/player.js')));
check('videos: one intro timer per page, cleared before it is set again', /clearTimeout\(introTimer\);\s+counting\(true\);\s+introTimer = setTimeout/.test(read('js/sections/cinema.js')));
const cssAll = ['css/variables.css', 'css/global.css', 'css/deck.css', 'css/components.css', 'css/scenes.css'].map(read).join('\n');
check('blue theme: a royal-blue page background with ivory text on every page', /body \{\s+background: var\(--royal-deep\);/.test(read('css/global.css')) && /--ink: #fffaf0;/.test(read('css/variables.css')) && /--royal-deep: #133a85;/.test(read('css/variables.css')));
check('blue theme: no plain white page, slide, bubble or control backgrounds left', !/background: (#fff|#ffffff|var\(--warm-white\)|var\(--ivory\)|var\(--sky\)|rgba\(255, 255, 255, 0\.(7|8|9)\d*\));/.test(cssAll), (cssAll.match(/background: (#fff|#ffffff|var\(--warm-white\)|var\(--ivory\)|var\(--sky\)|rgba\(255, 255, 255, 0\.(7|8|9)\d*\));/g) || []).join(' '));
check('welcome: no ordinary Next button (the deck hides it there)', /body\[data-current-scene="welcome"\] \.deck-bar--nav \{ display: none; \}/.test(read('css/deck.css')));

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
