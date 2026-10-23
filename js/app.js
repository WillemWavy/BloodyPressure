// Bloody Pressure — opstarten, thema, navigatie.
import { h, icon, snackbar } from './dom.js';
import { t, setLang, resolveLang } from './i18n.js';
import { load, state, flush, isMemoryOnly } from './store.js';
import { isValidKey, todayKey } from './dates.js';
import { calendarView } from './views/calendar.js';
import { dayView } from './views/day.js';
import { partView } from './views/part.js';
import { dailyView } from './views/daily.js';
import { trendsView } from './views/trends.js';
import { reportView } from './views/report.js';
import { moreView } from './views/more.js';
import { medsView } from './views/meds.js';
import { aboutView } from './views/about.js';

const root = document.getElementById('app');
let current = null;
let lastHash = '';
let prevHash = '';

export function applyTheme() {
  const theme = state.settings.theme;
  if (theme === 'light' || theme === 'dark') document.documentElement.dataset.theme = theme;
  else delete document.documentElement.dataset.theme;
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', getComputedStyle(document.documentElement).getPropertyValue('--surface').trim());
}

export function applyLang() {
  setLang(resolveLang(state.settings.lang));
}

export function navigate(hash, { replace = false } = {}) {
  if (replace) {
    history.replaceState(null, '', hash);
    route();
  } else {
    location.hash = hash;
  }
}

/** Terug naar het bovenliggende scherm; gebruikt de browsergeschiedenis als die daar vandaan kwam. */
export function goBack(parentHash) {
  if (prevHash === parentHash) history.back();
  else navigate(parentHash, { replace: true });
}

const NAV = [
  { key: 'calendar', hash: '#/', icon: 'calendarMonthOutline', iconActive: 'calendarMonth', label: () => t.navCalendar },
  { key: 'trends', hash: '#/trends', icon: 'chartLine', iconActive: 'chartLine', label: () => t.navTrends },
  { key: 'report', hash: '#/report', icon: 'filePdfBox', iconActive: 'filePdfBox', label: () => t.navReport },
  { key: 'more', hash: '#/more', icon: 'cogOutline', iconActive: 'cog', label: () => t.navMore },
];

function navItems(active) {
  return NAV.map(n =>
    h(
      'a',
      { class: `nav-item ${n.key === active ? 'active' : ''}`, href: n.hash, 'aria-current': n.key === active ? 'page' : null },
      h('span', { class: 'indicator' }, icon(n.key === active ? n.iconActive : n.icon)),
      h('span', null, n.label()),
    ),
  );
}

function parseRoute() {
  const hash = location.hash.replace(/^#\/?/, '');
  const parts = hash.split('/').filter(Boolean);
  const [a, b, c] = parts;
  if (!a) return { view: calendarView, nav: 'calendar', params: {} };
  if (a === 'day' && isValidKey(b)) {
    if (!c) return { view: dayView, nav: 'calendar', params: { date: b }, sub: true };
    if (c === 'daily') return { view: dailyView, nav: 'calendar', params: { date: b }, sub: true, full: true };
    if (['morning', 'afternoon', 'evening'].includes(c)) return { view: partView, nav: 'calendar', params: { date: b, part: c }, sub: true, full: true };
  }
  if (a === 'month' && /^\d{4}-\d{2}$/.test(b || '')) return { view: calendarView, nav: 'calendar', params: { month: b } };
  if (a === 'trends') return { view: trendsView, nav: 'trends', params: {} };
  if (a === 'report') return { view: reportView, nav: 'report', params: {} };
  if (a === 'more') return { view: moreView, nav: 'more', params: {} };
  if (a === 'meds') return { view: medsView, nav: 'more', params: {}, sub: true };
  if (a === 'about') return { view: aboutView, nav: 'more', params: {}, sub: true };
  if (a === 'today') return { redirect: `#/day/${todayKey()}` };
  return { view: calendarView, nav: 'calendar', params: {} };
}

export function route() {
  flush();
  const r = parseRoute();
  if (r.redirect) {
    navigate(r.redirect, { replace: true });
    return;
  }
  prevHash = lastHash;
  lastHash = location.hash || '#/';
  if (current && current.cleanup) current.cleanup();

  const ctx = { params: r.params, navigate, goBack, rerender: route };
  const view = r.view(ctx);
  current = view;

  const main = h('main', { class: `main ${r.full ? 'no-nav' : ''} ${view.fab ? 'has-fab' : ''}`, id: 'main' }, view.el);
  const rail = h('nav', { class: 'nav-rail', 'aria-label': 'Navigatie' }, h('img', { class: 'rail-logo', src: 'icons/icon-192.png', alt: '' }), navItems(r.nav));
  const bar = r.full ? null : h('nav', { class: 'nav-bar', 'aria-label': 'Navigatie' }, navItems(r.nav));
  root.replaceChildren(...[h('div', { class: 'shell' }, rail, main), bar, view.fab].filter(Boolean));

  window.scrollTo(0, 0);
  updateScrolled();
  if (view.mounted) view.mounted();
  const heading = main.querySelector('.top-app-bar .title');
  if (heading) heading.setAttribute('tabindex', '-1');
}

function updateScrolled() {
  const bar = document.querySelector('.top-app-bar');
  if (bar) bar.classList.toggle('scrolled', window.scrollY > 4);
}

// ---------- Installeren als app en updates ----------

export let installPrompt = null;
window.addEventListener('beforeinstallprompt', e => {
  e.preventDefault();
  installPrompt = e;
});

function registerServiceWorker() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  navigator.serviceWorker
    .register('sw.js')
    .then(reg => {
      reg.addEventListener('updatefound', () => {
        const nw = reg.installing;
        if (!nw) return;
        nw.addEventListener('statechange', () => {
          if (nw.state === 'installed' && navigator.serviceWorker.controller) {
            snackbar(t.updateReady, { label: t.reload, onclick: () => nw.postMessage('skipWaiting') }, 0);
          }
        });
      });
    })
    .catch(() => {});
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (reloading) return;
    reloading = true;
    location.reload();
  });
}

async function start() {
  await load();
  applyLang();
  applyTheme();
  window.addEventListener('hashchange', route);
  window.addEventListener('scroll', updateScrolled, { passive: true });
  window.addEventListener('pagehide', () => flush());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush();
  });
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    applyTheme();
    route();
  });
  route();
  if (isMemoryOnly()) snackbar(t.storageWarning, null, 10000);
  registerServiceWorker();
}

start();
