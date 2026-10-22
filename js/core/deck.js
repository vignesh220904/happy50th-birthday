// The presentation controller: one registry of scenes and one state (the current
// scene). Every way of moving — the Next / Previous buttons, the section menu,
// keyboard, presentation clickers, swipes and the scenes' own buttons — goes
// through go(), so they always agree.
//
// A scene may have internal steps (the reasons categories, the life-journey
// eras): Next first moves through those, then on to the next scene. Entering a
// scene backwards opens it at its last step, like slide builds.
//
// Automatic playback: after "Begin the Celebration" (or the ▶ button / A),
// the presentation moves on by itself. Each scene says how long to stay
// (ctl.auto() → milliseconds) or that it will say when it is done
// (ctl.auto() → 'wait', then deck.autoAdvance(): a film that has ended).
// Switching it on or off tells the current scene (ctl.autoChanged(on)), so a
// film that is waiting starts as soon as the host resumes.
// There is only ever one timer: every move clears it first, so the photo
// slideshows, the reasons and the scenes can never run conflicting timers.
// Touching the scene restarts the wait; the photo viewer or the section menu
// hold it; the final scene ends it. Manual controls always work.
//
// The welcome is always the first screen. The current scene is deliberately
// never stored (not in the URL, not in storage), so a refresh or a new session
// shows the welcome again. A link such as index.html#reasons opens that scene
// once and the hash is then removed.

import { h, icons, announce, onSwipe, prefersReducedMotion, isCoarsePointer } from './util.js';
import { music } from './audio.js';

const IDLE_MS = 3500;
const NAV_KEYS_NEXT = new Set(['ArrowRight', 'ArrowDown', 'PageDown', ' ', 'Enter']);
const NAV_KEYS_PREV = new Set(['ArrowLeft', 'ArrowUp', 'PageUp', 'Backspace']);
const CLICKER_KEYS = new Set(['PageDown', 'PageUp']); // presentation remotes send these
const DEFAULT_DWELL = 4000; // a scene without its own timing: a few seconds to read it

export function createDeck(root, uiMount) {
  const scenes = [];          // { id, title, el, ctl }
  const listeners = new Set();
  let index = 0, busy = false;
  let auto = false, autoTimer = 0;

  // ---- Controls ---------------------------------------------------------------
  const autoBtn = h('button', { class: 'icon-btn deck-auto', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Resume the slideshow', title: 'Start automatic playback  (A)', html: icons.play },
    h('span', { class: 'deck-auto__ring', 'aria-hidden': 'true' }));
  const prevBtn = h('button', { class: 'icon-btn deck-prev', type: 'button', 'aria-label': 'Previous', title: 'Previous  (←)', html: icons.prev });
  const nextBtn = h('button', { class: 'deck-next', type: 'button', 'aria-label': 'Next', title: 'Next  (→ or Space)' }, h('span', {}, 'Next'), h('i', { html: icons.next }));
  const dots = h('span', { class: 'deck-dots', 'aria-hidden': 'true' });
  const labelTitle = h('span', { class: 'deck-label__title' });
  const labelSub = h('span', { class: 'deck-label__sub' });
  const progressBtn = h('button', { class: 'deck-progress', type: 'button', 'aria-haspopup': 'dialog', 'aria-expanded': 'false', title: 'All sections  (G)' },
    dots, h('span', { class: 'deck-label' }, labelTitle, labelSub));
  const musicBtn = h('button', { class: 'icon-btn music-btn', type: 'button', 'aria-pressed': 'false', html: icons.music });
  const muteBtn = h('button', { class: 'icon-btn tool-optional', type: 'button', 'aria-pressed': 'false', html: icons.volume });
  const fsBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-label': 'Full screen', title: 'Full screen  (F)', html: icons.expand });
  const menuBtn = h('button', { class: 'icon-btn tool-optional', type: 'button', 'aria-label': 'All sections', title: 'All sections  (G)', 'aria-expanded': 'false', html: icons.menu });

  const navBar = h('nav', { class: 'deck-bar deck-bar--nav', 'aria-label': 'Presentation' }, autoBtn, prevBtn, progressBtn, nextBtn);
  const toolBar = h('div', { class: 'deck-bar deck-bar--tools', role: 'toolbar', 'aria-label': 'Music and screen' }, musicBtn, muteBtn, fsBtn, menuBtn);
  const menu = h('div', { class: 'deck-menu', role: 'dialog', 'aria-label': 'All sections', hidden: true });
  uiMount.replaceChildren(navBar, toolBar, menu);

  // ---- Registry ---------------------------------------------------------------
  function add(id, title, ctl = {}) {
    const el = root.querySelector(`[data-scene="${id}"]`);
    if (!el) return;
    el.setAttribute('tabindex', '-1');
    el.setAttribute('aria-roledescription', 'slide');
    scenes.push({ id, title, el, ctl });
  }

  const current = () => scenes[index];
  const stepInfo = (s) => s?.ctl.steps?.() || null; // { index, count, label }

  // ---- Moving -------------------------------------------------------------------
  function go(target, { dir, atEnd = false, focus = false } = {}) {
    if (!scenes.length) return;
    const to = Math.max(0, Math.min(scenes.length - 1, target));
    if (to === index && scenes[to].el.classList.contains('is-active')) { render(); return; }
    const from = scenes[index];
    const next = scenes[to];
    const direction = dir ?? (to >= index ? 1 : -1);
    closeMenu();

    if (from && from !== next) {
      from.el.style.setProperty('--dir', direction);
      from.el.classList.remove('is-active', 'has-entered');
      from.el.classList.add('is-leaving');
      from.el.inert = true;
      from.el.setAttribute('aria-hidden', 'true');
      try { from.ctl.leave?.(); } catch (err) { console.error(`[deck] ${from.id} leave`, err); }
      setTimeout(() => from.el.classList.remove('is-leaving'), prefersReducedMotion() ? 0 : 950);
    }

    index = to;
    next.el.style.setProperty('--dir', direction);
    next.el.classList.remove('is-leaving');
    next.el.inert = false;
    next.el.removeAttribute('aria-hidden');
    next.el.classList.add('is-active');
    requestAnimationFrame(() => requestAnimationFrame(() => next.el.classList.add('has-entered')));
    try { next.ctl.enter?.({ dir: direction, atEnd }); } catch (err) { console.error(`[deck] ${next.id} enter`, err); }
    if (focus || !document.activeElement || document.activeElement === document.body || !document.activeElement.isConnected || document.activeElement.closest('[inert]')) {
      next.el.focus({ preventScroll: true });
    }
    render();
    announce(`${next.title}. Section ${index + 1} of ${scenes.length}.`);
    listeners.forEach((fn) => fn(next.id, index));
    document.dispatchEvent(new CustomEvent('deck:change', { detail: { id: next.id, index } }));
    // let the scene after this one get ready (e.g. load its 3D) while this one plays
    try { scenes[index + 1]?.ctl.prepare?.(); } catch (err) { console.error('[deck] prepare', err); }
  }

  function next() {
    if (busy) return;
    const s = current();
    if (s?.ctl.step?.(1)) { render(); return; }
    if (index < scenes.length - 1) throttle(() => go(index + 1, { dir: 1 }));
  }
  function prev() {
    if (busy) return;
    const s = current();
    if (s?.ctl.step?.(-1)) { render(); return; }
    if (index > 0) throttle(() => go(index - 1, { dir: -1, atEnd: true }));
  }
  // A held-down key or a double-pressed clicker should not race through scenes
  function throttle(fn) {
    busy = true;
    fn();
    setTimeout(() => { busy = false; }, prefersReducedMotion() ? 120 : 450);
  }

  function render() {
    const s = current();
    const info = stepInfo(s);
    const atStart = index === 0 && (!info || info.index === 0);
    const atEnd = index === scenes.length - 1 && (!info || info.index === info.count - 1);
    prevBtn.disabled = atStart;
    nextBtn.disabled = atEnd;
    nextBtn.firstChild.textContent = index === 0 ? 'Begin' : 'Next';
    labelTitle.textContent = s?.title || '';
    labelSub.textContent = `${index + 1} of ${scenes.length}${info && info.count > 1 ? ` · ${info.label || `${info.index + 1}/${info.count}`}` : ''}`;
    progressBtn.dataset.short = `${index + 1}/${scenes.length}`;
    progressBtn.setAttribute('aria-label', `Section ${index + 1} of ${scenes.length}: ${s?.title}. Open the section list.`);
    dots.replaceChildren(...scenes.map((_, i) => h('span', { class: `deck-dot ${i < index ? 'is-past' : ''} ${i === index ? 'is-current' : ''}` })));
    document.body.dataset.currentScene = s?.id || '';
    scheduleAuto();
  }

  // ---- Automatic playback ---------------------------------------------------------------
  function clearAuto() {
    clearTimeout(autoTimer);
    autoTimer = 0;
    autoBtn.classList.remove('is-counting', 'is-waiting');
  }
  function scheduleAuto() {
    clearAuto();
    if (!auto || !scenes.length) return;
    const s = current();
    const info = stepInfo(s);
    const last = index === scenes.length - 1 && (!info || info.index === info.count - 1);
    if (last) { setAuto(false, 'The celebration has reached its finale.'); return; }
    let plan = DEFAULT_DWELL;
    try { plan = s.ctl.auto?.() ?? DEFAULT_DWELL; } catch (err) { console.error('[deck] auto', err); }
    if (plan === 'wait') { autoBtn.classList.add('is-waiting'); return; }
    autoBtn.style.setProperty('--dwell', `${plan}ms`);
    void autoBtn.offsetWidth; // restart the ring animation
    autoBtn.classList.add('is-counting');
    autoTimer = setTimeout(fireAuto, plan);
  }
  function fireAuto() {
    autoTimer = 0;
    // someone is looking at a photo or choosing a section: wait a little longer
    if (document.querySelector('dialog[open]') || !menu.hidden) { autoTimer = setTimeout(fireAuto, 3000); return; }
    busy = false;
    next();
  }
  function setAuto(on, message) {
    auto = !!on;
    autoBtn.setAttribute('aria-pressed', String(auto));
    autoBtn.firstChild.outerHTML = auto ? icons.pause : icons.play;
    autoBtn.setAttribute('aria-label', auto ? 'Pause the slideshow' : 'Resume the slideshow');
    autoBtn.title = `${auto ? 'Pause' : 'Start'} automatic playback  (A)`;
    document.body.classList.toggle('is-autoplaying', auto);
    if (auto) scheduleAuto(); else clearAuto();
    try { current()?.ctl.autoChanged?.(auto); } catch (err) { console.error('[deck] autoChanged', err); }
    announce(message || (auto ? 'Automatic playback on.' : 'Automatic playback paused.'));
  }
  autoBtn.addEventListener('click', () => setAuto(!auto));
  // Interacting with a scene restarts its wait, so nothing moves on mid-click
  root.addEventListener('pointerdown', () => { if (auto && autoTimer) scheduleAuto(); });

  // ---- Section menu ---------------------------------------------------------------
  function openMenu() {
    menu.replaceChildren(
      h('p', { class: 'deck-menu__title' }, 'Go to a section'),
      h('ol', {}, scenes.map((s, i) => h('li', {},
        h('button', { type: 'button', 'aria-current': i === index ? 'step' : null, onclick: () => go(i, { focus: true }) },
          h('span', { class: 'deck-menu__num' }, i + 1),
          h('span', {}, h('span', { class: 'deck-menu__name' }, s.title), s.ctl.hint ? h('span', { class: 'deck-menu__hint' }, s.ctl.hint) : null),
        ),
      ))),
      h('p', { class: 'deck-menu__keys', html: '<kbd>→</kbd> / <kbd>Space</kbd> next · <kbd>←</kbd> back · <kbd>A</kbd> pause / resume · <kbd>Esc</kbd> close a video · <kbd>1</kbd>–<kbd>9</kbd> section · <kbd>M</kbd> music · <kbd>F</kbd> full screen · <kbd>H</kbd> hide controls' }),
    );
    menu.hidden = false;
    progressBtn.setAttribute('aria-expanded', 'true');
    menuBtn.setAttribute('aria-expanded', 'true');
    (menu.querySelector('[aria-current="step"]') || menu.querySelector('button'))?.focus();
  }
  function closeMenu() {
    if (menu.hidden) return;
    const hadFocus = menu.contains(document.activeElement);
    menu.hidden = true;
    progressBtn.setAttribute('aria-expanded', 'false');
    menuBtn.setAttribute('aria-expanded', 'false');
    if (hadFocus) progressBtn.focus({ preventScroll: true });
  }
  const toggleMenu = () => (menu.hidden ? openMenu() : closeMenu());
  progressBtn.addEventListener('click', toggleMenu);
  menuBtn.addEventListener('click', toggleMenu);
  document.addEventListener('pointerdown', (e) => {
    if (!menu.hidden && !menu.contains(e.target) && !progressBtn.contains(e.target) && !menuBtn.contains(e.target)) closeMenu();
  });

  prevBtn.addEventListener('click', prev);
  nextBtn.addEventListener('click', next);

  // ---- Music + full screen -------------------------------------------------------------
  musicBtn.addEventListener('click', () => music.toggle());
  muteBtn.addEventListener('click', () => music.setMuted(!music.muted));
  music.subscribe((st) => {
    musicBtn.disabled = !st.available;
    musicBtn.setAttribute('aria-pressed', String(st.on));
    musicBtn.classList.toggle('is-playing', st.on && !st.ducked);
    const what = st.title ? ` “${st.title}”` : '';
    musicBtn.setAttribute('aria-label', !st.available ? 'Music unavailable' : st.on ? `Pause music${what}` : `Play music${what}`);
    musicBtn.title = !st.available ? 'No music file found (see data/site.json → music.src)' : `${st.on ? 'Pause' : 'Play'} music  (M)`;
    muteBtn.disabled = !st.available;
    muteBtn.setAttribute('aria-pressed', String(st.muted));
    muteBtn.innerHTML = st.muted ? icons.mute : icons.volume;
    muteBtn.setAttribute('aria-label', st.muted ? 'Unmute music' : 'Mute music');
    muteBtn.title = st.muted ? 'Unmute music' : 'Mute music';
  });

  const toggleFullscreen = async () => {
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await document.documentElement.requestFullscreen?.();
    } catch { /* refused (e.g. inside a frame); nothing else to do */ }
  };
  fsBtn.addEventListener('click', toggleFullscreen);
  document.addEventListener('fullscreenchange', () => {
    const on = !!document.fullscreenElement;
    fsBtn.innerHTML = on ? icons.shrink : icons.expand;
    fsBtn.setAttribute('aria-label', on ? 'Exit full screen' : 'Full screen');
  });

  // ---- Keyboard ------------------------------------------------------------------------
  document.addEventListener('keydown', (e) => {
    if (e.defaultPrevented || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target instanceof Element ? e.target : document.body;
    if (document.querySelector('dialog[open]')) return;                  // photo viewer handles its own keys
    if (t.closest('input, textarea, select, [contenteditable]')) return;  // typing / sliders
    showControls();

    if (!menu.hidden && e.key === 'Escape') { e.preventDefault(); closeMenu(); return; }
    if (menu.contains(t) && (e.key === 'Enter' || e.key === ' ')) return; // choosing a section

    const inPlayer = !!t.closest('.player');
    const onControl = !!t.closest('button, a, [role="tab"]');
    const isClicker = CLICKER_KEYS.has(e.key);

    if (NAV_KEYS_NEXT.has(e.key) || NAV_KEYS_PREV.has(e.key)) {
      // Inside a video player the keys belong to the player (seek, play/pause),
      // except a presentation clicker, which always moves the presentation.
      if (inPlayer && !isClicker) return;
      // Space / Enter on a focused button press that button
      if ((e.key === ' ' || e.key === 'Enter') && onControl) return;
      // Arrow keys on tab lists move between tabs
      if (t.closest('[role="tablist"]') && !isClicker) return;
      e.preventDefault();
      if (e.repeat && !isClicker) return;
      (NAV_KEYS_NEXT.has(e.key) ? next : prev)();
      return;
    }
    const key = e.key.toLowerCase();
    if (inPlayer && ['m', 'f'].includes(key)) return; // the player's own mute / full screen
    if (key === 'home') { e.preventDefault(); go(0); }
    else if (key === 'end') { e.preventDefault(); go(scenes.length - 1); }
    else if (/^[1-9]$/.test(e.key) && Number(e.key) <= scenes.length) { e.preventDefault(); go(Number(e.key) - 1); }
    else if (key === 'm') { e.preventDefault(); music.toggle(); }
    else if (key === 'f') { e.preventDefault(); toggleFullscreen(); }
    else if (key === 'g') { e.preventDefault(); toggleMenu(); }
    else if (key === 'h') { e.preventDefault(); setControls(document.body.classList.contains('controls-hidden')); }
    else if (key === 'a') { e.preventDefault(); setAuto(!auto); }
    else if (key === 'escape' && inPlayer) { t.closest('.player').blur(); current().el.focus({ preventScroll: true }); }
  });

  // Swipe between scenes on touch screens (not on players, galleries or sliders)
  onSwipe(root, {
    left: () => next(),
    right: () => prev(),
    ignore: (target) => !!target.closest('.player, input, .no-swipe'),
  });

  // ---- Idle: controls step aside --------------------------------------------------------
  let idleTimer = 0;
  function setControls(visible) {
    document.body.classList.toggle('controls-hidden', !visible);
  }
  function showControls() {
    setControls(true);
    clearTimeout(idleTimer);
    if (isCoarsePointer()) return; // touch screens: keep the controls in reach
    idleTimer = setTimeout(() => {
      if (navBar.matches(':hover') || toolBar.matches(':hover') || !menu.hidden) return showControls();
      if (navBar.contains(document.activeElement) || toolBar.contains(document.activeElement)) document.activeElement.blur();
      setControls(false);
    }, IDLE_MS);
  }
  ['pointermove', 'pointerdown', 'wheel', 'touchstart'].forEach((ev) => addEventListener(ev, showControls, { passive: true }));

  // ---- Public API --------------------------------------------------------------------------
  return {
    add,
    go,
    next,
    prev,
    goTo: (id, opts) => go(scenes.findIndex((s) => s.id === id), opts),
    refresh: render,
    get current() { return current()?.id; },
    get autoplaying() { return auto; },
    setAuto,
    /** A scene that said 'wait' is done (a film ended, the cake was cut): move on soon. */
    autoAdvance(delay = 1500) {
      if (!auto) return;
      clearAuto();
      autoTimer = setTimeout(fireAuto, delay);
    },
    get index() { return index; },
    get scenes() { return scenes.map((s) => ({ id: s.id, title: s.title })); },
    on(fn) { listeners.add(fn); return () => listeners.delete(fn); },
    start(initialId) {
      root.classList.add('is-running');
      scenes.forEach((s, i) => {
        const active = initialId ? s.id === initialId : i === 0;
        s.el.classList.toggle('is-active', false);
        s.el.inert = !active;
        if (!active) s.el.setAttribute('aria-hidden', 'true');
      });
      const first = Math.max(0, scenes.findIndex((s) => s.id === initialId));
      index = first;
      go(first);
      showControls();
    },
  };
}
