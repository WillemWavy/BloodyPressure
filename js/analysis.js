// Grafieken voor trends en het PDF-rapport (zelfde inhoud, ander palet en formaat).
import { t } from './i18n.js';
import { state, PARTS } from './store.js';
import { lineChart, barChart } from './charts.js';
import { dailySeries, weeklyExercise, CATEGORIES } from './bp.js';
import { fmtShort } from './dates.js';

function toMap(series, key) {
  const m = {};
  for (const s of series) if (s[key] !== null && s[key] !== undefined && !Number.isNaN(s[key])) m[s.date] = s[key];
  return m;
}

export function hasAny(series, key) {
  return series.some(s => s[key] !== null && s[key] !== undefined && !Number.isNaN(s[key]));
}

export function bpChart({ from, to, days, pal, width, height = 230, showBands = true }) {
  const series = dailySeries(days);
  const bands = showBands
    ? [
        { from: 135, to: 400, color: pal.cat.high, opacity: 0.08 },
        { from: 120, to: 135, color: pal.cat.elevated, opacity: 0.07 },
      ]
    : [];
  return lineChart({
    from,
    to,
    width,
    height,
    pal,
    series: [
      { color: pal.sys, values: toMap(series, 'sys') },
      { color: pal.dia, values: toMap(series, 'dia') },
    ],
    refLines: [
      { y: state.settings.targetSys, color: pal.sys },
      { y: state.settings.targetDia, color: pal.dia },
    ],
    bands,
  });
}

export function bpLegend(pal) {
  return [
    { color: pal.sys, label: t.systolicLong, type: 'line' },
    { color: pal.dia, label: t.diastolicLong, type: 'line' },
    { color: pal.target, label: `${t.target} ${state.settings.targetSys}/${state.settings.targetDia}`, type: 'dash' },
  ];
}

export function partsChart({ stats, pal, width, height = 200 }) {
  return barChart({
    width,
    height,
    pal,
    yMin: 40,
    groups: PARTS.map(p => ({
      label: t.parts[p],
      bars: [
        { value: stats.byPart[p]?.sys ?? null, color: pal.sys },
        { value: stats.byPart[p]?.dia ?? null, color: pal.dia },
      ],
    })),
  });
}

export function pulseChart({ from, to, days, pal, width, height = 180 }) {
  const series = dailySeries(days);
  return lineChart({ from, to, width, height, pal, series: [{ color: pal.pulse, values: toMap(series, 'pulse') }] });
}

export function moodChart({ from, to, days, pal, width, height = 180 }) {
  const series = dailySeries(days);
  return lineChart({
    from,
    to,
    width,
    height,
    pal,
    yMin: 1,
    yMax: 5,
    series: [
      { color: pal.mood, values: toMap(series, 'mood') },
      { color: pal.stress, values: toMap(series, 'stress'), dashed: true },
    ],
    yFormat: v => (Number.isInteger(v) ? String(v) : ''),
  });
}

export function moodLegend(pal) {
  return [
    { color: pal.mood, label: `${t.mood} (1 = ${t.moods[0].toLowerCase()}, 5 = ${t.moods[4].toLowerCase()})`, type: 'line' },
    { color: pal.stress, label: `${t.stress} (1 = ${t.stressLevels[0].toLowerCase()}, 5 = ${t.stressLevels[4].toLowerCase()})`, type: 'dash' },
  ];
}

export function exerciseChart({ from, to, pal, width, height = 180 }) {
  const weeks = weeklyExercise(from, to);
  return barChart({
    width,
    height,
    pal,
    refLines: [{ y: 150, color: pal.target }],
    groups: weeks.map(w => ({ label: fmtShort(w.start), bars: [{ value: w.minutes, color: pal.mood }] })),
    valueLabels: weeks.length <= 8,
  });
}

export function sleepChart({ from, to, days, pal, width, height = 170 }) {
  const series = dailySeries(days);
  return lineChart({ from, to, width, height, pal, yMin: 0, series: [{ color: pal.dia, values: toMap(series, 'sleep') }], refLines: [{ y: 7, color: pal.target }] });
}

export function weightChart({ from, to, days, pal, width, height = 170 }) {
  const series = dailySeries(days);
  return lineChart({ from, to, width, height, pal, series: [{ color: pal.primary, values: toMap(series, 'weight') }] });
}

export function categoryRows(stats) {
  const total = CATEGORIES.reduce((s, c) => s + stats.categoryCounts[c], 0);
  return CATEGORIES.filter(c => stats.categoryCounts[c] > 0).map(c => ({
    category: c,
    count: stats.categoryCounts[c],
    pct: total ? Math.round((stats.categoryCounts[c] / total) * 100) : 0,
  }));
}
