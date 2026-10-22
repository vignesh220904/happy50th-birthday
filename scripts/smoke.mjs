// Browser test for the presentation (npm run test:browser).
// Serves the site, opens it in headless Chrome/Edge and checks, at projector,
// laptop and phone sizes: the welcome is the default screen, every scene fits
// its 16:9 frame, navigation (buttons, keys, menu) is consistent, the reasons,
// gallery, videos and gifts behave as the family asked, and there are no
// console errors or broken files.
//
// Uses the Chrome or Edge already installed (set CHROME_PATH to override).
// SMOKE_SHOTS=folder saves screenshots; SMOKE_ONLY=layouts|interactions|reduced|pages|fallback runs one group.

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
const SCENE_ORDER = ['welcome', 'reveal', 'journey-film', 'journey', 'reasons', 'memories', 'gallery', 'wishes', 'finale'];
// Family videos that have not been delivered yet: their placeholders are expected
const PENDING = [json('data/site.json').videos.lifeJourney.src, ...json('data/wishes.json').videos.map((v) => v.src)].map((p) => encodeURI(p));
const exists = (p) => existsSync(new URL(`../${p}`, import.meta.url));
const pendingMissing = PENDING.filter((p) => !exists(decodeURI(p)));

let failures = 0, passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passes++; console.log(`  ✓ ${name}`); }
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function watch(page) {
  const problems = [];
  const expected = (text) => pendingMissing.some((p) => text.includes(p));
  let lastMissing = false;
  page.on('response', (r) => {
    lastMissing = r.status() === 404 && expected(r.url());
    if (r.status() >= 400 && !lastMissing) problems.push(`HTTP ${r.status()}: ${r.url()}`);
  });
  page.on('console', (m) => {
    if (m.type() !== 'error') return;
    // Chrome reports the expected 404 of a not-yet-delivered video as a console error too
    if (/Failed to load resource: the server responded with a status of 404/.test(m.text()) && expected(m.location()?.url || '')) return;
    problems.push(`console: ${m.text()} ${m.location()?.url || ''}`);
  });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText || '';
    if (!/ERR_ABORTED/.test(err)) problems.push(`requestfailed: ${r.url()} ${err}`);
  });
  return problems;
}

async function open(browser, path, viewport, { reduced = false } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const problems = watch(page);
  await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'), { timeout: 30000 });
  return { page, problems };
}

const active = (page) => page.$eval('.scene.is-active', (s) => s.dataset.scene);
const sub = (page) => page.$eval('.deck-label__sub', (s) => s.textContent);
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`) }); };
const press = async (page, key) => { await page.keyboard.press(key); await sleep(520); };
/** Wait until the active scene's entrance animations have finished (looping ones excluded). */
const settle = (page) => page.waitForFunction(() => document.getAnimations()
  .filter((a) => a.effect?.target?.closest?.('.scene.is-active') && a.effect.getTiming().iterations !== Infinity)
  .every((a) => a.playState !== 'running'), { timeout: 5000, polling: 100 }).catch(() => {});

/** Visible elements of the active scene that leave the screen (decorative layers excluded). */
const offscreen = (page) => page.evaluate(() => {
  const s = document.querySelector('.scene.is-active');
  const out = [];
  s.querySelectorAll('.scene__frame *').forEach((el) => {
    if (el.closest('.welcome__visual, .reveal__portrait, .finale__scene, .gallery__years, svg')) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height || getComputedStyle(el).visibility === 'hidden') return;
    if (r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1 || r.top < -1) out.push(`${el.className || el.tagName} (${Math.round(r.left)},${Math.round(r.top)})–(${Math.round(r.right)},${Math.round(r.bottom)})`);
  });
  return out;
});
/** Does any text overflow its own clipped box (cut-off captions or reasons)? */
const clipped = (page) => page.evaluate(() => [...document.querySelectorAll('.scene.is-active .jcard__text, .scene.is-active .reasons__panel')]
  .filter((el) => el.scrollHeight > el.clientHeight + 2).map((el) => el.className));

const server = await serve(PORT);
const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  protocolTimeout: 180000,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
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
      await sleep(950);
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
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });

    // Default screen
    check('welcome is the default screen', (await active(page)) === 'welcome');
    check('welcome shows the requested wording', await page.$eval('.scene[data-scene="welcome"]', (s) =>
      /Celebrating the\s*Beautiful Journey\s*of Buvaneswari/.test(s.textContent) && s.textContent.includes('50 Years of Love, Strength & Beautiful Memories') && s.textContent.includes('27 October 1976 – 27 October 2026')));
    check('Previous is disabled on the first screen', await page.$eval('.deck-prev', (b) => b.disabled));
    check('no "Watch the Birthday Film" anywhere', await page.evaluate(() => !/birthday film/i.test(document.body.textContent) && !document.querySelector('.film-btn, [data-scene="age"], #age')));
    check('the opening title card is gone', !(await page.$('#intro')));
    check('palette is light (ivory/sky background, dark-blue text)', await page.evaluate(() => {
      const c = getComputedStyle(document.body);
      return c.backgroundColor === 'rgb(255, 253, 248)' && c.color === 'rgb(23, 54, 93)';
    }));

    // Reveal (the controls rest out of sight until the mouse moves, as at the venue)
    check('controls are out of sight on the idle welcome screen', await page.evaluate(() => document.body.classList.contains('controls-hidden')));
    await page.mouse.move(960, 540);
    await sleep(700); // the controls glide back in
    await page.click('.deck-next');
    await sleep(1600);
    check('Next opens the birthday reveal', (await active(page)) === 'reveal');
    check('reveal reads HAPPY 50TH BIRTHDAY / AMMA / M. BUVANESWARI on three lines', await page.evaluate(() => {
      const t = (s) => document.querySelector(s);
      const [a, b, c] = ['.reveal__line1', '.reveal__line2', '.reveal__line3'].map(t);
      const ra = a.getBoundingClientRect(), rb = b.getBoundingClientRect(), rc = c.getBoundingClientRect();
      const oneLine = (el) => el.getClientRects().length === 1 && el.getBoundingClientRect().height < parseFloat(getComputedStyle(el).fontSize) * 1.6;
      return /happy 50th birthday/i.test(a.textContent) && /amma/i.test(b.textContent) && /buvaneswari/i.test(c.textContent)
        && ra.bottom <= rb.top + 2 && rb.bottom <= rc.top + 2 && oneLine(a) && rc.right <= innerWidth;
    }));
    check('reveal shows Amma’s real photograph (age-47)', await page.$eval('.reveal__img', (img) => img.complete && img.naturalWidth > 0 && /age-47/.test(img.currentSrc)));

    // Full walk with the Next button: scene order and internal steps
    const walk = [];
    for (let guard = 0; guard < 40; guard++) {
      walk.push(`${await active(page)}|${await sub(page)}`);
      if (await page.$eval('.deck-next', (b) => b.disabled)) break;
      await page.$eval('.deck-next', (b) => b.click());
      await sleep(560);
    }
    const scenesSeen = [...new Set(walk.map((w) => w.split('|')[0]))];
    check('Next visits every scene in order', scenesSeen.join() === SCENE_ORDER.slice(1).join(), scenesSeen.join());
    const timelinePages = new Set(json('data/timeline.json').milestones.map((m) => m.era)).size;
    check(`the journey steps through its era pages (${walk.filter((w) => w.startsWith('journey|')).length})`, walk.filter((w) => w.startsWith('journey|')).length >= timelinePages - 1);
    check('the reasons step through 5 categories and "All 50"', walk.filter((w) => w.startsWith('reasons|')).length === 6);
    check('Next is disabled on the final scene', (await active(page)) === 'finale' && await page.$eval('.deck-next', (b) => b.disabled));

    // Previous walks back to the start
    let back = 0;
    while (!(await page.$eval('.deck-prev', (b) => b.disabled)) && back < 40) { await page.$eval('.deck-prev', (b) => b.click()); await sleep(520); back++; }
    check('Previous walks back to the welcome', (await active(page)) === 'welcome' && back === walk.length);

    // Keyboard
    await press(page, 'ArrowRight');
    check('→ moves forward', (await active(page)) === 'reveal');
    await press(page, 'ArrowLeft');
    check('← moves back', (await active(page)) === 'welcome');
    await press(page, 'PageDown');
    check('PageDown (presentation clicker) moves forward', (await active(page)) === 'reveal');
    await press(page, 'End');
    check('End jumps to the final scene', (await active(page)) === 'finale');
    await press(page, 'Home');
    check('Home returns to the welcome', (await active(page)) === 'welcome');
    await press(page, '5');
    check('number keys jump to a section (5 → 50 Reasons)', (await active(page)) === 'reasons');
    check('keys never scroll the page', await page.evaluate(() => scrollY === 0 && document.querySelector('.deck').scrollTop === 0));

    // Section menu
    await press(page, 'g');
    check('G opens the section menu with every scene', await page.$$eval('.deck-menu:not([hidden]) li', (l) => l.length) === SCENE_ORDER.length);
    await page.$$eval('.deck-menu li button', (b) => b[6].click());
    await sleep(600);
    check('choosing a section in the menu goes there', (await active(page)) === 'gallery' && await page.$eval('.deck-menu', (m) => m.hidden));

    // 50 reasons: whole categories at once
    await page.evaluate(() => window.__deck.goTo('reasons'));
    await sleep(900);
    const reasons = json('data/reasons.json');
    const shown = [];
    for (let c = 0; c < 5; c++) {
      await page.$$eval('.rcat', (b, k) => b[k].click(), c);
      await sleep(1400);
      const texts = await page.$$eval('.reasons__grid .rcard__text', (els) => els.map((e) => e.lastChild.textContent));
      const visible = await page.$$eval('.reasons__grid .rcard', (els) => els.filter((e) => getComputedStyle(e).opacity > 0.9).length);
      check(`category ${c + 1} shows all ${texts.length} of its reasons at once`, texts.length === 10 && visible === 10);
      shown.push(...texts);
    }
    check('all 50 reasons appear exactly once, word for word', shown.length === 50 && shown.every((t, i) => t === reasons.reasons[i].text));
    await page.$eval('.rcat--all', (b) => b.click());
    await sleep(900);
    const all = await page.$$eval('.rcol__item', (els) => els.map((e) => e.lastChild.textContent));
    check('"All 50 Reasons" shows all fifty together', all.length === 50 && all.every((t, i) => t === reasons.reasons[i].text));
    await shot(page, 'reasons-all-50');

    // Family album: memories film first, then the gallery
    const memIdx = SCENE_ORDER.indexOf('memories'), galIdx = SCENE_ORDER.indexOf('gallery');
    check('the memories film comes before the photo gallery', memIdx >= 0 && galIdx === memIdx + 1);
    await page.evaluate(() => window.__deck.goTo('memories'));
    await sleep(1500);
    check('the memories film is the family’s video', await page.$eval('.scene[data-scene="memories"] video', (v) => /family-memories\.mp4$/.test(v.currentSrc || v.src)));
    await page.waitForFunction(() => document.querySelector('.scene[data-scene="memories"] video').readyState >= 1, { timeout: 30000 }).catch(() => {});
    check('the memories film loads (6 min 23 s)', await page.$eval('.scene[data-scene="memories"] video', (v) => Math.round(v.duration) === 383));
    // Keys inside the player belong to the video, not the presentation
    await page.focus('.scene[data-scene="memories"] .player__btn');
    await press(page, 'ArrowRight');
    await press(page, ' ');
    check('arrow keys and Space inside the video player do not change scene', (await active(page)) === 'memories');
    await sleep(800);
    check('the video plays', await page.$eval('.scene[data-scene="memories"] video', (v) => !v.paused));
    check('presentation controls step aside while a video plays', await page.evaluate(() => document.body.classList.contains('video-playing')));
    await page.evaluate(() => { const v = document.querySelector('.scene[data-scene="memories"] video'); v.currentTime = v.duration - 0.3; });
    await page.waitForFunction(() => document.querySelector('.scene[data-scene="memories"] video').ended, { timeout: 15000 }).catch(() => {});
    await sleep(300);
    check('after the film, a clear button continues to the gallery', await page.$eval('.scene[data-scene="memories"] .cinema__end', (e) => !e.hidden && /photo gallery/i.test(e.textContent)));
    await page.$eval('.scene[data-scene="memories"] .cinema__end .btn--primary', (b) => b.click());
    await sleep(900);
    check('…and it opens the photo gallery', (await active(page)) === 'gallery');
    check('leaving a scene pauses its video', await page.$eval('.scene[data-scene="memories"] video', (v) => v.paused));

    // Gallery: dated photos only
    const manifest = json('data/photo_inventory.json').collections.gallery;
    const dated = manifest.filter((i) => i.date && /^\d{4}$/.test(i.group) && ['exif', 'filename'].includes(i.dateSource));
    const yearCount = await page.$$eval('.chip--year', (c) => c.map((x) => Number(x.querySelector('.chip__count').textContent)).reduce((a, b) => a + b, 0));
    check(`the gallery shows only the ${dated.length} dated photographs (${manifest.length - dated.length} undated left out)`, yearCount === dated.length);
    let tiles = 0, undatedShown = 0;
    const years = await page.$$eval('.chip--year', (c) => c.map((x) => x.dataset.year));
    for (const y of years) {
      await page.$eval(`.chip--year[data-year="${y}"]`, (b) => b.click());
      await sleep(200);
      for (let p = 0; p < 10; p++) {
        const dates = await page.$$eval('.ggrid .gitem__date', (d) => d.map((x) => x.textContent));
        tiles += dates.length;
        undatedShown += dates.filter((d) => !/\d{4}$/.test(d)).length;
        if (await page.$eval('.gpager .icon-btn:last-child', (b) => b.disabled || b.closest('[hidden]') !== null)) break;
        await page.$eval('.gpager .icon-btn:last-child', (b) => b.click());
        await sleep(150);
      }
    }
    check('every gallery photo carries its recorded date', tiles === dated.length && undatedShown === 0, `${tiles} tiles, ${undatedShown} undated`);
    await page.$eval('.gitem', (b) => b.click());
    await sleep(800);
    check('a photo opens in the viewer', await page.$eval('.lightbox', (d) => d.open));
    await press(page, 'ArrowRight');
    check('arrow keys in the photo viewer do not change scene', (await active(page)) === 'gallery');
    await press(page, 'Escape');

    // Pending family videos show their placeholders
    await page.evaluate(() => window.__deck.goTo('journey-film'));
    await sleep(1200);
    const lj = json('data/site.json').videos.lifeJourney;
    if (!exists(lj.src)) check('Life Journey film: graceful placeholder until the family’s video is added', await page.$eval('.scene[data-scene="journey-film"] .vstage__missing-text', (e) => e.textContent) === lj.missingText);
    else check('Life Journey film: the family’s video is integrated', !!(await page.$('.scene[data-scene="journey-film"] video')));
    check('the old generated Life Journey film is gone', await page.evaluate(() => ![...document.querySelectorAll('video')].some((v) => /life%20journey|life journey/i.test(v.src))));
    await page.evaluate(() => window.__deck.goTo('wishes'));
    await sleep(1200);
    const wishSrc = json('data/wishes.json').videos[0].src;
    const wishText = !exists(wishSrc) && await page.$eval('.scene[data-scene="wishes"] .vstage__missing-text', (e) => e.textContent);
    if (!exists(wishSrc)) check('Family Wishes: the requested placeholder line', wishText === 'Messages filled with love, from the people who make her world special.', wishText);
    else check('Family Wishes: the family’s video is integrated', !!(await page.$('.scene[data-scene="wishes"] video')));

    // Music
    const musicOk = await page.$eval('.music-btn', (b) => !b.disabled);
    check('music is available and not playing before the host starts it', musicOk && await page.$eval('.music-btn', (b) => b.getAttribute('aria-pressed') === 'false'));
    await page.mouse.move(500, 500);
    await sleep(700);
    await page.click('.music-btn');
    await sleep(1200);
    check('the music button starts the music', await page.$eval('.music-btn', (b) => b.getAttribute('aria-pressed') === 'true' && b.classList.contains('is-playing')));
    await page.click('.deck-bar--tools .icon-btn:nth-child(2)');
    await sleep(300);
    check('the mute button mutes the music', await page.$eval('.deck-bar--tools .icon-btn:nth-child(2)', (b) => b.getAttribute('aria-pressed') === 'true'));
    await page.click('.deck-bar--tools .icon-btn:nth-child(2)');
    await page.keyboard.press('m');
    await sleep(300);
    check('M pauses the music', await page.$eval('.music-btn', (b) => b.getAttribute('aria-pressed') === 'false'));

    // Finale: 50 gifts
    await page.evaluate(() => window.__deck.goTo('finale'));
    await sleep(1500);
    check('the final scene shows 50 gifts', (await page.$$('.gtile')).length === 50);
    check('no gift is shown as given until the host marks it', await page.$eval('.gcount__num', (n) => n.textContent === '0') && (await page.$$('.gtile.is-given')).length === 0);
    check('the greeting, name, date and venue are shown', await page.$eval('.scene[data-scene="finale"]', (s) => ['Happy 50th Birthday, Amma!', '50 Years of Beautiful Memories. A Lifetime of Love. Countless Reasons to Celebrate You.', 'We may never be able to give back everything you have given us', 'M. Buvaneswari', '27 October 2026', 'Palmshore Restaurant, Ekkatuthangal, Chennai'].every((t) => s.textContent.includes(t))));
    check('3D gift scene runs', await page.$eval('.finale__scene', (el) => el.classList.contains('has-webgl')));
    for (const k of [0, 4, 9]) await page.$$eval('.gtile', (t, i) => t[i].click(), k);
    await sleep(300);
    check('tapping gifts marks them as given (counter 3 / 50)', await page.$eval('.gcount__num', (n) => n.textContent === '3'));
    await page.reload({ waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'));
    check('a refresh always returns to the welcome', (await active(page)) === 'welcome');
    await page.evaluate(() => window.__deck.goTo('finale'));
    await sleep(900);
    check('…and the host’s gift marks are kept', await page.$eval('.gcount__num', (n) => n.textContent === '3'));
    const resetBtn = await page.$$('.gtracker__actions .btn');
    await resetBtn[1].click(); await sleep(100); await resetBtn[1].click(); await sleep(300);
    check('Reset (confirmed) clears the marks', await page.$eval('.gcount__num', (n) => n.textContent === '0'));
    await resetBtn[0].click(); await sleep(100); await resetBtn[0].click(); await sleep(400);
    check('"Mark all given" (confirmed) marks all 50', await page.$eval('.gcount__num', (n) => n.textContent === '50'));
    await shot(page, 'finale-all-given');
    await resetBtn[1].click(); await sleep(100); await resetBtn[1].click(); await sleep(200);
    await page.$eval('.finale__actions .btn--gold', (b) => b.click());
    await sleep(900);
    check('"Back to the welcome" returns to the welcome', (await active(page)) === 'welcome');

    // Idle: controls step aside and come back
    await sleep(4300);
    check('controls hide when the mouse rests', await page.evaluate(() => document.body.classList.contains('controls-hidden')));
    await page.mouse.move(400, 400);
    await sleep(200);
    check('…and return on mouse movement', await page.evaluate(() => !document.body.classList.contains('controls-hidden')));
    await shot(page, 'welcome-with-controls');

    // Deep link
    await page.goto(`${BASE}/index.html#reasons`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'));
    check('index.html#reasons opens that scene once, then the hash is removed', (await active(page)) === 'reasons' && await page.evaluate(() => location.hash === ''));
    await page.evaluate(() => { try { localStorage.clear(); } catch {} });
    check('no console errors or broken files', !problems.length, problems.slice(0, 6).join('\n      '));
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
    for (const [file, scene] of [['reasons.html', 'reasons'], ['finale.html', 'finale'], ['age-transition.html', 'welcome']]) {
      const { page } = await open(browser, `pages/${file}`, VIEWPORTS[3]);
      check(`pages/${file} opens the presentation at "${scene}"`, (await active(page)) === scene);
      await page.close();
    }
  }

  // ---------------------------------------------------------------- no WebGL fallback
  if (run('fallback')) {
    console.log('\nno-WebGL fallback');
    const page = await browser.newPage();
    await page.setViewport(VIEWPORTS[3]);
    await page.evaluateOnNewDocument(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return /webgl/.test(type) ? null : orig.call(this, type, ...rest);
      };
    });
    const problems = watch(page);
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'));
    await page.evaluate(() => window.__deck.goTo('finale'));
    await sleep(900);
    check('the finale falls back to a CSS gift', await page.$eval('.finale__scene', (el) => el.classList.contains('no-webgl')) && await page.$eval('.finale__fallback', (el) => getComputedStyle(el).display !== 'none'));
    check('no console errors without WebGL', !problems.length, problems.slice(0, 5).join('\n      '));
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

if (pendingMissing.length) console.log(`\nNote: still waiting for the family's video(s): ${pendingMissing.map(decodeURI).join(', ')} (placeholders shown; not counted as errors).`);
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
