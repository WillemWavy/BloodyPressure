import { h, icon, iconButton, button, catBadge } from '../dom.js';
import { t } from '../i18n.js';
import { state, PARTS, partHasData, dayHasData, dailyHasData, save } from '../store.js';
import { todayKey, toKey, weekdayNames, fmtMonth, currentPart } from '../dates.js';
import { dayWorstCategory, stats, daysInRange, CATEGORIES, classify } from '../bp.js';
import { topAppBar, showCats, bpText } from './common.js';
import { stackedBar, screenPalette } from '../charts.js';

export function calendarView({ params, navigate }) {
  const today = todayKey();
  let year;
  let month;
  if (params.month) {
    [year, month] = params.month.split('-').map(Number);
    month -= 1;
  } else {
    const d = new Date();
    year = d.getFullYear();
    month = d.getMonth();
  }
  const monthKey = (y, m) => {
    const d = new Date(y, m, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
  };
  const go = delta => navigate(`#/month/${monthKey(year, month + delta)}`, { replace: true });
  const isCurrentMonth = monthKey(year, month) === today.slice(0, 7);

  // Raster
  const first = new Date(year, month, 1);
  const offset = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const grid = h('div', { class: 'cal-grid', role: 'grid' }, weekdayNames().map(w => h('div', { class: 'wd', role: 'columnheader' }, w)));
  for (let i = 0; i < offset; i++) grid.appendChild(h('div'));
  for (let d = 1; d <= daysInMonth; d++) {
    const key = toKey(new Date(year, month, d));
    const day = state.days[key];
    const has = dayHasData(day);
    const cat = has && showCats() ? dayWorstCategory(day) : null;
    const cls = ['cal-day'];
    if (has) cls.push('has-data');
    if (cat) cls.push(`cat-${cat}`);
    if (key === today) cls.push('today');
    if (key > today) cls.push('future');
    const dots = h(
      'span',
      { class: 'dots', 'aria-hidden': 'true' },
      has ? PARTS.map(p => h('span', { class: partHasData(day.parts[p]) ? 'on' : '' })) : null,
    );
    const label = [new Intl.DateTimeFormat(document.documentElement.lang, { day: 'numeric', month: 'long' }).format(new Date(year, month, d))];
    if (cat) label.push(t.categories[cat]);
    grid.appendChild(
      h('button', { type: 'button', class: cls.join(' '), 'aria-label': label.join(', '), onclick: () => navigate(`#/day/${key}`) }, h('span', { class: 'num' }, d), dots),
    );
  }

  const calCard = h(
    'section',
    { class: 'card elevated' },
    h(
      'div',
      { class: 'cal-head' },
      h('div', { class: 'month' }, fmtMonth(year, month)),
      isCurrentMonth ? null : button(t.today, () => navigate('#/', { replace: true })),
      iconButton('chevronLeft', t.prevMonth, () => go(-1)),
      iconButton('chevronRight', t.nextMonth, () => go(1)),
    ),
    grid,
  );

  // Samenvatting van de maand
  const from = `${monthKey(year, month)}-01`;
  const to = `${monthKey(year, month)}-${String(daysInMonth).padStart(2, '0')}`;
  const s = stats(daysInRange(from, to));
  let summary;
  if (!s.measuredParts) {
    summary = h('p', { class: 'hint' }, t.noReadingsMonth);
  } else {
    const avgCat = showCats() && s.avg ? catBadge(classify(s.avg.sys, s.avg.dia)) : null;
    const pal = screenPalette();
    summary = h(
      'div',
      { class: 'stack' },
      h(
        'div',
        { class: 'row' },
        h('span', { class: 'headline-m tnum' }, bpText(s.avg)),
        h('span', { class: 'muted body-m' }, t.mmHg),
        avgCat,
        h('span', { class: 'spacer' }),
        h('span', { class: 'muted body-m' }, t.daysMeasured(s.daysWithReadings)),
      ),
      showCats()
        ? h(
            'div',
            { class: 'chart', style: { height: '12px' } },
            stackedBar({ segments: CATEGORIES.map(c => ({ value: s.categoryCounts[c], color: pal.cat[c] })), width: 600, height: 12, pal }),
          )
        : null,
    );
  }

  const legend = showCats()
    ? h('div', { class: 'stack' }, h('div', { class: 'label-l muted' }, t.legend), h('div', { class: 'legend' }, CATEGORIES.map(c => h('span', { class: `cat-badge cat-${c}`, title: t.categoryRanges[c] }, `${t.categories[c]} · ${t.categoryRanges[c]}`))))
    : null;

  const content = h(
    'div',
    { class: 'content' },
    backupNudge(navigate),
    calCard,
    h('section', { class: 'card' }, h('h2', { class: 'title-m', style: { marginBottom: '8px' } }, t.monthSummary), summary),
    legend,
  );

  const fab = h(
    'button',
    { type: 'button', class: 'fab', onclick: () => navigate(`#/day/${today}/${currentPart()}`) },
    icon('plus'),
    t.fillToday,
  );

  return {
    el: h('div', null, topAppBar(t.appName, { brand: true }), content),
    fab,
  };
}


function backupNudge(navigate) {
  const days = Object.values(state.days).filter(d => dayHasData(d) || dailyHasData(d)).length;
  if (days < 5) return null;
  const now = Date.now();
  const month = 30 * 24 * 3600 * 1000;
  const last = state.settings.lastBackup ? Date.parse(state.settings.lastBackup) : 0;
  const dismissed = state.settings.nudgeDismissed ? Date.parse(state.settings.nudgeDismissed) : 0;
  if (now - last < month || now - dismissed < month / 2) return null;
  const banner = h(
    'div',
    { class: 'banner tertiary' },
    icon('shieldCheckOutline'),
    h(
      'div',
      { class: 'grow' },
      t.backupNudge,
      h(
        'div',
        { class: 'actions' },
        button(t.later, () => {
          state.settings.nudgeDismissed = new Date().toISOString();
          save();
          banner.remove();
        }),
        button(t.backupMake, () => navigate('#/more')),
      ),
    ),
  );
  return banner;
}
