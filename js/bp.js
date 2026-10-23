// Berekeningen: indeling, gemiddelden, trends en verbanden.
import { state, PARTS, partHasData, dailyHasData } from './store.js';
import { addDays, parseDate, toKey } from './dates.js';

export const CATEGORIES = ['low', 'normal', 'elevated', 'high', 'severe'];

/**
 * Indeling voor thuismetingen, gebaseerd op de ESC-richtlijn 2024:
 * niet verhoogd < 120/70, verhoogd 120–134 / 70–84, hypertensie ≥ 135/85.
 * Daarnaast 'zeer hoog' (≥ 180/110) en 'laag' (< 90/60) als signaal.
 */
export function classify(sys, dia) {
  if (!sys && !dia) return null;
  sys = sys || 0;
  dia = dia || 0;
  if (sys >= 180 || dia >= 110) return 'severe';
  if (sys >= 135 || dia >= 85) return 'high';
  if (sys >= 120 || dia >= 70) return 'elevated';
  if ((sys && sys < 90) || (dia && dia < 60)) return 'low';
  return 'normal';
}

export const severityRank = { low: 1, normal: 0, elevated: 2, high: 3, severe: 4 };

export function validReadings(part) {
  return (part?.readings || []).filter(r => r.sys > 0 && r.dia > 0);
}

function mean(values) {
  const v = values.filter(x => x !== null && x !== undefined && !Number.isNaN(x));
  if (!v.length) return null;
  return v.reduce((a, b) => a + b, 0) / v.length;
}

export function round(n) {
  return n === null || n === undefined ? null : Math.round(n);
}

/** Gemiddelde van de metingen in één dagdeel. */
export function partAverage(part) {
  const rs = validReadings(part);
  if (!rs.length) return null;
  const sys = mean(rs.map(r => r.sys));
  const dia = mean(rs.map(r => r.dia));
  const pulse = mean(rs.map(r => r.pulse || null));
  return { sys: round(sys), dia: round(dia), pulse: round(pulse), n: rs.length, category: classify(round(sys), round(dia)) };
}

/** Gemiddelde over alle dagdelen van een dag (elk dagdeel telt één keer mee). */
export function dayAverage(day) {
  if (!day) return null;
  const avgs = PARTS.map(p => partAverage(day.parts[p])).filter(Boolean);
  if (!avgs.length) return null;
  const sys = round(mean(avgs.map(a => a.sys)));
  const dia = round(mean(avgs.map(a => a.dia)));
  return { sys, dia, pulse: round(mean(avgs.map(a => a.pulse))), parts: avgs.length, category: classify(sys, dia) };
}

/** Zwaarste indeling van de dag (voor de kalender). */
export function dayWorstCategory(day) {
  let worst = null;
  for (const p of PARTS) {
    const a = partAverage(day.parts[p]);
    if (a && (worst === null || severityRank[a.category] > severityRank[worst])) worst = a.category;
  }
  return worst;
}

export function inTarget(avg) {
  if (!avg) return null;
  return avg.sys <= state.settings.targetSys && avg.dia <= state.settings.targetDia;
}

export function exerciseMinutes(day) {
  return (day?.activities || []).reduce((s, a) => s + (Number(a.minutes) || 0), 0);
}

export function dayMood(day) {
  return mean(PARTS.map(p => day.parts[p].mood));
}

export function dayStress(day) {
  return mean(PARTS.map(p => day.parts[p].stress));
}

/** Medicatie-innames van een dag: { taken, skipped }. */
export function dayMedCounts(day) {
  let taken = 0;
  let skipped = 0;
  for (const p of PARTS) {
    for (const v of Object.values(day.parts[p].meds || {})) {
      if (v === true) taken++;
      else if (v === false) skipped++;
    }
  }
  return { taken, skipped };
}

// ---------- Periodes ----------

export function allDayKeys() {
  return Object.keys(state.days).sort();
}

export function periodRange(period, todayKey) {
  const keys = allDayKeys();
  const first = keys[0] || todayKey;
  const map = { d7: 6, d30: 29, d90: 89, y1: 364, w2: 13 };
  if (period === 'all') return { from: first < todayKey ? first : todayKey, to: todayKey };
  if (period === 'month') return { from: todayKey.slice(0, 8) + '01', to: todayKey };
  return { from: toKey(addDays(parseDate(todayKey), -map[period])), to: todayKey };
}

export function daysInRange(from, to) {
  return allDayKeys()
    .filter(k => k >= from && k <= to)
    .map(k => state.days[k]);
}

// ---------- Statistiek voor trends en rapport ----------

export function stats(days) {
  const partAvgs = [];
  const byPart = { morning: [], afternoon: [], evening: [] };
  const categoryCounts = Object.fromEntries(CATEGORIES.map(c => [c, 0]));
  const complaintCounts = {};
  let readings = 0;
  let pulses = [];
  let targetHits = 0;
  let max = null;
  let min = null;
  let daysWithReadings = 0;

  for (const day of days) {
    let dayHas = false;
    for (const p of PARTS) {
      const part = day.parts[p];
      const avg = partAverage(part);
      for (const c of Object.keys(part.complaints || {})) complaintCounts[c] = (complaintCounts[c] || 0) + 1;
      if (!avg) continue;
      dayHas = true;
      readings += avg.n;
      partAvgs.push(avg);
      byPart[p].push(avg);
      categoryCounts[avg.category]++;
      if (avg.pulse) pulses.push(avg.pulse);
      if (inTarget(avg)) targetHits++;
      for (const r of validReadings(part)) {
        if (!max || r.sys > max.sys || (r.sys === max.sys && r.dia > max.dia)) max = { ...r, date: day.date, part: p };
        if (!min || r.sys < min.sys || (r.sys === min.sys && r.dia < min.dia)) min = { ...r, date: day.date, part: p };
      }
    }
    if (dayHas) daysWithReadings++;
  }

  const avgOf = list =>
    list.length ? { sys: round(mean(list.map(a => a.sys))), dia: round(mean(list.map(a => a.dia))), pulse: round(mean(list.map(a => a.pulse))), n: list.length } : null;

  // Medicatietrouw per medicijn
  const adherence = {};
  for (const day of days) {
    for (const p of PARTS) {
      for (const [id, v] of Object.entries(day.parts[p].meds || {})) {
        adherence[id] = adherence[id] || { taken: 0, skipped: 0 };
        if (v === true) adherence[id].taken++;
        else if (v === false) adherence[id].skipped++;
      }
    }
  }

  return {
    days: days.length,
    daysWithReadings,
    readings,
    measuredParts: partAvgs.length,
    avg: avgOf(partAvgs),
    byPart: { morning: avgOf(byPart.morning), afternoon: avgOf(byPart.afternoon), evening: avgOf(byPart.evening) },
    pulse: round(mean(pulses)),
    pctTarget: partAvgs.length ? Math.round((targetHits / partAvgs.length) * 100) : null,
    categoryCounts,
    complaintCounts,
    adherence,
    max,
    min,
  };
}

/** Reeksen per dag voor de grafieken. */
export function dailySeries(days) {
  return days.map(day => {
    const avg = dayAverage(day);
    return {
      date: day.date,
      sys: avg?.sys ?? null,
      dia: avg?.dia ?? null,
      pulse: avg?.pulse ?? null,
      mood: dayMood(day),
      stress: dayStress(day),
      sleep: day.sleepHours,
      exercise: dailyHasData(day) || day.activities.length ? exerciseMinutes(day) : null,
      weight: day.weight,
    };
  });
}

/** Beweging per week (maandag als start). */
export function weeklyExercise(from, to) {
  const weeks = [];
  let d = parseDate(from);
  const dow = (d.getDay() + 6) % 7;
  d = addDays(d, -dow);
  const end = parseDate(to);
  while (d <= end) {
    const start = toKey(d);
    let minutes = 0;
    for (let i = 0; i < 7; i++) {
      const k = toKey(addDays(d, i));
      if (k < from || k > to) continue;
      const day = state.days[k];
      if (day) minutes += exerciseMinutes(day);
    }
    weeks.push({ start, minutes });
    d = addDays(d, 7);
  }
  return weeks;
}

// ---------- Verbanden ----------

const MIN_GROUP = 3;

function compare(days, predicate) {
  const yes = [];
  const no = [];
  for (const day of days) {
    const avg = dayAverage(day);
    if (!avg) continue;
    const r = predicate(day);
    if (r === true) yes.push(avg.sys);
    else if (r === false) no.push(avg.sys);
  }
  if (yes.length < MIN_GROUP || no.length < MIN_GROUP) return null;
  const a = round(mean(yes));
  const b = round(mean(no));
  return { a, b, diff: a - b, na: yes.length, nb: no.length };
}

/**
 * Vergelijkt de gemiddelde bovendruk tussen groepen dagen (of dagdelen).
 * Geeft alleen vergelijkingen terug met genoeg dagen in beide groepen.
 */
export function insights(days) {
  const out = [];
  const add = (key, res, label) => res && out.push({ key, label, ...res });

  add('exercise', compare(days, d => (d.activities.length || d.steps != null || dailyHasData(d) ? exerciseMinutes(d) >= 30 : undefined)));
  add('sleep', compare(days, d => (d.sleepHours == null ? undefined : d.sleepHours >= 7)));
  add('saltHigh', compare(days, d => (d.salt == null ? undefined : d.salt === 'high')));
  add('alcohol', compare(days, d => (d.alcohol == null ? undefined : d.alcohol > 0)));
  add('caffeine', compare(days, d => (d.caffeine == null ? undefined : d.caffeine >= 3)));
  add('stress', compare(days, d => {
    const s = dayStress(d);
    return s == null ? undefined : s >= 4;
  }));
  add('medsMissed', compare(days, d => {
    const c = dayMedCounts(d);
    return c.taken + c.skipped === 0 ? undefined : c.skipped > 0;
  }));

  // Klachten per dagdeel: bovendruk in dagdelen met en zonder de klacht
  const complaintKeys = new Set();
  for (const d of days) for (const p of PARTS) Object.keys(d.parts[p].complaints || {}).forEach(k => complaintKeys.add(k));
  for (const c of complaintKeys) {
    const yes = [];
    const no = [];
    for (const d of days) {
      for (const p of PARTS) {
        const part = d.parts[p];
        const avg = partAverage(part);
        if (!avg || !partHasData(part)) continue;
        (part.complaints[c] ? yes : no).push(avg.sys);
      }
    }
    if (yes.length >= MIN_GROUP && no.length >= MIN_GROUP) {
      const a = round(mean(yes));
      const b = round(mean(no));
      out.push({ key: 'complaint', complaint: c, a, b, diff: a - b, na: yes.length, nb: no.length });
    }
  }

  // Grootste verschillen eerst
  return out.sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff));
}

export function medAdherencePct(a) {
  const total = a.taken + a.skipped;
  return total ? Math.round((a.taken / total) * 100) : null;
}
