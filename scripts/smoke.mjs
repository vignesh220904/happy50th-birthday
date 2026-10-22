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
// The family's three films (each joins the presentation once its web copy exists, npm run build:films)
const FILM_SCENES = [['story-film', 'storyFilm'], ['age-film', 'ageFilm'], ['journey-film', 'lifeJourney']]
  .filter(([, key]) => site.videos[key]?.src && exists(site.videos[key].src)).map(([id]) => id);
const SCENE_ORDER = ['welcome', 'reveal', ...FILM_SCENES, 'journey', 'proud', 'reasons', 'memories', 'wishes', 'cake', 'finale'];
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
    check('palette is light (warm ivory background, dark-blue text)', await page.evaluate(() => {
      const c = getComputedStyle(document.body);
      return c.backgroundColor === 'rgb(255, 250, 242)' && c.color === 'rgb(23, 54, 93)';
    }));
    await sleep(3800);
    check('controls are out of sight on the idle welcome screen', await page.evaluate(() => document.body.classList.contains('controls-hidden')));
    check('music is not playing before Begin', await page.$eval('.music-btn', (b) => !b.disabled && b.getAttribute('aria-pressed') === 'false'));

    // Begin the Celebration → the birthday page, music and automatic playback
    await page.click('[data-welcome="begin"]');
    await sleep(1600);
    check('Begin the Celebration opens Happy 50th Birthday', (await active(page)) === 'reveal');
    check('…starts the music (after the click, as browsers require)', await page.$eval('.music-btn', (b) => b.getAttribute('aria-pressed') === 'true'));
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
        await page.$eval('.scene[data-scene="wishes"] .theatre-bar .btn', (b) => b.click());
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

    // Our Memory Film: one central Play, full-screen theatre, Back, Replay
    await page.evaluate(() => window.__deck.goTo('memories'));
    await sleep(1500);
    check('the memory film is the family’s own video', await page.$eval(video('memories'), (v) => /family-memories\.mp4$/.test(v.currentSrc || v.src)));
    await page.waitForFunction((sel) => document.querySelector(sel).readyState >= 1, { timeout: 30000 }, video('memories')).catch(() => {});
    check('the film loads (6 min 23 s)', await page.$eval(video('memories'), (v) => Math.round(v.duration) === 383));
    check('one central Play control (no duplicate Play / Replay / Continue buttons)', await page.evaluate(() => {
      const s = document.querySelector('.scene[data-scene="memories"]');
      return s.querySelectorAll('.player__big-play').length === 1 && !s.querySelector('.cinema__play, .cinema__replay, .cinema__continue');
    }));
    await page.click('.scene[data-scene="memories"] .player__big-play');
    await sleep(1400);
    check('Play opens the film in full screen (theatre)', await page.evaluate(() => {
      const r = document.querySelector('.scene[data-scene="memories"] .cinema__screen-wrap').getBoundingClientRect();
      return document.body.classList.contains('is-theatre') && r.left === 0 && r.top === 0 && r.width === innerWidth && r.height === innerHeight;
    }));
    check('…the film plays and the presentation controls step aside', await page.$eval(video('memories'), (v) => !v.paused) && await page.evaluate(() => getComputedStyle(document.querySelector('.deck-bar--nav')).display === 'none'));
    check('…with Back and Replay at the bottom', await page.$$eval('.scene[data-scene="memories"] .theatre-bar .btn', (b) => b.map((x) => x.textContent.trim()).join() === 'Back,Replay'));
    check('…and a Full screen / Exit full screen button', await page.evaluate(() => !document.fullscreenEnabled || !!document.querySelector('.scene[data-scene="memories"] .theatre-bar__fs[aria-label]')));
    check('…and the music steps aside', await page.$eval('.music-btn', (b) => !b.classList.contains('is-playing')));
    await page.keyboard.press('ArrowRight');
    await sleep(400);
    check('arrow keys inside the film do not change scene', (await active(page)) === 'memories');
    await press(page, 'Escape');
    if (await theatreOpen(page)) await press(page, 'Escape'); // the first Esc leaves full screen
    check('Escape leaves full screen, then closes the theatre and pauses the film, without resetting the presentation', !(await theatreOpen(page)) && await page.$eval(video('memories'), (v) => v.paused) && (await active(page)) === 'memories');
    await page.click('.scene[data-scene="memories"] .player__big-play');
    await sleep(900);
    await page.$$eval('.scene[data-scene="memories"] .theatre-bar .btn', (b) => b.find((x) => x.textContent.trim() === 'Replay').click());
    await sleep(600);
    check('Replay starts the film again', await page.$eval(video('memories'), (v) => v.currentTime < 2 && !v.paused));
    await page.evaluate((sel) => { const v = document.querySelector(sel); v.currentTime = v.duration - 0.3; }, video('memories'));
    await page.waitForFunction((sel) => document.querySelector(sel).ended, { timeout: 15000 }, video('memories')).catch(() => {});
    await sleep(500);
    check('after the film: "Watch again" and "Continue"', await page.$eval('.scene[data-scene="memories"] .cinema__end', (e) => !e.hidden && /watch again/i.test(e.textContent) && /continue/i.test(e.textContent)));
    await shot(page, 'memories-theatre-end');
    await page.$eval('.scene[data-scene="memories"] .cinema__end .btn--celebrate', (b) => b.click());
    await sleep(900);
    check('…Continue goes on to the family’s messages', (await active(page)) === 'wishes' && !(await page.evaluate(() => document.body.classList.contains('is-theatre'))));
    check('leaving a scene pauses its video', await page.$eval(video('memories'), (v) => v.paused));
    check('the music returns after the film', await page.$eval('.music-btn', (b) => b.classList.contains('is-playing')));

    // Messages Filled With Love
    if (!playableWishes.length) {
      check('Messages: the family’s line until their videos are added', await page.$eval('.scene[data-scene="wishes"] .vstage__missing-text', (e) => e.textContent) === wishesData.emptyMessage);
    } else {
      check(`Messages: ${playableWishes.length} confirmed wishes are ready, first one first`, await page.$eval(video('wishes'), (v, src) => decodeURI(v.currentSrc || v.src).endsWith(src), playableWishes[0].src));
    }
    check('videos play the prepared web copies (never the VIDEOS/ originals or the removed Childhood film)', await page.evaluate(() => ![...document.querySelectorAll('video')].some((v) => /\/VIDEOS\//.test(v.src) || /childhood/i.test(v.src))));
    check(`the family’s three films are in the presentation (${FILM_SCENES.length} of 3 prepared)`, FILM_SCENES.length === 3, 'run npm run build:films');

    // Music controls
    await page.mouse.move(500, 500);
    await sleep(700);
    await page.click('.deck-bar--tools .icon-btn:nth-child(2)');
    await sleep(300);
    check('the mute button mutes the music', await page.$eval('.deck-bar--tools .icon-btn:nth-child(2)', (b) => b.getAttribute('aria-pressed') === 'true'));
    await page.click('.deck-bar--tools .icon-btn:nth-child(2)');
    await page.keyboard.press('m');
    await sleep(300);
    check('M pauses the music', await page.$eval('.music-btn', (b) => b.getAttribute('aria-pressed') === 'false'));

    // A Final Gift of Love
    await page.evaluate(() => window.__deck.goTo('finale'));
    await sleep(3400);
    check('the final page shows the family’s closing words, her name, the date and venue', await page.$eval('.scene[data-scene="finale"]', (s) => ['A Final Gift of Love', 'Happy 50th Birthday, Amma!', '50 Years of Beautiful Memories. A Lifetime of Love. Countless Reasons to Celebrate You.', 'We may never be able to give back everything you have given us', 'M. Buvaneswari', '27 October 2026', 'Palmshore Restaurant, Ekkatuthangal, Chennai'].every((t) => s.textContent.includes(t))));
    check('no numbered gift tiles', !(await page.$('.gtile, .gtracker')));
    check('the gift opens by itself', await page.$eval('.scene[data-scene="finale"]', (s) => s.classList.contains('is-open')));
    await shot(page, 'finale-open');
    check('the final page offers Start Again', await page.$$eval('.finale__actions .btn', (b) => b[1].textContent.trim() === 'Start Again'));
    await page.$$eval('.finale__actions .btn', (b) => b[1].click());
    await sleep(900);
    check('"Start Again" returns to the welcome', (await active(page)) === 'welcome');

    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'));
    check('a refresh always returns to the welcome', (await active(page)) === 'welcome');
    await sleep(4300);
    check('controls hide when the mouse rests', await page.evaluate(() => document.body.classList.contains('controls-hidden')));
    await page.mouse.move(400, 400);
    await sleep(200);
    check('…and return on mouse movement', await page.evaluate(() => !document.body.classList.contains('controls-hidden')));
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
    const musicPlaying = () => page.$eval('.music-btn', (b) => b.classList.contains('is-playing'));
    const [firstFilm, secondFilm] = FILM_SCENES;

    await page.click('[data-welcome="begin"]');
    await sleep(700);
    check('Begin asks for full screen (allowed: it follows a click)', await page.evaluate(() => !document.fullscreenEnabled || !!document.fullscreenElement));
    check(`after Happy 50th Birthday (about 5.5 s) the first film follows by itself: ${firstFilm}`, await waitFor(page, (id) => window.__deck.current === id, firstFilm, 9000));
    check('…and starts playing by itself in the full-screen theatre', await waitFor(page, (sel) => !document.querySelector(sel).paused, video(firstFilm), 8000) && await theatreOpen(page));
    await sleep(1200); // the music fades out over about a second
    check('…the presentation controls step aside and the music fades out (no audio on top of the film)', await page.evaluate(() => getComputedStyle(document.querySelector('.deck-bar--nav')).display === 'none') && !(await musicPlaying()) && await page.$eval('.music-btn', (b) => b.getAttribute('aria-pressed') === 'true'));
    check('…the film keeps its own shape (nothing stretched or cropped)', await page.$eval(`.scene[data-scene="${firstFilm}"]`, (s) => {
      const v = s.querySelector('video'), r = s.querySelector('.cinema__screen').getBoundingClientRect();
      return getComputedStyle(v).objectFit === 'contain' && Math.abs(r.width / r.height - v.videoWidth / v.videoHeight) < 0.02;
    }));
    check('…one video at a time', (await playing(page)).join() === firstFilm);
    await seekToEnd(page, firstFilm);
    if (secondFilm) {
      check(`when it ends, the theatre closes and the presentation moves on to ${secondFilm}`, await waitFor(page, (id) => window.__deck.current === id, secondFilm, 8000));
      check('…the finished film is not left playing', !(await playing(page)).includes(firstFilm));
      check(`…and ${secondFilm} starts by itself`, await waitFor(page, (sel) => !document.querySelector(sel).paused, video(secondFilm), 8000));
      await page.evaluate(() => window.__deck.goTo('reveal'));
      check('leaving a film pauses it (nothing plays out of sight)', await waitFor(page, () => ![...document.querySelectorAll('video')].some((v) => !v.paused), null, 2000) && !(await theatreOpen(page)));
      // leave a film during its short title countdown: it must not start later in the background
      await page.evaluate((id) => window.__deck.goTo(id), secondFilm);
      await sleep(600);
      await page.evaluate(() => window.__deck.goTo('reveal'));
      await sleep(2600);
      check('a film left during its countdown never starts in the background', !(await playing(page)).length);
    }

    // the photo slideshows move faster
    await page.evaluate(() => window.__deck.goTo('journey'));
    const t0 = Date.now();
    const photo0 = await page.$eval('.scene[data-scene="journey"] .tslide:last-child', (s) => s.outerHTML);
    await waitFor(page, (html) => document.querySelector('.scene[data-scene="journey"] .tslide:last-child')?.outerHTML !== html, photo0, 8000);
    const took = Date.now() - t0;
    check(`slideshow: the next photograph after about 4.5 s (${(took / 1000).toFixed(1)} s)`, took >= 3500 && took <= 5600);

    // the family's messages: one by one, then the cake and the final gift
    if (playableWishes.length) {
      await page.evaluate(() => window.__deck.goTo('wishes'));
      const wishSrc = (k) => playableWishes[k].src;
      const nowSrc = () => page.$eval(video('wishes'), (v) => decodeURI(v.currentSrc || v.src));
      check('the family’s messages start by themselves, the first one first', await waitFor(page, (sel) => !document.querySelector(sel).paused, video('wishes'), 8000) && (await nowSrc()).endsWith(wishSrc(0)));
      if (playableWishes.length > 1) {
        await seekToEnd(page, 'wishes');
        check('…then, after a short "up next" card, the next message plays by itself', await waitFor(page, (src) => { const v = document.querySelector('.scene[data-scene="wishes"] video'); return decodeURI(v.currentSrc || v.src).endsWith(src) && !v.paused; }, wishSrc(1), 9000));
        check('…one video at a time, and the music stays down between them', (await playing(page)).join() === 'wishes' && !(await musicPlaying()));
        for (let k = 2; k < playableWishes.length; k++) await press(page, 'PageDown'); // a clicker moves between the messages
        check(`a clicker moves through every message in the family’s order, to the last (${playableWishes.length})`, (await nowSrc()).endsWith(wishSrc(playableWishes.length - 1)) && new RegExp(`Message ${playableWishes.length} of ${playableWishes.length}`).test(await sub(page)));
        await press(page, 'PageDown');
        check('…and never past a message that is still playing', (await active(page)) === 'wishes' && (await playing(page)).join() === 'wishes');
      }
      await seekToEnd(page, 'wishes');
      check('after the last message, the presentation goes on to the cake', await waitFor(page, () => window.__deck.current === 'cake', null, 8000));
      check('…no video is left playing, and the music comes back', await waitFor(page, () => document.querySelector('.music-btn').classList.contains('is-playing'), null, 4000) && !(await playing(page)).length);
      await sleep(2200);
      check('the cake: its message, five lit candles, no gift tracker', await page.$eval('.scene[data-scene="cake"]', (s, h) => s.classList.contains('is-lit') && s.textContent.includes(h) && s.querySelectorAll('.cake__flame').length === 5 && !s.querySelector('.gtile, .gtracker'), site.cake.headline));
      await shot(page, 'cake');
      check('after the cake, the final gift', await waitFor(page, () => window.__deck.current === 'finale', null, site.cake.holdSeconds * 1000 + 3000));
      check('…where the automatic presentation ends (nothing starts over by itself)', !(await autoOn(page)));
      await sleep(3000);
      check('…and stays on the final page', (await active(page)) === 'finale');
    }
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
    await sleep(3200);
    check('the film does not pretend to play: a clear "Press Play" note, no theatre', await page.$eval(`.scene[data-scene="${film}"] .cinema__prompt`, (p) => !p.hidden && getComputedStyle(p).display !== 'none') && !(await theatreOpen(page)) && !(await playing(page)).length);
    check('…the presentation waits on the film (it is not skipped)', (await active(page)) === film && await autoOn(page));
    check('…and the music carries on meanwhile', await page.$eval('.music-btn', (b) => b.classList.contains('is-playing')));
    await page.click(`.scene[data-scene="${film}"] .player__big-play`);
    check('pressing Play starts it in the theatre', await waitFor(page, (sel) => !document.querySelector(sel).paused, video(film), 6000) && await theatreOpen(page));
    check('no console errors', !problems.length, problems.slice(0, 6).join('\n      '));
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
    for (const [file, scene] of [['reasons.html', 'reasons'], ['memories.html', 'memories'], ['cake.html', 'cake'], ['finale.html', 'finale'], ['story.html', 'story-film'], ['age-transition.html', 'age-film']]) {
      const { page } = await open(browser, `pages/${file}`, VIEWPORTS[3]);
      check(`pages/${file} opens the presentation at "${scene}"`, (await active(page)) === scene);
      await page.close();
    }
  }
} finally {
  await browser.close();
  server.close();
}

if (FILM_SCENES.length < 3) console.log('\nNote: not all three family films are prepared yet (npm run build:films).');
if (!(wishesData.videos || []).length) console.log('Note: still waiting for the "Family video wishes" folder (the Messages page shows the family\'s line until then).');
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
