import { h, icon, iconButton, catBadge } from '../dom.js';
import { t, fmtNum } from '../i18n.js';
import { PARTS, peekDay, partHasData, dailyHasData, medById, medLabel, emptyPart } from '../store.js';
import { addDays, parseDate, toKey, fmtDate, todayKey } from '../dates.js';
import { partAverage, exerciseMinutes } from '../bp.js';
import { topAppBar, PART_ICONS, MOOD_ICONS, showCats, partWarnings, warningBanner } from './common.js';

export function dayView({ params, navigate, goBack }) {
  const { date } = params;
  const day = peekDay(date);
  const shift = n => navigate(`#/day/${toKey(addDays(parseDate(date), n))}`, { replace: true });
  const isToday = date === todayKey();

  const warnings = new Set();
  const partCards = PARTS.map(p => {
    const part = day ? day.parts[p] : emptyPart();
    const avg = partAverage(part);
    partWarnings(part, avg).forEach(w => warnings.add(w));
    return partCard(p, part, avg, () => navigate(`#/day/${date}/${p}`));
  });

  const content = h(
    'div',
    { class: 'content' },
    [...warnings].map(warningBanner),
    partCards,
    dailyCard(day, () => navigate(`#/day/${date}/daily`)),
  );

  const title = fmtDate(date, { weekday: 'short', day: 'numeric', month: 'long' });
  return {
    el: h(
      'div',
      null,
      topAppBar(title, {
        back: () => goBack(`#/month/${date.slice(0, 7)}`),
        sub: isToday ? t.today : new Intl.DateTimeFormat(document.documentElement.lang, { year: 'numeric' }).format(parseDate(date)),
        actions: [iconButton('chevronLeft', t.prevDay, () => shift(-1)), iconButton('chevronRight', t.nextDay, () => shift(1))],
      }),
      content,
    ),
  };
}

function partCard(p, part, avg, onclick) {
  const has = partHasData(part);
  const body = [];
  if (!has) {
    body.push(h('p', { class: 'hint' }, t.notFilled));
  } else {
    if (avg) {
      body.push(
        h(
          'div',
          { class: 'row' },
          h('span', { class: 'bp-big' }, `${avg.sys}/${avg.dia}`),
          h('span', { class: 'bp-unit' }, t.mmHg),
          showCats() ? catBadge(avg.category) : null,
        ),
      );
      const sub = [t.averageOf(avg.n)];
      if (avg.pulse) sub.push(`${t.pulseShort} ${avg.pulse} ${t.bpm}`);
      body.push(h('div', { class: 'summary-line' }, sub.join(' · ')));
    }
    const chips = [];
    if (part.mood != null) chips.push(h('span', { class: 'chip small static' }, icon(MOOD_ICONS[part.mood - 1], 's18'), t.moods[part.mood - 1]));
    if (part.stress != null) chips.push(h('span', { class: 'chip small static' }, `${t.stress}: ${t.stressLevels[part.stress - 1].toLowerCase()}`));
    for (const [c, sev] of Object.entries(part.complaints)) {
      chips.push(h('span', { class: 'chip small static' }, `${t.complaints[c]} (${t.severities[sev - 1].toLowerCase()})`));
    }
    const medEntries = Object.entries(part.meds || {});
    if (medEntries.length) {
      const taken = medEntries.filter(([, v]) => v === true).length;
      chips.push(h('span', { class: 'chip small static', title: medEntries.map(([id, v]) => `${medLabel(medById(id))}: ${v ? t.medTaken : t.medSkipped}`).join('\n') }, icon('pill', 's18'), t.medsTakenCount(taken, medEntries.length)));
    }
    if (part.sideEffects.trim()) chips.push(h('span', { class: 'chip small static' }, `${t.sideEffectsTitle}: ${part.sideEffects.trim()}`));
    if (chips.length) body.push(h('div', { class: 'summary-chips' }, chips));
    if (part.note.trim()) body.push(h('p', { class: 'body-m', style: { margin: '8px 0 0', whiteSpace: 'pre-wrap' } }, part.note.trim()));
  }
  return h(
    'section',
    { class: `card ${has ? 'elevated' : 'outlined'} tappable part-card`, role: 'button', tabindex: '0', onclick, onkeydown: e => (e.key === 'Enter' || e.key === ' ') && onclick() },
    h(
      'div',
      { class: 'card-head', style: { marginBottom: has ? '8px' : '4px' } },
      h('span', { class: 'lead' }, icon(PART_ICONS[p])),
      h('div', { class: 'grow' }, h('h2', { class: 'title-m' }, t.parts[p])),
      icon(has ? 'pencil' : 'plus', 's20'),
    ),
    body,
  );
}

function dailyCard(day, onclick) {
  const has = dailyHasData(day);
  const lines = [];
  if (has) {
    if (day.sleepHours != null || day.sleepQuality != null) {
      const s = [];
      if (day.sleepHours != null) s.push(t.sleepShort(day.sleepHours));
      if (day.sleepQuality != null) s.push(t.sleepQualities[day.sleepQuality - 1].toLowerCase());
      lines.push(['sleep', s.join(', ')]);
    }
    const mins = exerciseMinutes(day);
    if (mins || day.steps != null) {
      const s = [];
      if (mins) s.push(`${t.exerciseShort(mins)} (${day.activities.filter(a => a.minutes).map(a => t.activities[a.type] || t.activities.other).join(', ')})`);
      if (day.steps != null) s.push(`${fmtNum(day.steps, 0)} ${t.steps.toLowerCase()}`);
      lines.push(['run', s.join(' · ')]);
    }
    const intake = [];
    if (day.salt) intake.push(`${t.salt}: ${t.saltLevels[day.salt].toLowerCase()}`);
    if (day.alcohol != null) intake.push(`${shortLabel(t.alcohol)}: ${day.alcohol}`);
    if (day.caffeine != null) intake.push(`${shortLabel(t.caffeine)}: ${day.caffeine}`);
    if (intake.length) lines.push(['coffee', intake.join(' · ')]);
    if (day.weight != null) lines.push(['scaleBathroom', `${fmtNum(day.weight)} kg`]);
    if (day.note.trim()) lines.push(['noteTextOutline', day.note.trim()]);
  }
  return h(
    'section',
    { class: `card ${has ? 'elevated' : 'outlined'} tappable`, role: 'button', tabindex: '0', onclick, onkeydown: e => (e.key === 'Enter' || e.key === ' ') && onclick() },
    h(
      'div',
      { class: 'card-head', style: { marginBottom: '8px' } },
      h('span', { class: 'lead' }, icon('heartPulse')),
      h('div', { class: 'grow' }, h('h2', { class: 'title-m' }, t.dayAndLifestyle)),
      icon(has ? 'pencil' : 'plus', 's20'),
    ),
    has ? h('div', { class: 'stack', style: { gap: '6px' } }, lines.map(([ic, text]) => h('div', { class: 'summary-line' }, icon(ic, 's18'), h('span', { style: { whiteSpace: 'pre-wrap' } }, text)))) : h('p', { class: 'hint' }, t.notFilled),
  );
}

/** 'Alcohol (glazen)' → 'Alcohol' */
export function shortLabel(label) {
  return label.split(' (')[0];
}
