// Browser test for the presentation (npm run test:browser).
// Serves the site, opens it in headless Chrome/Edge and checks, at projector,
// laptop and phone sizes: the welcome is the default screen, every scene fits
// its 16:9 frame, navigation (Begin, buttons, keys, clicker, menu) is
// consistent, automatic playback moves on by itself and pauses, the slideshows,
// reasons, films and the final gift behave as the family asked, and there are
// no console errors or broken files.
//
// Uses the Chrome or Edge already installed (set CHROME_PATH to override).
// SMOKE_SHOTS=folder saves screenshots; SMOKE_ONLY=layouts|interactions|reduced|pages runs one group.

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from './serve.mjs';

const PORT = 8765;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SMOKE_SHOTS;
const ONLY = process.env.SMOKE_ONLY;
const run = (group) => !ONLY || ONLY === group;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const json = (p) => JSON.parse(readFileSync(new URL(`../${p}`, import.meta.url), 'utf8'));

const browserPath = [
  process.env.CHROME_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].find((p) => p && existsSync(p));
if (!browserPath) {
  console.error('No Chrome/Edge found. Set CHROME_PATH to a Chromium-based browser.');
  process.exit(1);
}

const VIEWPORTS = [
  { name: 'projector-1080p', width: 1920, height: 1080 },
  { name: 'projector-900p', width: 1600, height: 900 },
  { name: 'laptop-768p', width: 1366, height: 768 },
  { name: 'hd-720p', width: 1280, height: 720 },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'mobile-landscape', width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));
const site = json('data/site.json');
const timeline = json('data/timeline.json');
const wishesData = json('data/wishes.json');
// The family's films (each joins the presentation once its web copy exists, npm run build:films,
// unless the family left it out: inPresentation false)
const FILM_SCENES = [['story-film', 'storyFilm'], ['age-film', 'ageFilm'], ['journey-film', 'lifeJourney']]
  .filter(([, key]) => site.videos[key]?.src && exists(site.videos[key].src) && site.videos[key].inPresentation !== false).map(([id]) => id);
const FILM_INTRO_MS = 10000;  // a film's introduction (js/sections/cinema.js → INTRO_MS)
const WISHES_INTRO_MS = 7000; // the messages' introduction (js/sections/wishes.js → INTRO_MS)
const has = (id) => FILM_SCENES.includes(id);
const SCENE_ORDER = ['welcome', 'reveal', ...(has('story-film') ? ['story-film'] : []), 'journey', 'proud', 'reasons', 'memories', 'wishes',
  ...(has('age-film') ? ['age-film'] : []), ...(has('journey-film') ? ['journey-film'] : []), 'cake', 'finale'];
const THEATRE_BUTTONS = /^Back,(Full screen|Normal screen),Next$/;
/** <body data-music>: off, normal (ordinary pages) or soft (under a film or wish) */
const musicIs = (page, state) => page.evaluate((st) => document.body.dataset.music === st, state);
/** Can the background music be heard (playing, volume above zero)? */
const musicAudible = (page) => page.evaluate(() => window.__music.audible);
/** Soft for a video: still playing, at 10–15 % of its normal volume (allowing for the fade, up to `ms`) */
const musicSoft = (page, ms = 2000) => waitFor(page, () => document.body.dataset.music === 'soft' && window.__music.audible && window.__music.level >= 0.1 && window.__music.level <= 0.15, null, ms);
/** Back to its normal volume */
const musicNormal = (page, ms = 3000) => waitFor(page, () => document.body.dataset.music === 'normal' && window.__music.audible && window.__music.level > 0.97, null, ms);
/** Watch the whole session: once a video has played for over a second, or the theatre has been open that long
 *  (the gap between two messages), is the music ever louder than soft, or muted? (the music is on throughout) */
const watchSilence = (page) => page.evaluate(() => {
  window.__overlaps = [];
  window.__plays = [];
  // measured from each (re)start: a pause and a later Play start the clock again
  document.addEventListener('play', (e) => { e.target.__since = performance.now(); }, true);
  document.addEventListener('pause', (e) => { e.target.__since = undefined; }, true);
  const real = HTMLMediaElement.prototype.play;
  HTMLMediaElement.prototype.play = function play() { if (this instanceof HTMLVideoElement) window.__plays.push(decodeURI(this.currentSrc || this.src).split('?')[0].split('/').pop()); return real.call(this); };
  let theatreSince;
  setInterval(() => {
    const now = performance.now();
    theatreSince = document.body.classList.contains('is-theatre') ? (theatreSince ?? now) : undefined;
    if (!window.__music.on) return;
    const v = [...document.querySelectorAll('video')].find((x) => !x.paused && !x.ended && now - (x.__since ?? Infinity) > 1200);
    const gap = !v && theatreSince !== undefined && now - theatreSince > 1200 && document.querySelector('.cinema__upnext:not([hidden])') ? 'between two messages' : '';
    const where = v ? `${v.closest('.scene').dataset.scene} @ ${v.currentTime.toFixed(1)} s` : gap;
    if (!where) return;
    const lvl = window.__music.level;
    if (lvl > 0.16 || lvl < 0.08) window.__overlaps.push(`${where}: music at ${Math.round(lvl * 100)} %`);
  }, 100);
});
/** Esc closes the video (the first Esc leaves full screen, if the browser is in it) */
const escapeVideo = async (page) => { for (let k = 0; k < 2 && await page.evaluate(() => document.body.classList.contains('is-theatre')); k++) { await page.keyboard.press('Escape'); await new Promise((r) => setTimeout(r, 450)); } };
const slidesIn = (chapterId) => {
  const c = timeline.chapters.find((x) => x.id === chapterId);
  return timeline.milestones.filter((m) => m.sortYear >= c.from && m.sortYear <= c.to).reduce((n, m) => n + Math.max(1, m.media.length), 0);
};
const playableWishes = (wishesData.videos || []).filter((v) => v.confirmed !== false && exists(v.src));

let failures = 0, passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passes++; console.log(`  ✓ ${name}`); }
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function watch(page) {
  const problems = [];
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()} ${m.location()?.url || ''}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText || '';
    if (!/ERR_ABORTED/.test(err)) problems.push(`requestfailed: ${r.url()} ${err}`);
  });
  return problems;
}

async function open(browser, path, viewport, { reduced = false, init = null } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  if (init) await page.evaluateOnNewDocument(init);
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const problems = watch(page);
  await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'), { timeout: 30000 });
  return { page, problems };
}

const active = (page) => page.$eval('.scene.is-active', (s) => s.dataset.scene);
const sub = (page) => page.$eval('.deck-label__sub', (s) => s.textContent);
const autoOn = (page) => page.evaluate(() => window.__deck.autoplaying);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }); };
const press = async (page, key) => { await page.keyboard.press(key); await sleep(520); };
const video = (scene) => `.scene[data-scene="${scene}"] video`;
const theatreOpen = (page) => page.evaluate(() => document.body.classList.contains('is-theatre'));
/** The scenes whose video is playing right now (there should never be more than one). */
const playing = (page) => page.evaluate(() => [...document.querySelectorAll('video')].filter((v) => !v.paused && !v.ended).map((v) => v.closest('.scene').dataset.scene));
const seekToEnd = (page, scene) => page.evaluate((sel) => { const v = document.querySelector(sel); v.currentTime = Math.max(0, v.duration - 0.4); }, video(scene));
const waitFor = (page, fn, arg, timeout) => page.waitForFunction(fn, { timeout, polling: 100 }, arg).then(() => true, () => false);
/** Wait until the active scene's entrance animations have finished (looping ones excluded). */
const settle = (page) => page.waitForFunction(() => document.getAnimations()
  .filter((a) => a.effect?.target?.closest?.('.scene.is-active') && a.effect.getTiming().iterations !== Infinity)
  .every((a) => a.playState !== 'running'), { timeout: 6000, polling: 100 }).catch(() => {});

/** Visible elements of the active scene that leave the screen (decorative layers excluded). */
const offscreen = (page) => page.evaluate(() => {
  const s = document.querySelector('.scene.is-active');
  const out = [];
  s.querySelectorAll('.scene__frame *').forEach((el) => {
    if (el.closest('.welcome__visual, .reveal__portrait, .finale__visual, .cake__visual, .tslide__fill, .tslide__img, svg')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return;
    if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) out.push(`${el.className || el.tagName} (${Math.round(r.left)},${Math.round(r.top)})–(${Math.round(r.right)},${Math.round(r.bottom)})`);
  });
  return out;
});
/** Does any text overflow its own clipped box (cut-off captions or reasons)? */
const clipped = (page) => page.evaluate(() => [...document.querySelectorAll('.scene.is-active .tshow__story, .scene.is-active .rcloud')]
  .filter((el) => el.scrollHeight > el.clientHeight + 2).map((el) => el.className));

const server = await serve(PORT);
const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  protocolTimeout: 180000,
  args: ['--autoplay-policy=no-user-gesture-required'],
});

try {
  // ---------------------------------------------------------------- layouts
  for (const vp of run('layouts') ? VIEWPORTS : []) {
    console.log(`\n${vp.name} (${vp.width}×${vp.height})`);
    const { page, problems } = await open(browser, 'index.html', vp);
    check('opens on the welcome screen', (await active(page)) === 'welcome');
    const landscape = vp.width > vp.height && vp.width > 760 && vp.height > 500; // phones scroll inside scenes
    const ids = await page.evaluate(() => window.__deck.scenes.map((s) => s.id));
    check('scenes are in the presentation order', ids.join() === SCENE_ORDER.join(), ids.join());
    for (const [i, id] of ids.entries()) {
      await page.evaluate((k) => window.__deck.go(k), i);
      await sleep(id === 'reasons' ? 4600 : 950); // the reasons gather one by one
      await settle(page);
      if (landscape) {
        const off = await offscreen(page);
        check(`${id}: fits the 16:9 frame`, !off.length, off.slice(0, 4).join('\n      '));
        const cut = await clipped(page);
        check(`${id}: no text cut off`, !cut.length, cut.join(', '));
      }
      const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
      if (overflowX > 0) check(`${id}: no horizontal page scroll`, false, `${overflowX}px`);
      await shot(page, `${vp.name}-${String(i + 1).padStart(2, '0')}-${id}`);
    }
    check('the page itself never scrolls', await page.evaluate(() => scrollY === 0 && document.documentElement.scrollHeight <= innerHeight + 1));
    check('no console errors or broken files', !problems.length, problems.slice(0, 6).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- interactions
  if (run('interactions')) {
    console.log('\ninteractions (1920×1080)');
    const { page, problems } = await open(browser, 'index.html', VIEWPORTS[0]);

    // 1 · A Golden Beginning
    check('welcome is the default screen', (await active(page)) === 'welcome');
    check('welcome: "Fifty Years. A Thousand Memories. One Beautiful Life." and the approved lines', await page.$eval('.scene[data-scene="welcome"]', (s) => {
      const t = s.textContent.replace(/\s+/g, ' ');
      return t.includes('Fifty Years. A Thousand Memories. One Beautiful Life.') && t.includes('Celebrating the Beautiful Journey of Buvaneswari')
        && t.includes('50 Years of Love, Strength & Beautiful Memories') && t.includes('27 October 1976 – 27 October 2026');
    }));
    check('welcome: one prominent "Begin the Celebration" button and no ordinary Next button', await page.evaluate(() => {
      const begin = document.querySelector('[data-welcome="begin"]');
      const r = begin.getBoundingClientRect();
      return begin.textContent.trim() === 'Begin the Celebration' && r.top > innerHeight * 0.66 && r.width > 300
        && getComputedStyle(document.querySelector('.deck-bar--nav')).display === 'none'
        && document.querySelectorAll('.scene[data-scene="welcome"] button').length === 1;
    }));
    check('welcome: the golden "50" emblem, not a collage of photographs', await page.evaluate(() => !!document.querySelector('.emblem__wreath ellipse') && !document.querySelector('.scene[data-scene="welcome"] img')));
    check('no gallery, loading screen, title card or birthday-film button', await page.evaluate(() => !document.querySelector('[data-scene="gallery"], .loader, #intro, .film-btn') && !/birthday film|photo gallery/i.test(document.body.textContent)));
    check('palette is blue (royal-blue background, ivory text), the welcome too', await page.evaluate(() => {
      const c = getComputedStyle(document.body);
      const sky = getComputedStyle(document.querySelector('.backdrop__sky')).backgroundImage;
      return c.backgroundColor === 'rgb(19, 58, 133)' && c.color === 'rgb(255, 250, 240)' && /rgb\(44, 102, 196\)/.test(sky) && /rgb\(12, 37, 96\)/.test(sky);
    }));
    await sleep(3800);
    check('a resting mouse hides only the pointer: the controls stay on screen', await page.evaluate(() => document.body.classList.contains('pointer-idle') && !document.body.classList.contains('controls-hidden') && getComputedStyle(document.querySelector('.deck-bar--tools')).opacity === '1'));
    check('music is not playing before Begin', await musicIs(page, 'off'));
    check('few, clear controls: Full screen on the left; Pause, Back, the page name and Next on the right', await page.evaluate(() => document.querySelectorAll('.deck-bar--tools button').length === 1 && !!document.querySelector('.deck-bar--tools .deck-fs') && document.querySelectorAll('.deck-bar--nav button').length === 4 && !document.querySelector('.deck-dots')));

    // Begin the Celebration → the birthday page, music and automatic playback
    await page.click('[data-welcome="begin"]');
    await sleep(1600);
    check('Begin the Celebration opens Happy 50th Birthday', (await active(page)) === 'reveal');
    check('…starts the music (after the click, as browsers require)', await musicIs(page, 'normal'));
    check('…and automatic playback', await autoOn(page));
    check('reveal reads HAPPY 50TH BIRTHDAY / AMMA / M. BUVANESWARI on three lines', await page.evaluate(() => {
      const [a, b, c] = ['.reveal__line1', '.reveal__line2', '.reveal__line3'].map((s) => document.querySelector(s));
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), rc = c.getBoundingClientRect();
      return /happy 50th birthday/i.test(a.textContent) && /amma/i.test(b.textContent) && /buvaneswari/i.test(c.textContent) && ra.bottom <= rb.top + 2 && rb.bottom <= rc.top + 2;
    }));
    check('reveal shows the replacement photograph (Age 1 to 50/46.1.jpg)', await page.$eval('.reveal__img', (img) => img.complete && img.naturalWidth > 0 && /age-46-1/.test(img.currentSrc)));
    await page.waitForFunction(() => window.__deck.current !== 'reveal', { timeout: 14000 }).catch(() => {});
    check('automatic playback moves on by itself', (await active(page)) === SCENE_ORDER[SCENE_ORDER.indexOf('reveal') + 1]);

    // The slideshows advance on their own, and pause / resume
    await page.evaluate(() => window.__deck.goTo('journey'));
    await sleep(600);
    const photoNow = () => page.$eval('.scene[data-scene="journey"] .tslide:last-child img', (i) => i.getAttribute('src')).catch(() => '');
    const first = await photoNow();
    await sleep(8300);
    check('A Journey Through Time moves to the next photograph by itself', (await photoNow()) !== first && (await active(page)) === 'journey');
    await page.mouse.move(800, 500);
    await sleep(700); // the controls glide back in
    await page.click('.deck-auto');
    await sleep(300);
    check('the pause button stops automatic playback', !(await autoOn(page)) && await page.$eval('.deck-auto', (b) => b.getAttribute('aria-pressed') === 'false'));
    const held = await photoNow();
    await sleep(8300);
    check('…and nothing moves while paused', (await photoNow()) === held);
    await press(page, 'a');
    check('A resumes it', await autoOn(page));
    await press(page, 'a');

    // Manual walk with Next: every scene and step, in order
    await page.evaluate(() => window.__deck.goTo('reveal'));
    await sleep(900);
    const walk = [];
    let lastWishHeld = null;
    for (let guard = 0; guard < 250; guard++) {
      walk.push(`${await active(page)}|${await sub(page)}`);
      if (await page.$eval('.deck-next', (b) => b.disabled)) break;
      if (lastWishHeld === null && /Message (\d+) of \1\b/.test(walk.at(-1)) && await theatreOpen(page)) {
        // the last family wish is playing: Next must not leave it; Back closes it, then Next moves on
        await page.$eval('.deck-next', (b) => b.click());
        await sleep(500);
        lastWishHeld = (await active(page)) === 'wishes' && (await playing(page)).join() === 'wishes';
        await escapeVideo(page);
        await sleep(400);
      }
      await page.$eval('.deck-next', (b) => b.click());
      await sleep(500);
    }
    if (playableWishes.length > 1) check('Next never leaves the family’s messages while the last one is still playing', lastWishHeld === true);
    const scenesSeen = [...new Set(walk.map((w) => w.split('|')[0]))];
    check('Next visits every scene in order', scenesSeen.join() === SCENE_ORDER.slice(1).join(), scenesSeen.join());
    check(`A Journey Through Time: one step per photograph (${slidesIn('journey')})`, walk.filter((w) => w.startsWith('journey|')).length === slidesIn('journey'));
    check(`Proud Moments: one step per photograph (${slidesIn('proud')})`, walk.filter((w) => w.startsWith('proud|')).length === slidesIn('proud'));
    check('the reasons step through their 5 groups (no "All 50" step)', walk.filter((w) => w.startsWith('reasons|')).length === 5);
    check('Next is disabled on the final scene', (await active(page)) === 'finale' && await page.$eval('.deck-next', (b) => b.disabled));
    let back = 0;
    while (!(await page.$eval('.deck-prev', (b) => b.disabled)) && back < 250) { await page.$eval('.deck-prev', (b) => b.click()); await sleep(480); back++; }
    check('Previous walks back to the welcome', (await active(page)) === 'welcome');
    check('automatic playback stayed off during the manual walk', !(await autoOn(page)));

    // Keyboard and clicker
    await press(page, 'ArrowRight');
    check('→ on the welcome begins the celebration', (await active(page)) === 'reveal' && await autoOn(page));
    await press(page, 'a');
    await press(page, 'ArrowLeft');
    check('← moves back', (await active(page)) === 'welcome');
    await press(page, 'PageDown');
    check('PageDown (presentation clicker) moves forward', (await active(page)) === 'reveal');
    await press(page, 'a');
    await press(page, 'End');
    check('End jumps to the final scene', (await active(page)) === 'finale');
    await press(page, 'Home');
    check('Home returns to the welcome', (await active(page)) === 'welcome');
    await press(page, '5');
    check(`number keys jump to a section (5 → ${SCENE_ORDER[4]})`, (await active(page)) === SCENE_ORDER[4]);
    check('keys never scroll the page', await page.evaluate(() => scrollY === 0 && document.querySelector('.deck').scrollTop === 0));
    await press(page, 'g');
    check('G opens the section list with every scene (no gallery)', await page.$$eval('.deck-menu:not([hidden]) li', (l) => l.length) === SCENE_ORDER.length);
    await page.$$eval('.deck-menu li button', (b, k) => b[k].click(), SCENE_ORDER.indexOf('memories'));
    await sleep(600);
    check('choosing a section in the list goes there', (await active(page)) === 'memories' && await page.$eval('.deck-menu', (m) => m.hidden));

    // 50 Reasons: five floating clouds of ten
    await page.evaluate(() => window.__deck.goTo('reasons'));
    await sleep(900);
    const reasons = json('data/reasons.json');
    check('five groups, and no separate "All 50 Reasons" tab', await page.$$eval('.rgroup', (b) => b.length) === 5 && !(await page.evaluate(() => [...document.querySelectorAll('button, [role="tab"]')].some((b) => /all 50/i.test(b.textContent)))));
    const shown = [];
    for (let c = 0; c < 5; c++) {
      await page.$$eval('.rgroup', (b, k) => b[k].click(), c);
      await sleep(4800);
      const texts = await page.$$eval('.rcloud .rbubble__text', (els) => els.map((e) => e.lastChild.textContent));
      const info = await page.$$eval('.rcloud .rbubble', (els) => {
        const rects = els.map((e) => e.getBoundingClientRect());
        let overlaps = 0;
        rects.forEach((a, i) => rects.slice(i + 1).forEach((b) => {
          const w = Math.min(a.right, b.right) - Math.max(a.left, b.left), h = Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top);
          if (w > 4 && h > 4) overlaps++;
        }));
        return { visible: els.filter((e) => getComputedStyle(e).opacity > 0.9).length, overlaps, font: Math.min(...els.map((e) => parseFloat(getComputedStyle(e.querySelector('.rbubble__text')).fontSize))) };
      });
      check(`group ${c + 1}: ten bubbles, none overlapping, readable from a distance (${Math.round(info.font)}px)`, texts.length === 10 && info.visible === 10 && !info.overlaps && info.font >= 26, JSON.stringify(info));
      shown.push(...texts);
      if (c === 0) await shot(page, 'reasons-cloud');
    }
    check('all 50 reasons appear exactly once, word for word', shown.length === 50 && shown.every((t, i) => t === reasons.reasons[i].text));

    // Our Memory Film: plays by itself on arrival (automatic presentation paused), full-screen theatre
    await page.evaluate(() => window.__deck.goTo('memories'));
    check('the memory film is the family’s own video', await page.$eval(video('memories'), (v) => /family-memories\.mp4$/.test(v.currentSrc || v.src)));
    check('one central Play control (no duplicate Play / Replay / Continue buttons)', await page.evaluate(() => {
      const s = document.querySelector('.scene[data-scene="memories"]');
      return s.querySelectorAll('.player__big-play').length === 1 && !s.querySelector('.cinema__play, .cinema__replay, .cinema__continue');
    }));
    await watchSilence(page);
    const arrived = Date.now();
    await sleep(1500);
    check('Our Memories opens on its introduction: the title, the poster and a golden countdown line', await page.evaluate(() => {
      const s = document.querySelector('.scene[data-scene="memories"]');
      return s.classList.contains('is-counting') && !!s.querySelector('.cinema__countdown.is-running') && /Our Memories/.test(s.querySelector('.cinema__title').textContent) && !document.body.classList.contains('is-theatre');
    }) && await page.$eval(video('memories'), (v) => v.paused));
    await sleep(FILM_INTRO_MS - 800 - (Date.now() - arrived));
    check('…and keeps it on screen for 10 seconds (the film has not started at 9 s)', await page.$eval(video('memories'), (v) => v.paused) && !(await theatreOpen(page)));
    check('a video page plays by itself after its introduction, even with the automatic presentation paused', !(await autoOn(page)) && await waitFor(page, (sel) => !document.querySelector(sel).paused, video('memories'), 4000));
    const startedAfter = (Date.now() - arrived) / 1000;
    check(`…10 seconds after arriving (${startedAfter.toFixed(1)} s)`, startedAfter >= 9.8 && startedAfter <= 12.5);
    check('the film loads (6 min 23 s)', await page.$eval(video('memories'), (v) => Math.round(v.duration) === 383));
    await sleep(600);
    check('it opens in full screen (theatre)', await page.evaluate(() => {
      const r = document.querySelector('.scene[data-scene="memories"] .cinema__screen-wrap').getBoundingClientRect();
      return document.body.classList.contains('is-theatre') && r.left === 0 && r.top === 0 && r.width === innerWidth && r.height === innerHeight;
    }));
    check('…the film plays and the presentation controls step aside', await page.$eval(video('memories'), (v) => !v.paused) && await page.evaluate(() => getComputedStyle(document.querySelector('.deck-bar--nav')).display === 'none'));
    const barTexts = await page.$$eval('.scene[data-scene="memories"] .theatre-bar .btn', (b) => b.map((x) => x.textContent.trim()).join());
    check('…with just Back, Full screen / Normal screen and Next at the bottom', THEATRE_BUTTONS.test(barTexts), barTexts);
    check('…and the background music goes soft (10–15 % of normal) but keeps playing', await musicSoft(page));
    check('…while the film\'s own sound stays at full volume', await page.$eval(video('memories'), (v) => v.volume === 1 && !v.muted));
    await page.keyboard.press('ArrowRight');
    await sleep(400);
    check('arrow keys inside the film do not change scene', (await active(page)) === 'memories');
    await press(page, 'Escape');
    if (await theatreOpen(page)) await press(page, 'Escape'); // the first Esc leaves full screen
    check('Escape leaves full screen, then closes the theatre and pauses the film, without resetting the presentation', !(await theatreOpen(page)) && await page.$eval(video('memories'), (v) => v.paused) && (await active(page)) === 'memories');
    check('the music returns to its normal volume when the film is closed (paused)', await musicNormal(page));
    await page.click('.scene[data-scene="memories"] .player__big-play');
    await sleep(900);
    check('Play carries on with the film in the theatre', await page.$eval(video('memories'), (v) => !v.paused) && await theatreOpen(page));
    check('…and the music goes soft again at once (10–15 %, still playing)', await musicSoft(page));
    await page.evaluate((sel) => { const v = document.querySelector(sel); v.currentTime = v.duration - 0.3; }, video('memories'));
    await page.waitForFunction((sel) => document.querySelector(sel).ended, { timeout: 15000 }, video('memories')).catch(() => {});
    await sleep(500);
    check('after the film: "Watch again" and "Continue"', await page.$eval('.scene[data-scene="memories"] .cinema__end', (e) => !e.hidden && /watch again/i.test(e.textContent) && /continue/i.test(e.textContent)));
    check('…and once the film has ended, the music is back to its normal volume', await musicNormal(page));
    await shot(page, 'memories-theatre-end');
    await page.$eval('.scene[data-scene="memories"] .cinema__end .btn--celebrate', (b) => b.click());
    await sleep(900);
    check('…Continue goes on to the family’s messages', (await active(page)) === 'wishes' && !(await page.evaluate(() => document.body.classList.contains('is-theatre'))));
    check('leaving a scene pauses its video', await page.$eval(video('memories'), (v) => v.paused));
    // the player bar's own Back and Next move between pages
    check('Messages Filled With Love opens on its introduction (no message playing yet)', await page.evaluate(() => document.querySelector('.scene[data-scene="wishes"]').classList.contains('is-counting') && /Messages Filled/.test(document.querySelector('#wishes-title').textContent)) && !(await playing(page)).length);
    check('…and the music is back to normal during the introduction (no video is playing)', await musicNormal(page));
    await waitFor(page, () => document.body.classList.contains('is-theatre'), null, WISHES_INTRO_MS + 3000); // the messages start by themselves
    await page.$$eval('.scene[data-scene="wishes"] .theatre-bar .btn', (b) => b.find((x) => x.textContent.trim() === 'Back').click());
    await sleep(700);
    check('the player’s Back button goes to the previous page (and stops the video)', (await active(page)) === 'memories' && !(await playing(page)).includes('wishes'));
    await waitFor(page, () => document.body.classList.contains('is-theatre'), null, FILM_INTRO_MS + 3000);
    await page.$$eval('.scene[data-scene="memories"] .theatre-bar .btn', (b) => b.find((x) => x.textContent.trim() === 'Next').click());
    await sleep(700);
    check('…and its Next button to the next page', (await active(page)) === 'wishes');

    // Messages Filled With Love
    if (!playableWishes.length) {
      check('Messages: the family’s line until their videos are added', await page.$eval('.scene[data-scene="wishes"] .vstage__missing-text', (e) => e.textContent) === wishesData.emptyMessage);
    } else {
      check(`Messages: ${playableWishes.length} confirmed wishes are ready, first one first`, await page.$eval(video('wishes'), (v, src) => decodeURI(v.currentSrc || v.src).split('?')[0].endsWith(src), playableWishes[0].src));
    }
    check('videos play the prepared web copies (never the VIDEOS/ originals or the removed Childhood film)', await page.evaluate(() => ![...document.querySelectorAll('video')].some((v) => /\/VIDEOS\//.test(v.src) || /childhood/i.test(v.src))));
    check('of the family\'s films, "Age 1 to 50 — Her Story" and "Her Life Journey" are in the presentation; the Real Journey video is not', FILM_SCENES.join() === 'story-film,journey-film' && await page.evaluate(() => { const ids = window.__deck.scenes.map((x) => x.id); return ids.includes('story-film') && ids.includes('journey-film') && !ids.includes('age-film') && !document.querySelector('[data-scene="age-film"]'); }));
    check('running order after Our Memory Film: 8 Messages Filled With Love, 9 Her Life Journey, 10 Happy Birthday, Amma, then A Final Gift of Love', await page.evaluate(() => window.__deck.scenes.map((x) => x.id).slice(6).join()) === 'memories,wishes,journey-film,cake,finale');
    const subOn = async (id) => { await page.evaluate((x) => window.__deck.goTo(x), id); await sleep(500); return sub(page); };
    const counts = [];
    for (const [id, want] of [['memories', '7 of 10'], ['wishes', '8 of 10'], ['journey-film', '9 of 10'], ['cake', '10 of 10'], ['finale', 'Final']]) counts.push([id, await subOn(id), want]);
    check('the steps are counted 7 … 10 of 10, and the closing page says "Final" (never "11 of 10")', counts.every(([, got, want]) => got.startsWith(want)) && !counts.some(([, got]) => /11 of/.test(got)), counts.map(([id, got]) => `${id}: ${got}`).join(' | '));
    check('…the closing page is titled "A Final Gift of Love"', await page.$eval('.deck-label__title', (t) => t.textContent) === 'A Final Gift of Love');
    check('Her Life Journey: its page title, with the LIFE JOURNEY-update video', await page.evaluate(() => { const s = document.querySelector('.scene[data-scene="journey-film"]'); return s.querySelector('.cinema__title').textContent.replace(/\s+/g, ' ').trim() === 'Her Life Journey' && /life-journey\.mp4/.test(s.querySelector('video').src); }));
    await page.evaluate(() => window.__deck.goTo('memories'));
    await sleep(400);
    check('page 3 reads "Age 1 to 50 — Her Story" (heading, page name and player)', await page.evaluate(() => {
      const s = document.querySelector('.scene[data-scene="story-film"]');
      const title = s.querySelector('.cinema__title').textContent.replace(/\s+/g, ' ').trim();
      return title === 'Age 1 to 50 — Her Story' && window.__deck.scenes[2].title === 'Age 1 to 50 — Her Story' && s.querySelector('video').getAttribute('aria-label') === 'Age 1 to 50 — Her Story' && !/Age 1 to 5\b(?! ?0)/.test(document.body.textContent) && !/Real Journey|Life Journey film/i.test(document.body.textContent);
    }));
    check('…playing the family\'s story film (from "age 1 to 5 story video.mp4")', await page.$eval(video('story-film'), (v) => /age-1-to-5-story\.mp4$/.test(v.currentSrc || v.src)));
    check('while a video played, the music stayed soft (never louder, never muted)', await page.evaluate(() => !window.__overlaps.length), await page.evaluate(() => window.__overlaps.slice(0, 4).join(', ')));

    // Music controls (on a page without a video, where the presentation bar is in view)
    await page.evaluate(() => window.__deck.goTo('reasons'));
    await page.mouse.move(500, 500);
    await sleep(700);
    await page.keyboard.press('m');
    await sleep(300);
    check('M pauses the music', await musicIs(page, 'off'));
    await page.keyboard.press('m');
    await sleep(300);
    check('…and M starts it again', await musicIs(page, 'normal'));

    // A Final Gift of Love
    await page.evaluate(() => window.__deck.goTo('finale'));
    await sleep(1100);
    check('the final page opens on a closed gift, alone in the middle of the screen, floating', await page.evaluate(() => {
      const s = document.querySelector('.scene[data-scene="finale"]');
      const r = s.querySelector('.fgift').getBoundingClientRect();
      return s.classList.contains('is-playing') && !s.classList.contains('is-open') && Math.abs(r.left + r.width / 2 - innerWidth / 2) < innerWidth * 0.04
        && getComputedStyle(s.querySelector('.finale__title')).opacity === '0' && !s.querySelector('.fgift img');
    }));
    await sleep(2300);
    check('the final page shows the family’s closing words, her name, the date and venue', await page.$eval('.scene[data-scene="finale"]', (s) => ['A Final Gift of Love', 'Happy 50th Birthday, Amma!', '50 Years of Beautiful Memories. A Lifetime of Love. Countless Reasons to Celebrate You.', 'We may never be able to give back everything you have given us', 'M. Buvaneswari', '27 October 2026', 'Palmshore Restaurant, Ekkatuthangal, Chennai'].every((t) => s.textContent.includes(t))));
    check('no numbered gift tiles', !(await page.$('.gtile, .gtracker')));
    check('the gift opens by itself: the lid lifts off and a golden light pours out', await page.$eval('.scene[data-scene="finale"]', (s) => s.classList.contains('is-open') && getComputedStyle(s.querySelector('.fgift__lid')).transform !== 'none' && Number(getComputedStyle(s.querySelector('.fgift__beam')).opacity) > 0.5));
    check('…and a golden 50 rises out of the box, with sparkles', await page.$eval('.scene[data-scene="finale"]', (s) => s.classList.contains('is-rising') && s.querySelector('.fgift__fifty text').textContent === '50' && getComputedStyle(s.querySelector('.fgift__sparks i')).animationName === 'gift-spark'));
    await sleep(3600);
    check('then the gift moves aside and the family\'s closing words appear', await page.$eval('.scene[data-scene="finale"]', (s) => s.classList.contains('is-revealed') && getComputedStyle(s.querySelector('.finale__message')).opacity === '1' && getComputedStyle(s.querySelector('.fgift__fifty')).opacity === '1'));
    await shot(page, 'finale-open');
    check('the final page offers Replay and Start Again', await page.$$eval('.finale__actions .btn', (b) => b[0].textContent.trim() === 'Replay' && b[1].textContent.trim() === 'Start Again'));
    await page.$$eval('.finale__actions .btn', (b) => b[0].click());
    await sleep(400);
    check('Replay closes the gift and opens it again', await page.$eval('.scene[data-scene="finale"]', (s) => !s.classList.contains('is-open') && !s.classList.contains('is-revealed')) && await waitFor(page, () => document.querySelector('.scene[data-scene="finale"]').classList.contains('is-revealed'), null, 7000));
    await page.$$eval('.finale__actions .btn', (b) => b[1].click());
    await sleep(900);
    check('"Start Again" returns to the welcome', (await active(page)) === 'welcome');

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'));
    check('a refresh always returns to the welcome', (await active(page)) === 'welcome');
    await page.keyboard.press('h');
    await sleep(700);
    check('H hides the controls by hand', await page.evaluate(() => document.body.classList.contains('controls-hidden')));
    await page.keyboard.press('h');
    await sleep(200);
    check('…and H shows them again', await page.evaluate(() => !document.body.classList.contains('controls-hidden')));
    await page.goto(`${BASE}/index.html#reasons`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'));
    check('index.html#reasons opens that scene once, then the hash is removed', (await active(page)) === 'reasons' && await page.evaluate(() => location.hash === ''));
    check('no console errors or broken files', !problems.length, problems.slice(0, 6).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- automatic presentation, end to end
  if (run('autoplay') && FILM_SCENES.length) {
    console.log('\nautomatic presentation: films, wishes, cake and gift (1920×1080)');
    const { page, problems } = await open(browser, 'index.html', VIEWPORTS[0]);
    const musicPlaying = () => musicIs(page, 'normal');
    const firstFilm = FILM_SCENES[0];
    const nextAfter = (id) => SCENE_ORDER[SCENE_ORDER.indexOf(id) + 1];

    await watchSilence(page);
    await page.click('[data-welcome="begin"]');
    await sleep(700);
    check('Begin asks for full screen (allowed: it follows a click)', await page.evaluate(() => !document.fullscreenEnabled || !!document.fullscreenElement));
    check('…and starts the background music', await waitFor(page, () => window.__music.audible, null, 3000));
    check(`after Happy 50th Birthday (about 5.5 s) the first film follows by itself: ${firstFilm}`, await waitFor(page, (id) => window.__deck.current === id, firstFilm, 9000));
    const filmArrived = Date.now();
    await sleep(5000);
    check('…its introduction stays on screen, with the music still playing', await page.$eval(video(firstFilm), (v) => v.paused) && !(await theatreOpen(page)) && await musicAudible(page));
    check('…the film starts by itself after 10 seconds, in the full-screen theatre', await waitFor(page, (sel) => !document.querySelector(sel).paused, video(firstFilm), FILM_INTRO_MS - 5000 + 3000) && (Date.now() - filmArrived) >= FILM_INTRO_MS - 300 && await theatreOpen(page));
    await sleep(400);
    check('…the presentation controls step aside and the background music goes soft (10–15 %)', await page.evaluate(() => getComputedStyle(document.querySelector('.deck-bar--nav')).display === 'none') && await musicSoft(page));
    check('…the player bar stays on screen (Back, Full screen, Next)', THEATRE_BUTTONS.test(await page.$$eval(`.scene[data-scene="${firstFilm}"] .theatre-bar .btn`, (b) => b.map((x) => x.textContent.trim()).join())) && await page.$eval(`.scene[data-scene="${firstFilm}"] .theatre-bar`, (b) => getComputedStyle(b).opacity === '1'));
    check('…the film keeps its own shape (nothing stretched or cropped)', await page.$eval(`.scene[data-scene="${firstFilm}"]`, (s) => {
      const v = s.querySelector('video'), r = s.querySelector('.cinema__screen').getBoundingClientRect();
      return getComputedStyle(v).objectFit === 'contain' && Math.abs(r.width / r.height - v.videoWidth / v.videoHeight) < 0.02;
    }));
    check('…one video at a time', (await playing(page)).join() === firstFilm);
    await seekToEnd(page, firstFilm);
    const after = nextAfter(firstFilm);
    check(`when it ends, the theatre closes and the presentation moves on to ${after}`, await waitFor(page, (id) => window.__deck.current === id, after, 8000) && !(await theatreOpen(page)));
    check('…the finished film is not left playing', !(await playing(page)).length);
    check('…and the music returns to its normal volume on the slideshow', await musicNormal(page));

    // the photo slideshows move faster
    if (after === 'journey') {
      const t0 = Date.now();
      const photo0 = await page.$eval('.scene[data-scene="journey"] .tslide:last-child', (s) => s.outerHTML);
      await waitFor(page, (html) => document.querySelector('.scene[data-scene="journey"] .tslide:last-child')?.outerHTML !== html, photo0, 8000);
      const took = Date.now() - t0;
      check(`slideshow: the next photograph after about 4.5 s (${(took / 1000).toFixed(1)} s)`, took >= 3000 && took <= 5600);
      check('…and it appears already loaded (never a blank frame)', await page.$eval('.scene[data-scene="journey"] .tslide:last-child', (s) => { const i = s.querySelector('img'); return !i || (i.complete && i.naturalWidth > 0); }));
    }

    // leaving a film: it stops; leaving during its introduction: it never starts later; coming back: one start only
    await page.evaluate(() => window.__deck.goTo('memories'));
    await waitFor(page, (sel) => !document.querySelector(sel).paused, video('memories'), FILM_INTRO_MS + 3000);
    await page.evaluate(() => window.__deck.goTo('reveal'));
    check('leaving a film pauses it (nothing plays out of sight)', await waitFor(page, () => ![...document.querySelectorAll('video')].some((v) => !v.paused), null, 2000) && !(await theatreOpen(page)));
    await page.evaluate(() => { window.__plays.length = 0; window.__deck.goTo('memories'); });
    await sleep(3000);
    await page.evaluate(() => window.__deck.goTo('reveal'));
    await sleep(800);
    await page.evaluate(() => window.__deck.goTo('memories'));
    await sleep(2000);
    await page.evaluate(() => window.__deck.setAuto(false));
    await page.evaluate(() => window.__deck.setAuto(true));
    await waitFor(page, (sel) => !document.querySelector(sel).paused, video('memories'), FILM_INTRO_MS + 3000);
    await sleep(2500);
    check('arriving, leaving and returning during the introduction, and pausing / resuming: the film starts once, never twice', await page.evaluate(() => window.__plays.join() === 'family-memories.mp4') && (await playing(page)).join() === 'memories', await page.evaluate(() => window.__plays.join()));
    await page.evaluate(() => window.__deck.goTo('reveal'));
    await sleep(2200);
    check('a film left during its introduction never starts in the background', !(await playing(page)).length);

    // the family's messages: one by one, then the cake and the final gift
    if (playableWishes.length) {
      await page.evaluate(() => window.__deck.goTo('wishes'));
      const wishSrc = (k) => playableWishes[k].src;
      const nowSrc = () => page.$eval(video('wishes'), (v) => decodeURI(v.currentSrc || v.src).split('?')[0]); // the path, without its ?v= fingerprint
      const wishesArrived = Date.now();
      await sleep(5000);
      check('Messages Filled With Love: the introduction stays about 7 seconds (no message yet at 5 s)', await page.$eval(video('wishes'), (v) => v.paused) && /Messages Filled/.test(await page.$eval('#wishes-title', (t) => t.textContent)));
      check('the family’s messages start by themselves, the first one first', await waitFor(page, (sel) => !document.querySelector(sel).paused, video('wishes'), WISHES_INTRO_MS) && (await nowSrc()).endsWith(wishSrc(0)));
      const wishesAfter = (Date.now() - wishesArrived) / 1000;
      check(`…after about 7 seconds (${wishesAfter.toFixed(1)} s)`, wishesAfter >= 6.8 && wishesAfter <= 9.5);
      if (playableWishes.length > 1) {
        await seekToEnd(page, 'wishes');
        check('…then, after a short "up next" card, the next message plays by itself', await waitFor(page, (src) => { const v = document.querySelector('.scene[data-scene="wishes"] video'); return decodeURI(v.currentSrc || v.src).split('?')[0].endsWith(src) && !v.paused; }, wishSrc(1), 9000));
        check('…one video at a time, and the music stays soft between them', (await playing(page)).join() === 'wishes' && await musicSoft(page));
        const idx = (file) => playableWishes.findIndex((v) => (v.file || '').endsWith(file));
        // wish 8 → wish 9 straight on (Life Journey is not among the messages any more)
        for (let k = 2; k <= idx('/8.mp4'); k++) await press(page, 'PageDown'); // from message 2 (index 1) to wish 8
        check('a clicker moves through the messages to wish 8 (8.mp4)', (await nowSrc()).endsWith(wishSrc(idx('/8.mp4'))));
        await page.evaluate(() => { window.__plays.length = 0; });
        await seekToEnd(page, 'wishes');
        check('when wish 8 ends, wish 9 (9.mp4) follows by itself — no film in between', await waitFor(page, (src) => { const v = document.querySelector('.scene[data-scene="wishes"] video'); return decodeURI(v.currentSrc || v.src).split('?')[0].endsWith(src) && !v.paused && v.currentTime > 0.3; }, wishSrc(idx('/9.mp4')), 9000) && idx('/9.mp4') === idx('/8.mp4') + 1 && await page.evaluate(() => window.__plays.join()) === '09-wish.mp4' && /Message 9 of 33/.test(await sub(page)));
        for (let k = idx('/9.mp4') + 1; k < playableWishes.length - 1; k++) await press(page, 'PageDown'); // a clicker moves between the messages
        if (playableWishes.length > 2) {
          // the last two messages: the second-to-last plays to its end, then the last one follows by itself
          const [penult, last] = playableWishes.slice(-2).map((v) => v.file.split('/').pop());
          check(`the second-to-last message is the family's ${penult}, playing, with the music soft`, (await nowSrc()).endsWith(wishSrc(playableWishes.length - 2)) && (await playing(page)).join() === 'wishes' && await musicSoft(page));
          await seekToEnd(page, 'wishes');
          check(`…when it ends, the last message (${last}) follows by itself, one at a time, the music still soft`, await waitFor(page, (src) => { const v = document.querySelector('.scene[data-scene="wishes"] video'); return decodeURI(v.currentSrc || v.src).split('?')[0].endsWith(src) && !v.paused && v.currentTime > 0.5; }, wishSrc(playableWishes.length - 1), 9000) && (await playing(page)).join() === 'wishes' && await musicSoft(page));
        }
        const messageCount = playableWishes.filter((v) => v.kind !== 'film').length;
        check(`a clicker moves through every message in the family’s order, to the last (${messageCount} messages)`, (await nowSrc()).endsWith(wishSrc(playableWishes.length - 1)) && new RegExp(`Message ${messageCount} of ${messageCount}`).test(await sub(page)));
        await press(page, 'PageDown');
        check('…and never past a message that is still playing', (await active(page)) === 'wishes' && (await playing(page)).join() === 'wishes');
      }
      await seekToEnd(page, 'wishes');
      for (const film of ['age-film', 'journey-film'].filter(has)) {
        check(`after the last message, ${film} follows and plays by itself`, await waitFor(page, (id) => window.__deck.current === id, film, 8000) && await waitFor(page, (sel) => !document.querySelector(sel).paused, video(film), 10000));
        check('…one video at a time', (await playing(page)).join() === film);
        if (film === 'journey-film') {
          check('…"Her Life Journey", step 9 of 10 — not "Message 34 of 34" — with the music soft', /^9 of 10/.test(await sub(page)) && !/Message/.test(await sub(page) + await page.$eval('.scene[data-scene="journey-film"] .theatre-bar__label', (l) => l.textContent)) && /Her Life Journey/.test(await page.$eval('.scene[data-scene="journey-film"] .theatre-bar__label', (l) => l.textContent)) && await musicSoft(page));
          check('…from its LIFE JOURNEY-update copy', await page.$eval(video(film), (v) => /\/life-journey\.mp4/.test(decodeURI(v.currentSrc))));
        }
        await seekToEnd(page, film);
      }
      check('then the presentation goes on to step 10, "Happy Birthday, Amma"', await waitFor(page, () => window.__deck.current === 'cake', null, 8000) && /^10 of 10/.test(await sub(page)));
      check('…no video is left playing, and the music is back to its normal volume', await musicNormal(page, 4000) && !(await playing(page)).length);
      await sleep(2200);
      check('the cake: its message, five lit candles, no gift tracker', await page.$eval('.scene[data-scene="cake"]', (s, h) => s.classList.contains('is-lit') && s.textContent.includes(h) && s.querySelectorAll('.cake__flame').length === 5 && !s.querySelector('.gtile, .gtracker'), site.cake.headline));
      await shot(page, 'cake');
      check('after the cake, the final gift', await waitFor(page, () => window.__deck.current === 'finale', null, site.cake.holdSeconds * 1000 + 3000));
      check('…where the automatic presentation ends (nothing starts over by itself), and the page says "Final", not "11 of 10"', !(await autoOn(page)) && (await sub(page)) === 'Final');
      await sleep(3000);
      check('…and stays on the final page', (await active(page)) === 'finale');
    }
    check('while a film or a message played, and between messages, the music stayed soft (never louder, never muted)', await page.evaluate(() => !window.__overlaps.length), await page.evaluate(() => window.__overlaps.slice(0, 4).join(', ')));
    check('only one music track ever (no second <audio>)', await page.evaluate(() => document.querySelectorAll('audio').length === 0 && performance.getEntriesByType('resource').filter((r) => /music\.mp3/.test(r.name)).length <= 2));
    check('no console errors or broken files', !problems.length, problems.slice(0, 6).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- the browser holds a film back
  if (run('blocked') && FILM_SCENES.length) {
    console.log('\nwhen the browser blocks automatic playback');
    // Simulate a strict browser: video.play() more than a second after the last real click or key press is refused
    // (headless Chrome's own userActivation never expires, so it can't be used for this)
    const { page, problems } = await open(browser, 'index.html', VIEWPORTS[2], {
      init: () => {
        let gesture = -Infinity;
        ['pointerdown', 'keydown'].forEach((t) => addEventListener(t, (e) => { if (e.isTrusted) gesture = performance.now(); }, true));
        const real = HTMLMediaElement.prototype.play;
        HTMLMediaElement.prototype.play = function play() {
          if (this instanceof HTMLVideoElement && performance.now() - gesture > 1000) return Promise.reject(new DOMException('blocked for the test', 'NotAllowedError'));
          return real.call(this);
        };
      },
    });
    const film = FILM_SCENES[0];
    await page.click('[data-welcome="begin"]');
    await waitFor(page, (id) => window.__deck.current === id, film, 9000);
    await sleep(FILM_INTRO_MS + 2200);
    check('the film does not pretend to play: a clear "Press Play" note, no theatre', await page.$eval(`.scene[data-scene="${film}"] .cinema__prompt`, (p) => !p.hidden && getComputedStyle(p).display !== 'none') && !(await theatreOpen(page)) && !(await playing(page)).length);
    check('…the presentation waits on the film (it is not skipped)', (await active(page)) === film && await autoOn(page));
    check('…and the music carries on at its normal volume meanwhile', await musicNormal(page));
    await page.click(`.scene[data-scene="${film}"] .player__big-play`);
    check('pressing Play starts it in the theatre', await waitFor(page, (sel) => !document.querySelector(sel).paused, video(film), 6000) && await theatreOpen(page));
    check('no console errors', !problems.length, problems.slice(0, 6).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- the family's messages really play
  if (run('playback') && playableWishes.length > 4) {
    console.log('\nfamily messages: the first, fifth and last really play (1920×1080)');
    const { page, problems } = await open(browser, 'index.html', VIEWPORTS[0]);
    await page.mouse.click(30, 30); // a click on the page: browsers then allow sound
    const messages = playableWishes.filter((v) => v.kind !== 'film');
    const nowSrc = () => page.$eval(video('wishes'), (v) => decodeURI(v.currentSrc || v.src));
    const playsNow = (src) => waitFor(page, (s) => { const v = document.querySelector('.scene[data-scene="wishes"] video'); return decodeURI(v.currentSrc || v.src).includes(s) && !v.paused && v.currentTime > 0.5 && !v.error; }, src, 15000);
    await page.evaluate(() => window.__deck.goTo('wishes'));
    await waitFor(page, () => document.body.classList.contains('is-theatre'), null, WISHES_INTRO_MS + 5000);
    const indexNow = async () => { const now = await nowSrc(); return playableWishes.findIndex((v) => now.includes(`${v.src}?`)); };
    for (const [k, label] of [[0, 'first'], [playableWishes.indexOf(messages[4]), 'fifth'], [playableWishes.length - 1, 'last']]) {
      for (let guard = 0; guard < 60 && (await indexNow()) < k; guard++) await press(page, 'PageDown'); // a clicker, message by message
      const v = playableWishes[k];
      check(`the ${label} message (${v.file.split('/').pop()}) plays, from its fingerprinted URL`, await playsNow(v.src) && (await nowSrc()).includes(`?v=${v.rev}`));
      const n = messages.indexOf(v) + 1;
      check(`…and the screen says "Message ${n} of ${messages.length}"`, new RegExp(`Message ${n} of ${messages.length}\\b`).test(await sub(page)));
    }
    check('no console errors or broken files', !problems.length, problems.slice(0, 6).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- a video that will not play
  if (run('failures') && playableWishes.length > 6) {
    console.log('\nwhen a video cannot be played (simulated: a damaged cached copy, a broken file, a download that hangs)');
    const page = await browser.newPage();
    await page.setViewport(VIEWPORTS[2]);
    const logs = [];
    page.on('console', (m) => logs.push(m.text()));
    const W = playableWishes.map((v) => v.src.split('/').pop());
    const [damaged, broken, brokenAuto, hanging] = [W[0], W[1], W[3], W[5]];
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      const u = decodeURI(req.url());
      const file = u.split('?')[0].split('/').pop();
      if (req.method() !== 'GET' || !u.includes('/assets/videos/')) return req.continue();
      if (file === damaged && !u.includes('retry=')) return req.respond({ status: 500, body: 'damaged' }); // only the first copy is bad
      if (file === broken || file === brokenAuto) return req.respond({ status: 404, body: 'missing' });       // bad every time
      if (file === hanging) return;                                                                          // never answers
      return req.continue();
    });
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2', timeout: 60000 });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'));
    await page.mouse.click(30, 30);
    const nowFile = () => page.$eval(video('wishes'), (v) => decodeURI(v.currentSrc || v.src).split('?')[0].split('/').pop());
    const errorShown = () => page.$eval('.scene[data-scene="wishes"] .player', (p) => p.classList.contains('has-error') && !p.querySelector('.player__error').hidden && (getComputedStyle(p.querySelector('.player__spinner')).display === 'none' || getComputedStyle(p.querySelector('.player__spinner')).opacity === '0'));
    const errorButtons = () => page.$$eval('.scene[data-scene="wishes"] .player__error .btn', (b) => b.map((x) => x.textContent.trim()).join());
    const playing1 = (file) => waitFor(page, (f) => { const v = document.querySelector('.scene[data-scene="wishes"] video'); return decodeURI(v.currentSrc || v.src).split('?')[0].endsWith(`/${f}`) && !v.paused && v.currentTime > 0.3; }, file, 15000);

    await page.evaluate(() => window.__deck.goTo('wishes'));
    check(`a damaged cached copy (${damaged}) is fetched again from a fresh URL by itself, and plays`, await waitFor(page, () => document.body.classList.contains('is-theatre'), null, WISHES_INTRO_MS + 5000) && await playing1(damaged) && await page.$eval(video('wishes'), (v) => v.currentSrc.includes('retry=')));
    check('…and the console names the file and what went wrong', logs.some((l) => l.includes(damaged.replace(/[.]mp4$/, '')) && /trying once more|loading it again/.test(l)));

    await press(page, 'PageDown');
    await waitFor(page, () => document.querySelector('.scene[data-scene="wishes"] .player.has-error'), null, 10000);
    check(`a file that cannot be played (${broken}): after one fresh try, "could not be played" with Retry and Skip — no endless spinner`, await errorShown() && (await errorButtons()) === 'Retry,Skip' && /could not be played/.test(await page.$eval('.scene[data-scene="wishes"] .player__error', (e) => e.textContent)));
    check('…the console shows the exact URL and the media error', logs.some((l) => /\[player\] could not play .*\/assets\/videos\/wishes\//.test(l) && l.includes(broken.replace(/\.mp4$/, '')) && /MEDIA_ERR_\w+|PLAY_FAILED|NotSupportedError/.test(l)), logs.filter((l) => l.includes(broken)).slice(-2).join(' | '));
    await sleep(6000);
    check('…and it is not skipped by itself (the presentation is paused: it waits for the host)', (await nowFile()) === broken && await errorShown());
    await page.click('.scene[data-scene="wishes"] .player__error .btn--celebrate'); // Retry
    await sleep(2500);
    check('Retry tries again (and, still broken, says so again)', await errorShown() && logs.filter((l) => l.includes('[player] could not play') && l.includes(broken.replace(/\.mp4$/, ''))).length >= 3);
    await page.$$eval('.scene[data-scene="wishes"] .player__error .btn', (b) => b.find((x) => x.textContent.trim() === 'Skip').click());
    check(`Skip moves on to the next message (${W[2]}), which plays`, await playing1(W[2]));

    await page.evaluate(() => window.__deck.setAuto(true));
    await press(page, 'PageDown');
    await waitFor(page, () => document.querySelector('.scene[data-scene="wishes"] .player.has-error'), null, 10000);
    check(`in the automatic presentation, a broken file (${brokenAuto}) says when the presentation moves on`, await errorShown() && /follows in 15 seconds/.test(await page.$eval('.scene[data-scene="wishes"] .player__error-hint', (e) => e.textContent)));
    check(`…and after that notice, the next message (${W[4]}) plays`, await waitFor(page, (f) => { const v = document.querySelector('.scene[data-scene="wishes"] video'); return decodeURI(v.currentSrc || v.src).split('?')[0].endsWith(`/${f}`) && !v.paused; }, W[4], 22000));

    await press(page, 'PageDown');
    check(`a download that never arrives (${hanging}): no endless spinner — "taking too long to load", with Retry and Skip`, await waitFor(page, () => { const p = document.querySelector('.scene[data-scene="wishes"] .player'); return p.classList.contains('has-error') && /taking too long/.test(p.textContent); }, null, 50000) && await errorShown() && (await errorButtons()) === 'Retry,Skip');
    check('…the console says it stalled, with the URL', logs.some((l) => /\[player\] stalled loading .*\/assets\/videos\/wishes\//.test(l)));
    await page.close();
  }

  // ---------------------------------------------------------------- reduced motion
  if (run('reduced')) {
    console.log('\nreduced motion');
    const { page, problems } = await open(browser, 'index.html', VIEWPORTS[2], { reduced: true });
    for (let i = 0; i < SCENE_ORDER.length; i++) { await page.evaluate((k) => window.__deck.go(k), i); await sleep(300); }
    check('every scene shows its content with reduced motion', await page.$$eval('.scene.is-active [data-enter]', (els) => els.every((e) => getComputedStyle(e).opacity === '1')));
    check('no errors with reduced motion', !problems.length, problems.slice(0, 5).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- short links
  if (run('pages')) {
    console.log('\nshort links (pages/)');
    for (const [file, scene] of [['reasons.html', 'reasons'], ['memories.html', 'memories'], ['cake.html', 'cake'], ['finale.html', 'finale'], ['story.html', 'story-film'], ['age-transition.html', 'story-film'], ['life-journey.html', 'journey-film']]) {
      const { page } = await open(browser, `pages/${file}`, VIEWPORTS[3]);
      check(`pages/${file} opens the presentation at "${scene}"`, (await active(page)) === scene);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (!FILM_SCENES.includes('story-film')) console.log('\nNote: the Her Story film is not prepared yet (npm run build:films).');
if (!(wishesData.videos || []).length) console.log('Note: still waiting for the "Family video wishes" folder (the Messages page shows the family\'s line until then).');
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
