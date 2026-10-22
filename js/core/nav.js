// Site navigation: chapter links, active-chapter tracking, mobile menu,
// reading progress, music toggle and "presentation mode" for the venue screen
// (press P, or use the screen button; Esc leaves full screen).

import { $, $$, h, icons, announce } from './util.js';
import { music } from './audio.js';
import { BASE } from './data.js';

export const SECTIONS = [
  { id: 'welcome', label: 'Welcome', page: 'welcome.html' },
  { id: 'journey', label: 'Life Journey', page: 'journey.html' },
  { id: 'reasons', label: '50 Reasons', page: 'reasons.html' },
  { id: 'memories', label: 'Memories', page: 'memories.html' },
  { id: 'wishes', label: 'Wishes', page: 'wishes.html' },
  { id: 'age', label: 'Age 1 to 50', page: 'age-transition.html' },
  { id: 'finale', label: 'Celebration', page: 'finale.html' },
];

/** On index.html every chapter is an anchor; on pages/*.html, a sibling page. */
export const isStandalone = () => BASE !== '';
export const hrefFor = (id) => {
  const s = SECTIONS.find((x) => x.id === id);
  return isStandalone() ? s.page : `#${id}`;
};
export const fullExperienceHref = (id) => (isStandalone() ? `../index.html${id ? `#${id}` : ''}` : `#${id || 'welcome'}`);

export function setupNav(mount) {
  if (!mount) return;
  const current = document.body.dataset.page;
  const links = h('ul', { class: 'nav-links', id: 'nav-links' },
    SECTIONS.map((s) => h('li', {},
      h('a', { href: hrefFor(s.id), 'data-target': s.id, 'aria-current': isStandalone() && s.id === current ? 'page' : null }, s.label),
    )),
  );
  const musicBtn = h('button', { class: 'icon-btn', type: 'button', 'aria-pressed': 'false', 'aria-label': 'Play soft music', title: 'Music', html: icons.music });
  const presentBtn = h('button', { class: 'icon-btn', type: 'button', 'data-present': '', 'aria-pressed': 'false', 'aria-label': 'Presentation mode (full screen)', title: 'Presentation mode — press P', html: icons.screen });
  const menuBtn = h('button', { class: 'icon-btn nav-toggle', type: 'button', 'aria-expanded': 'false', 'aria-controls': 'nav-links', 'aria-label': 'Open chapter menu', html: icons.menu });

  mount.replaceChildren(
    h('nav', { class: 'site-nav__inner', 'aria-label': 'Chapters' },
      h('a', { class: 'brand', href: isStandalone() ? '../index.html' : '#welcome' },
        h('span', { class: 'brand__mark', 'aria-hidden': 'true' }, '50'),
        h('span', { class: 'brand__name' }, 'Buvana', h('small', {}, 'Fifty years of love')),
      ),
      links,
      h('div', { class: 'nav-tools' }, musicBtn, presentBtn, menuBtn),
    ),
  );

  // Music
  musicBtn.addEventListener('click', () => music.toggle());
  music.subscribe((on) => {
    musicBtn.setAttribute('aria-pressed', String(on));
    musicBtn.setAttribute('aria-label', on ? 'Pause music' : 'Play soft music');
    musicBtn.classList.toggle('is-playing', on);
  });

  // Mobile menu
  const setMenu = (open) => {
    links.classList.toggle('is-open', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    menuBtn.setAttribute('aria-label', open ? 'Close chapter menu' : 'Open chapter menu');
    menuBtn.innerHTML = open ? icons.close : icons.menu;
  };
  menuBtn.addEventListener('click', () => setMenu(!links.classList.contains('is-open')));
  links.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && links.classList.contains('is-open')) { setMenu(false); menuBtn.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (links.classList.contains('is-open') && !mount.contains(e.target)) setMenu(false);
  });

  // Presentation mode
  const setPresenting = async (on) => {
    document.body.classList.toggle('is-presenting', on);
    presentBtn.setAttribute('aria-pressed', String(on));
    try {
      if (on && !document.fullscreenElement) await document.documentElement.requestFullscreen?.();
      if (!on && document.fullscreenElement === document.documentElement) await document.exitFullscreen();
    } catch { /* full screen may be refused; the chrome is still hidden */ }
    announce(on ? 'Presentation mode on. Press P or Escape to leave.' : 'Presentation mode off.');
  };
  presentBtn.addEventListener('click', () => setPresenting(!document.body.classList.contains('is-presenting')));
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && document.body.classList.contains('is-presenting')) {
      document.body.classList.remove('is-presenting');
      presentBtn.setAttribute('aria-pressed', 'false');
    }
  });
  document.addEventListener('keydown', (e) => {
    if (e.key.toLowerCase() !== 'p' || e.ctrlKey || e.metaKey || e.altKey) return;
    if (e.target.closest('input, textarea, select, [contenteditable], dialog')) return;
    setPresenting(!document.body.classList.contains('is-presenting'));
  });

  // Solid background + reading progress
  const bar = $('.read-progress span');
  let ticking = false;
  const onScroll = () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      ticking = false;
      mount.classList.toggle('is-solid', scrollY > 40);
      const max = document.documentElement.scrollHeight - innerHeight;
      if (bar) bar.style.transform = `scaleX(${max > 0 ? Math.min(1, scrollY / max) : 0})`;
    });
  };
  addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  // Highlight the chapter currently on screen (single-page experience only)
  if (!isStandalone()) {
    const anchors = $$('a[data-target]', links);
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        anchors.forEach((a) => (a.dataset.target === entry.target.id ? a.setAttribute('aria-current', 'true') : a.removeAttribute('aria-current')));
      });
    }, { rootMargin: '-45% 0px -50% 0px' });
    SECTIONS.forEach((s) => { const el = document.getElementById(s.id); if (el) io.observe(el); });
  }
}
