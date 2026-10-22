// Browser smoke test (npm run test:browser).
// Serves the site, opens it in headless Chrome/Edge at several screen sizes and
// checks: no console errors or failed requests, no horizontal overflow, WebGL
// scenes start, and the main interactions of every chapter work.
//
// Uses the Chrome or Edge already installed (set CHROME_PATH to override).
// Screenshots are written to SMOKE_SHOTS (if set).

import puppeteer from 'puppeteer-core';
import { existsSync, mkdirSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { serve } from './serve.mjs';

const PORT = 8765;
const BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SMOKE_SHOTS;
// SMOKE_ONLY=layouts|interactions|reduced|pages|fallback runs a single group
const ONLY = process.env.SMOKE_ONLY;
const run = (group) => !ONLY || ONLY === group;
if (SHOTS) mkdirSync(SHOTS, { recursive: true });

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
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'tablet', width: 820, height: 1180, isMobile: true, hasTouch: true },
  { name: 'mobile', width: 390, height: 844, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
  { name: 'mobile-landscape', width: 844, height: 390, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
];

let failures = 0, passes = 0;
const check = (name, ok, detail = '') => {
  if (ok) { passes++; console.log(`  ✓ ${name}`); }
  else { failures++; console.log(`  ✗ ${name}${detail ? `\n      ${detail}` : ''}`); }
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function watch(page) {
  const problems = [];
  page.on('console', (m) => { if (m.type() === 'error') problems.push(`console: ${m.text()}`); });
  page.on('pageerror', (e) => problems.push(`pageerror: ${e.message}`));
  page.on('requestfailed', (r) => {
    const err = r.failure()?.errorText || '';
    if (!/ERR_ABORTED/.test(err) && !r.url().includes('fonts.g')) problems.push(`requestfailed: ${r.url()} ${err}`);
  });
  page.on('response', (r) => { if (r.status() >= 400) problems.push(`HTTP ${r.status()}: ${r.url()}`); });
  return problems;
}

async function open(browser, path, viewport, { reduced = false, enter = true } = {}) {
  const page = await browser.newPage();
  await page.setViewport(viewport);
  if (reduced) await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }]);
  const problems = watch(page);
  await page.goto(`${BASE}/${path}`, { waitUntil: 'networkidle2', timeout: 60000 });
  await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'), { timeout: 30000 });
  if (enter) await passIntro(page);
  return { page, problems };
}

/** Wait for the opening title card (if any) and press "Begin the celebration". */
async function passIntro(page) {
  if (!(await page.$('#intro:not([hidden])'))) return;
  await page.waitForSelector('#intro.is-ready', { timeout: 30000 });
  await page.$eval('.intro__enter', (b) => b.click());
  await page.waitForFunction(() => document.getElementById('intro')?.hidden !== false, { timeout: 15000 });
}

async function scrollThrough(page) {
  await page.evaluate(async () => {
    const step = innerHeight * 0.8;
    for (let y = 0; y < document.documentElement.scrollHeight; y += step) {
      scrollTo(0, y);
      await new Promise((r) => setTimeout(r, 120));
    }
  });
  await sleep(800);
}

// compare with clientWidth: on emulated phones innerWidth grows to fit any overflow
const overflow = (page) => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
const shot = async (page, name) => { if (SHOTS) { log('shot', name); await page.screenshot({ path: join(SHOTS, `${name}.png`), captureBeyondViewport: false }); } };
const log = (...a) => process.env.SMOKE_VERBOSE && console.log('    ·', ...a);
async function shotSection(page, id, name) {
  log('section', id);
  await page.evaluate((i) => document.getElementById(i)?.scrollIntoView({ block: 'start' }), id);
  await sleep(1600);
  await shot(page, name);
}

const server = await serve(PORT);
const browser = await puppeteer.launch({
  executablePath: browserPath,
  headless: true,
  protocolTimeout: 120000,
  args: ['--enable-webgl', '--ignore-gpu-blocklist', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--autoplay-policy=no-user-gesture-required'],
});

try {
  // ---------------------------------------------------------------- layouts
  for (const vp of run('layouts') ? VIEWPORTS : []) {
    console.log(`\n${vp.name} (${vp.width}×${vp.height})`);
    const { page, problems } = await open(browser, 'index.html', vp);
    await sleep(2500);
    await shot(page, `${vp.name}-01-welcome`);
    check('hero 3D scene started', await page.$eval('.welcome__scene', (el) => el.classList.contains('has-webgl')));
    await scrollThrough(page);
    check('no horizontal overflow', (await overflow(page)) <= 0, `overflow ${await overflow(page)}px`);
    const clipped = await page.evaluate(() => [...document.querySelectorAll('h1, h2, h3')].filter((h) => {
      const r = h.getBoundingClientRect();
      return r.width > 0 && (r.left < -1 || r.right > innerWidth + 1);
    }).map((h) => h.textContent.trim().slice(0, 40)));
    check('no heading runs off screen', !clipped.length, clipped.join(' | '));
    for (const [id, n] of [['journey', '02'], ['reasons', '03'], ['memories', '04'], ['wishes', '05'], ['age', '06'], ['finale', '07']]) {
      await shotSection(page, id, `${vp.name}-${n}-${id}`);
    }
    check('no console errors or failed requests', !problems.length, problems.slice(0, 8).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- interactions
  console.log('\nopening (desktop)');
  if (run('interactions')) {
    const { page, problems } = await open(browser, 'index.html', VIEWPORTS[0], { enter: false });
    check('opening covers the page while loading', (await page.$eval('#intro', (el) => !el.hidden)) && (await page.$eval('main', (m) => m.inert)));
    await page.waitForSelector('#intro.is-ready', { timeout: 30000 });
    check('years count up to 2026', (await page.$eval('.intro__year', (e) => e.textContent)) === '2026');
    check('opening reads "Happy 50th Birthday, Amma"', /Happy\s+50th\s+Birthday,\s+Amma/.test(await page.$eval('#intro-title', (e) => e.textContent)));
    await sleep(2600);
    await shot(page, 'opening');
    await page.$eval('.intro__enter', (b) => b.click());
    await sleep(1800);
    check('"Begin the celebration" lifts the opening', (await page.$eval('#intro', (el) => el.hidden)) && (await page.$eval('main', (m) => !m.inert)));
    check('no console errors during the opening', !problems.length, problems.slice(0, 8).join('\n      '));
    await page.close();
    const deep = await open(browser, 'index.html#memories', VIEWPORTS[0], { enter: false });
    check('deep links (index.html#memories) skip the opening', !(await deep.page.$('#intro')));
    await deep.page.close();
  }

  console.log('\ninteractions (desktop)');
  if (run('interactions')) {
    const { page, problems } = await open(browser, 'index.html', VIEWPORTS[0]);

    // The opening is checked on its own page load (enter: false)
    check('music started from "Begin the celebration"', await page.$eval('.nav-tools .icon-btn', (b) => b.getAttribute('aria-pressed') === 'true'));
    check('page is usable after the opening (not inert)', await page.$eval('main', (m) => !m.inert));
    await page.click('.nav-tools .icon-btn'); // music off

    // Hero buttons
    await page.$eval('#welcome .film-btn', (b) => b.click());
    await sleep(1500);
    check('hero opens the birthday film', await page.$eval('dialog.cinema', (d) => d.open && /Birthday Film/.test(d.textContent)));
    check('birthday film (converted to H.264) loads', await page.waitForFunction(() => document.querySelector('.cinema video')?.readyState >= 1, { timeout: 15000 }).then(() => true, () => false));
    await page.keyboard.press('Escape');
    await sleep(400);
    await page.$eval('.welcome__cta', (b) => b.click());
    await sleep(2500);
    check('"Begin Her Beautiful Journey" glides to the journey', await page.evaluate(() => Math.abs(document.getElementById('journey').getBoundingClientRect().top) < innerHeight * 0.5));

    // Journey
    await page.evaluate(() => document.querySelector('.journey').scrollIntoView());
    await sleep(2500);
    check('journey runs in real 3D', await page.$eval('.journey__space', (el) => el.classList.contains('has-webgl')));
    await shot(page, 'interaction-journey-3d');
    const counter = () => page.$eval('.journey__counter', (e) => e.textContent);
    check('journey starts at milestone 1', (await counter()) === '01 / 27');
    await page.click('.journey__buttons .icon-btn:last-child');
    await sleep(1200);
    check('next button advances the journey', (await counter()) === '02 / 27');
    await page.focus('.journey');
    await page.keyboard.press('ArrowRight');
    await sleep(1200);
    check('arrow key advances the journey', (await counter()) === '03 / 27');
    await page.keyboard.press('End');
    await sleep(1200);
    check('End jumps to the final milestone (Fifty)', (await page.$eval('.jscene:last-child .jscene__title', (e) => e.textContent)) === 'Fifty');
    await page.click('.journey__stops li:nth-child(7) button');
    await sleep(1200);
    const bikes = await page.$eval('.jscene:last-child', (e) => e.textContent);
    check('rail jumps to 1997 bikes, noting there is no original photo', /TVS 50/.test(bikes) && /No original photograph/.test(bikes));
    await page.$eval('.jscene:last-child .jscene__cta', (b) => b.click());
    await sleep(800);
    check('journey photo opens in the lightbox', await page.$eval('dialog.lightbox', (d) => d.open));
    check('lightbox labels the illustration', (await page.$eval('.lightbox .media-label', (e) => e.textContent)).startsWith('Illustration'));
    await page.keyboard.press('Escape');
    await sleep(400);

    // Reasons
    await page.evaluate(() => document.getElementById('reasons').scrollIntoView());
    await sleep(1500);
    await page.click('#rtab-treasure');
    await sleep(700);
    check('chapter tab shows reason 21', (await page.$eval('.reader__position', (e) => e.textContent)) === 'Reason 21 of 50');
    check('reason text is the family’s wording', (await page.$eval('.reader__text', (e) => e.textContent)) === 'We love the way you worry about us, even when we are grown up.');
    await page.click('.reader__foot .icon-btn:last-child');
    await sleep(500);
    check('next reason works', (await page.$eval('.reader__position', (e) => e.textContent)) === 'Reason 22 of 50');
    check('constellation 3D scene started', await page.$eval('.sky', (el) => el.classList.contains('has-webgl')));
    await page.click('.reasons__all-toggle .btn');
    await sleep(500);
    check('"Read all 50" lists 50 reasons', (await page.$$eval('.rall__item', (l) => l.length)) === 50);

    // Gallery + lightbox
    await page.evaluate(() => document.getElementById('memories').scrollIntoView());
    await sleep(800);
    const total = await page.$$eval('.chip--filter', (c) => Number(c[0].querySelector('.chip__count').textContent));
    check('gallery lists every photo', total === 284, `count ${total}`);
    await page.click('.chip--filter[data-filter="album"]');
    await sleep(600);
    check('filter shows the Family Album only', (await page.$$eval('.ggroup', (g) => g.map((x) => x.dataset.group).join())) === 'album');
    await page.click('.gitem');
    await sleep(900);
    check('gallery photo opens in the lightbox', await page.$eval('dialog.lightbox', (d) => d.open));
    await page.keyboard.press('ArrowRight');
    await sleep(500);
    check('lightbox arrow key moves to the next photo', (await page.$eval('.lightbox__counter', (e) => e.textContent)).startsWith('2 /'));
    check('lightbox full image loaded', await page.waitForFunction(() => document.querySelector('.lightbox__img.is-loaded'), { timeout: 8000 }).then(() => true, () => false));
    await shot(page, 'interaction-lightbox');
    await page.keyboard.press('Escape');
    await sleep(400);
    check('Escape closes the lightbox', !(await page.$eval('dialog.lightbox', (d) => d.open)));
    await page.click('.chip--filter[data-filter="all"]');

    // Wishes
    check('wishes shows the "on their way" message', (await page.$eval('.theatre__empty-text', (e) => e.textContent)) === 'Beautiful words from the people who love you are on their way.');

    // Age
    await page.evaluate(() => document.getElementById('age').scrollIntoView());
    await sleep(800);
    const age = () => page.$eval('.age__num', (e) => e.textContent);
    check('age sequence starts at age 1', (await age()) === '1');
    await page.click('.age__controls .icon-btn:nth-child(3)');
    await sleep(500);
    check('next photo moves to age 5', (await age()) === '5');
    await page.click('.age__tick[data-age="34"]');
    await sleep(500);
    check('age ruler jumps to age 34', (await age()) === '34' && (await page.$eval('.age__years', (e) => e.textContent)) === '2010 – 11');
    check('3D reel puts the age-34 photo in front', /age 34/.test(await page.$eval('.age__card.is-current img', (i) => i.alt)) && (await page.$$('.age__card:not(.is-hidden)')).length > 5);
    await page.click('.age__play');
    await sleep(2300);
    check('play advances automatically', (await page.$eval('.age__count', (e) => e.textContent)) === 'Photo 2 of 4');
    await page.click('.age__play');
    check('pause stops playback', (await page.$eval('.age__play', (b) => b.getAttribute('aria-pressed'))) === 'false');
    await page.click('.age__tick[data-age="49"]');
    await sleep(300);
    await page.click('.age__controls .icon-btn:nth-child(3)');
    await sleep(900);
    check('stepping past age 49 shows the ending', await page.$eval('.age__end', (e) => !e.hidden && e.textContent.includes('every chapter has been precious')));
    // read synchronously after the click: autoplay may advance again within 2 s on a slow machine
    const afterReplay = await page.$eval('.age__controls .icon-btn:nth-child(4)', (b) => { b.click(); return document.querySelector('.age__num').textContent; });
    check('replay restarts from age 1 and plays', afterReplay === '1' && (await page.$eval('.age__play', (b) => b.getAttribute('aria-pressed'))) === 'true');
    await page.click('.age__play');

    // Film (cinema)
    await page.click('#age .film-btn');
    await sleep(1500);
    check('film opens in the cinema player', await page.$eval('dialog.cinema', (d) => d.open));
    check('film video loads metadata', await page.waitForFunction(() => document.querySelector('.cinema video')?.readyState >= 1, { timeout: 10000 }).then(() => true, () => false));
    await shot(page, 'interaction-film');
    await page.keyboard.press('Escape');
    await sleep(400);

    // Finale
    await page.evaluate(() => document.getElementById('finale').scrollIntoView());
    await sleep(2500);
    check('gift 3D scene started', await page.$eval('.finale__scene', (el) => el.classList.contains('has-webgl')));
    await page.$eval('.finale__open .btn', (b) => b.click());
    await sleep(3000);
    check('gift opens', (await page.$eval('.finale__open .btn', (b) => b.getAttribute('aria-pressed'))) === 'true');
    await shot(page, 'interaction-gift-open');
    await page.evaluate(() => document.getElementById('birthday-film').scrollIntoView());
    check('birthday film plays inline in the celebration', await page.waitForFunction(() => document.querySelector('#birthday-film video')?.readyState >= 1, { timeout: 15000 }).then(() => true, () => false));
    check('50 gift slots shown', (await page.$$eval('.gtile', (l) => l.length)) === 50);
    check('celebration details shown', /Palmshore Restaurant/.test(await page.$eval('.celebration', (e) => e.textContent)));
    await page.$eval('.celebration__actions .btn--gold', (b) => b.click());
    await sleep(2600);
    check('replay returns to the welcome and plays the opening again', (await page.evaluate(() => scrollY < 50)) && (await page.$eval('#intro', (d) => !d.hidden)));
    await passIntro(page);

    check('no console errors during interactions', !problems.length, problems.slice(0, 8).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- reduced motion
  console.log('\nreduced motion (mobile)');
  if (run('reduced')) {
    const { page, problems } = await open(browser, 'index.html', VIEWPORTS[3], { reduced: true });
    await scrollThrough(page);
    check('journey uses the calm (non-3D) viewer', (await page.$eval('.journey', (j) => !j.classList.contains('journey--3d'))) && (await page.$$('.jframe')).length > 0);
    check('content visible without animation', await page.$$eval('[data-reveal]', (els) => els.every((e) => getComputedStyle(e).opacity === '1')));
    check('no console errors', !problems.length, problems.slice(0, 8).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- standalone pages
  console.log('\nstandalone pages');
  for (const file of run('pages') ? readdirSync(new URL('../pages', import.meta.url)) : []) {
    const { page, problems } = await open(browser, `pages/${file}`, VIEWPORTS[1]);
    await scrollThrough(page);
    const rendered = await page.$eval('[data-section]', (el) => el.children.length > 0 && !el.querySelector('.section-error'));
    check(`pages/${file} renders without errors`, rendered && !problems.length, problems.slice(0, 5).join('\n      '));
    await page.close();
  }

  // ---------------------------------------------------------------- no WebGL fallback
  console.log('\nno-WebGL fallback');
  if (run('fallback')) {
    const page = await browser.newPage();
    await page.setViewport(VIEWPORTS[1]);
    await page.evaluateOnNewDocument(() => {
      const orig = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, ...rest) {
        return /webgl/.test(type) ? null : orig.call(this, type, ...rest);
      };
    });
    const problems = watch(page);
    await page.goto(`${BASE}/index.html`, { waitUntil: 'networkidle2' });
    await page.waitForFunction(() => document.documentElement.classList.contains('is-loaded'));
    await passIntro(page);
    await scrollThrough(page);
    check('journey falls back to the CSS viewer', (await page.$eval('.journey', (j) => !j.classList.contains('journey--3d'))) && (await page.$$('.jframe')).length > 0);
    check('scenes fall back gracefully', await page.$eval('.welcome__scene', (el) => el.classList.contains('no-webgl')) && (await page.$$('canvas.scene-canvas')).length === 0);
    await page.evaluate(() => document.getElementById('finale').scrollIntoView());
    // element.click(): the gallery may still be appending photos above, shifting the button
    await page.$eval('.finale__open .btn', (b) => b.click());
    await sleep(300);
    check('CSS gift opens without WebGL', await page.$eval('#finale', (el) => el.classList.contains('is-open')));
    check('no console errors without WebGL', !problems.length, problems.slice(0, 5).join('\n      '));
    await shotSection(page, 'welcome', 'fallback-welcome');
    await page.close();
  }
} finally {
  await browser.close();
  server.close();
}

console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);
