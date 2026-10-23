import { h, icon, chip, catBadge } from '../dom.js';
import { t, fmtNum } from '../i18n.js';
import { state, medById, medLabel } from '../store.js';
import { todayKey } from '../dates.js';
import { periodRange, daysInRange, stats, dailySeries, insights, medAdherencePct, classify } from '../bp.js';
import { screenPalette, stackedBar } from '../charts.js';
import { bpChart, bpLegend, partsChart, pulseChart, moodChart, moodLegend, exerciseChart, sleepChart, weightChart, hasAny, categoryRows } from '../analysis.js';
import { topAppBar, showCats, bpText } from './common.js';

let period = 'd30';

export function trendsView() {
  const body = h('div', { class: 'stack', style: { gap: '16px' } });
  const charts = [];

  const periodChips = h(
    'div',
    { class: 'chips scroll', role: 'radiogroup', 'aria-label': t.reportPeriod },
    Object.keys(t.periods).map(p =>
      chip(t.periods[p], p === period, () => {
        period = p;
        periodChips.querySelectorAll('.chip').forEach((c, i) => {
          const sel = Object.keys(t.periods)[i] === period;
          c.classList.toggle('selected', sel);
          c.setAttribute('aria-pressed', String(sel));
        });
        build();
      }),
    ),
  );

  const chartCard = (title, sub, render, legend = null) => {
    const holder = h('div', { class: 'chart' });
    charts.push({ holder, render });
    return h(
      'section',
      { class: 'card elevated chart-card' },
      h('h2', { class: 'title-m' }, title),
      sub ? h('div', { class: 'body-s muted' }, sub) : null,
      holder,
      legend ? legendEl(legend) : null,
    );
  };

  const drawCharts = () => {
    const pal = screenPalette();
    for (const c of charts) {
      const width = Math.max(260, Math.round(c.holder.clientWidth || 320));
      c.holder.replaceChildren(c.render(pal, width));
    }
  };

  const build = () => {
    charts.length = 0;
    const today = todayKey();
    const { from, to } = periodRange(period, today);
    const days = daysInRange(from, to);
    const s = stats(days);
    const series = dailySeries(days);
    body.replaceChildren();

    if (!days.length) {
      body.appendChild(h('section', { class: 'card' }, h('p', { class: 'hint' }, t.noData)));
      return;
    }

    // Kerncijfers
    const avgCat = s.avg && showCats() ? classify(s.avg.sys, s.avg.dia) : null;
    body.appendChild(
      h(
        'div',
        { class: 'stat-tiles' },
        tile(t.avgBp, bpText(s.avg), s.avg ? h('span', null, t.mmHg, ' ', avgCat ? catBadge(avgCat) : null) : null),
        tile(t.avgPulse, s.pulse ?? '–', s.pulse ? t.bpm : null),
        tile(t.pctTarget, s.pctTarget != null ? `${s.pctTarget}%` : '–', `${t.target} ${state.settings.targetSys}/${state.settings.targetDia}`),
        tile(t.readingsCount, s.readings, t.daysMeasured(s.daysWithReadings)),
      ),
    );

    if (s.measuredParts) {
      body.appendChild(chartCard(t.chartBp, t.chartBpSub, (pal, w) => bpChart({ from, to, days, pal, width: w, showBands: showCats() }), bpLegend(screenPalette())));
      body.appendChild(chartCard(t.chartParts, t.mmHg, (pal, w) => partsChart({ stats: s, pal, width: w }), [
        { color: screenPalette().sys, label: t.systolicLong },
        { color: screenPalette().dia, label: t.diastolicLong },
      ]));
      if (showCats()) body.appendChild(categoryCard(s));
      if (hasAny(series, 'pulse')) body.appendChild(chartCard(t.chartPulse, t.bpm, (pal, w) => pulseChart({ from, to, days, pal, width: w })));
    }

    if (hasAny(series, 'mood') || hasAny(series, 'stress')) {
      body.appendChild(chartCard(t.chartMood, null, (pal, w) => moodChart({ from, to, days, pal, width: w }), moodLegend(screenPalette())));
    }

    const complaints = Object.entries(s.complaintCounts).sort((a, b) => b[1] - a[1]);
    if (complaints.length) body.appendChild(barListCard(t.chartComplaints, t.chartComplaintsSub, complaints.map(([k, n]) => ({ label: t.complaints[k], value: n }))));

    if (days.some(d => d.activities.some(a => a.minutes))) {
      body.appendChild(chartCard(t.chartExercise, `${t.minShort} · ${t.exerciseAdvice}`, (pal, w) => exerciseChart({ from, to, pal, width: w })));
    }
    if (hasAny(series, 'sleep')) body.appendChild(chartCard(t.chartSleep, `${t.sleepHours} · ${t.sleepAdvice}`, (pal, w) => sleepChart({ from, to, days, pal, width: w })));
    if (hasAny(series, 'weight')) body.appendChild(chartCard(t.chartWeight, 'kg', (pal, w) => weightChart({ from, to, days, pal, width: w })));

    const adherence = Object.entries(s.adherence)
      .map(([id, a]) => ({ label: medLabel(medById(id)), value: medAdherencePct(a), raw: a }))
      .filter(a => a.value !== null);
    if (adherence.length) {
      body.appendChild(barListCard(t.adherence, t.adherenceSub, adherence.map(a => ({ label: a.label, value: a.value, display: `${a.value}%`, max: 100 }))));
    }

    body.appendChild(insightsCard(days));
    requestAnimationFrame(drawCharts);
  };

  const content = h('div', { class: 'content' }, periodChips, body);
  let ro = null;
  let lastWidth = 0;

  return {
    el: h('div', null, topAppBar(t.trendsTitle), content),
    mounted() {
      build();
      if ('ResizeObserver' in window) {
        ro = new ResizeObserver(entries => {
          const w = Math.round(entries[0].contentRect.width);
          if (Math.abs(w - lastWidth) > 8) {
            lastWidth = w;
            drawCharts();
          }
        });
        ro.observe(content);
      }
    },
    cleanup() {
      if (ro) ro.disconnect();
    },
  };
}

function tile(label, value, sub) {
  return h('div', { class: 'stat-tile' }, h('div', { class: 'label' }, label), h('div', { class: 'value' }, value), sub ? h('div', { class: 'sub' }, sub) : null);
}

function legendEl(items) {
  return h(
    'div',
    { class: 'chart-legend' },
    items.map(i => h('span', null, h('i', { class: i.type || '', style: i.type === 'dash' ? { borderColor: i.color } : { background: i.color } }), i.label)),
  );
}

function categoryCard(s) {
  const rows = categoryRows(s);
  const pal = screenPalette();
  return h(
    'section',
    { class: 'card elevated' },
    h('h2', { class: 'title-m', style: { marginBottom: '12px' } }, t.chartCategories),
    h('div', { class: 'chart' }, stackedBar({ segments: rows.map(r => ({ value: r.count, color: pal.cat[r.category] })), width: 600, height: 16, pal })),
    h(
      'div',
      { class: 'legend', style: { marginTop: '12px' } },
      rows.map(r => h('span', { class: `cat-badge cat-${r.category}` }, `${t.categories[r.category]} ${r.pct}%`)),
    ),
  );
}

function barListCard(title, sub, rows) {
  const max = Math.max(...rows.map(r => r.max || r.value), 1);
  return h(
    'section',
    { class: 'card elevated' },
    h('h2', { class: 'title-m' }, title),
    h('div', { class: 'body-s muted', style: { marginBottom: '12px' } }, sub),
    h(
      'div',
      { class: 'stack', style: { gap: '8px' } },
      rows.map(r =>
        h(
          'div',
          { class: 'bar-row' },
          h('span', null, r.label),
          h('span', { class: 'bar' }, h('span', { style: { width: `${(r.value / max) * 100}%` } })),
          h('span', { class: 'n' }, r.display ?? fmtNum(r.value, 0)),
        ),
      ),
    ),
  );
}

function insightsCard(days) {
  const list = insights(days);
  return h(
    'section',
    { class: 'card' },
    h('div', { class: 'card-head' }, h('span', { class: 'lead' }, icon('lightbulbOnOutline')), h('h2', { class: 'title-m grow' }, t.insightsTitle)),
    list.length ? insightBody(list) : h('p', { class: 'hint' }, t.insightsNone),
    h('p', { class: 'body-s muted', style: { margin: '12px 0 0' } }, t.insightsDisclaimer),
  );
}

export function insightLabel(i) {
  return i.key === 'complaint' ? t.insightLabels.complaint(t.complaints[i.complaint]) : t.insightLabels[i.key];
}

/** Verschil van minder dan 3 mmHg zien we als 'geen duidelijk verschil'. */
export function splitInsights(list) {
  return { clear: list.filter(i => Math.abs(i.diff) >= 3), same: list.filter(i => Math.abs(i.diff) < 3) };
}

export function insightText(i) {
  return t.insight(insightLabel(i), i.diff, i.a, i.b, i.na, i.nb);
}

export function sameText(same) {
  return t.insightNoDiff(same.map(i => insightLabel(i).charAt(0).toLowerCase() + insightLabel(i).slice(1)).join('; '));
}

function insightBody(list) {
  const { clear, same } = splitInsights(list);
  return h(
    'div',
    { class: 'stack' },
    clear.map(insightRow),
    same.length ? h('div', { class: 'insight' }, h('span', { class: 'arrow same' }, '≈'), h('span', { class: 'muted' }, sameText(same))) : null,
  );
}

function insightRow(i) {
  const dir = i.diff < 0 ? 'down' : 'up';
  const sign = `${i.diff > 0 ? '+' : '−'}${Math.abs(i.diff)}`;
  return h('div', { class: 'insight' }, h('span', { class: `arrow ${dir}` }, sign), h('span', null, insightText(i)));
}
