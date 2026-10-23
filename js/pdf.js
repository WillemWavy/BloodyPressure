// PDF-rapport met jsPDF (lokaal meegeleverd in /vendor, er gaat niets over het internet).
import { t, fmtNum } from './i18n.js';
import { state, PARTS, medById, medLabel, partHasData, dailyHasData } from './store.js';
import { fmtLong, fmtNumeric, todayKey } from './dates.js';
import { stats, partAverage, insights, medAdherencePct, classify, validReadings, dailySeries } from './bp.js';
import { printPalette, svgToPng } from './charts.js';
import { bpChart, bpLegend, partsChart, pulseChart, moodChart, moodLegend, exerciseChart, sleepChart, weightChart, hasAny, categoryRows } from './analysis.js';
import { insightText, splitInsights, sameText } from './views/trends.js';

let loading = null;

function loadJsPdf() {
  if (window.jspdf) return Promise.resolve(window.jspdf);
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'vendor/jspdf.umd.min.js';
      s.onload = () => resolve(window.jspdf);
      s.onerror = () => {
        loading = null;
        reject(new Error('jsPDF kon niet worden geladen'));
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

const RGB = {
  primary: [156, 65, 70],
  text: [35, 25, 25],
  muted: [82, 67, 67],
  line: [215, 193, 193],
  zebra: [255, 240, 239],
  head: [252, 234, 234],
  cat: { low: [63, 106, 176], normal: [46, 125, 79], elevated: [201, 154, 14], high: [208, 84, 27], severe: [179, 19, 43] },
};

/** Tekens buiten de standaard PDF-letterset vervangen. */
function clean(s) {
  return String(s ?? '')
    .replace(/≥/g, '>=')
    .replace(/≤/g, '<=')
    .replace(/[−‒]/g, '-')
    .replace(/≈/g, '~')
    .replace(/→/g, '->')
    .replace(/[  ]/g, ' ')
    .replace(/[^\x00-\xff€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ]/g, '');
}

export async function makePdf({ from, to, name, include }) {
  const { jsPDF } = await loadJsPdf();
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const W = 210;
  const H = 297;
  const M = 15;
  const CW = W - 2 * M;
  let y = M;

  const allDays = Object.keys(state.days)
    .filter(k => k >= from && k <= to)
    .sort()
    .map(k => state.days[k]);
  const s = stats(allDays);
  const pal = printPalette;

  const setText = (size, color = RGB.text, style = 'normal') => {
    doc.setFont('helvetica', style);
    doc.setFontSize(size);
    doc.setTextColor(...color);
  };
  const ensure = needed => {
    if (y + needed > H - 18) {
      doc.addPage();
      y = M;
    }
  };
  const heading = text => {
    ensure(14);
    y += 4;
    setText(13, RGB.primary, 'bold');
    doc.text(clean(text), M, y);
    y += 2;
    doc.setDrawColor(...RGB.line);
    doc.setLineWidth(0.3);
    doc.line(M, y, M + CW, y);
    y += 5;
  };
  const paragraph = (text, size = 9.5, color = RGB.text) => {
    setText(size, color);
    const lines = doc.splitTextToSize(clean(text), CW);
    for (const line of lines) {
      ensure(5);
      doc.text(line, M, y);
      y += size * 0.45;
    }
    y += 1.5;
  };

  // ---------- Kop ----------
  doc.setFillColor(...RGB.primary);
  doc.rect(0, 0, W, 4, 'F');
  y = M + 4;
  setText(20, RGB.primary, 'bold');
  doc.text('Bloody Pressure', M, y);
  setText(12, RGB.text);
  doc.text(clean(t.pdfTitle), M, y + 7);
  setText(9.5, RGB.muted);
  const metaRight = [name ? clean(name) : null, clean(t.pdfPeriod(fmtLong(from), fmtLong(to))), clean(t.pdfGenerated(fmtLong(todayKey())))].filter(Boolean);
  metaRight.forEach((line, i) => doc.text(line, W - M, y - 3 + i * 5, { align: 'right' }));
  y += 16;

  // ---------- Samenvatting ----------
  heading(t.pdfSummary);
  const kv = [];
  if (s.avg) {
    const cat = classify(s.avg.sys, s.avg.dia);
    kv.push([t.pdfAverage, `${s.avg.sys}/${s.avg.dia} ${t.mmHg}${state.settings.showCategories !== false ? ` (${t.categories[cat].toLowerCase()})` : ''}`, cat]);
    for (const p of PARTS) if (s.byPart[p]) kv.push([t.parts[p], `${s.byPart[p].sys}/${s.byPart[p].dia} ${t.mmHg}`]);
    if (s.max) kv.push([t.pdfHighest, `${s.max.sys}/${s.max.dia} ${t.mmHg} · ${fmtNumeric(s.max.date)} · ${t.parts[s.max.part].toLowerCase()}`]);
    if (s.min) kv.push([t.pdfLowest, `${s.min.sys}/${s.min.dia} ${t.mmHg} · ${fmtNumeric(s.min.date)} · ${t.parts[s.min.part].toLowerCase()}`]);
    if (s.pulse) kv.push([t.avgPulse, `${s.pulse} ${t.bpm}`]);
    kv.push([t.pctTarget, `${s.pctTarget}% (${t.target.toLowerCase()} ${state.settings.targetSys}/${state.settings.targetDia})`]);
    kv.push([t.pdfReadingsTotal, `${s.readings} · ${t.daysMeasured(s.daysWithReadings)}`]);
    if (state.settings.showCategories !== false) {
      kv.push([t.chartCategories, categoryRows(s).map(r => `${t.categories[r.category]} ${r.pct}%`).join(', ')]);
    }
  } else {
    kv.push([t.pdfReadingsTotal, '0']);
  }
  const adherence = Object.entries(s.adherence)
    .map(([id, a]) => [medLabel(medById(id)), medAdherencePct(a), a])
    .filter(a => a[1] !== null);
  if (adherence.length) kv.push([t.adherence, adherence.map(([l, p, a]) => `${l}: ${p}% (${a.taken}/${a.taken + a.skipped})`).join('; ')]);
  const weights = allDays.filter(d => d.weight != null);
  if (weights.length) {
    const w0 = weights[0];
    const w1 = weights[weights.length - 1];
    kv.push([t.weightTitle, weights.length > 1 ? `${fmtNum(w0.weight)} kg (${fmtNumeric(w0.date)}) -> ${fmtNum(w1.weight)} kg (${fmtNumeric(w1.date)})` : `${fmtNum(w0.weight)} kg`]);
  }
  for (const [k, v, cat] of kv) {
    setText(9.5, RGB.muted);
    const lines = doc.splitTextToSize(clean(v), CW - 55);
    ensure(lines.length * 4.5 + 1);
    doc.text(clean(k), M, y);
    setText(9.5, RGB.text, cat ? 'bold' : 'normal');
    if (cat) {
      doc.setFillColor(...RGB.cat[cat]);
      doc.circle(M + 53, y - 1.2, 1.3, 'F');
    }
    doc.text(lines, M + 56, y);
    y += lines.length * 4.5 + 0.8;
  }
  if (state.settings.showCategories !== false) {
    y += 1;
    paragraph(t.pdfClassNote, 8, RGB.muted);
  }

  // ---------- Medicijnen ----------
  const meds = state.meds.filter(m => !m.deleted && m.active !== false);
  if (meds.length) {
    heading(t.pdfCurrent);
    for (const m of meds) {
      const when = (m.parts || []).map(p => t.parts[p].toLowerCase()).join(', ');
      paragraph(`• ${medLabel(m)}${when ? ` — ${when}` : ''}`);
    }
  }

  // ---------- Grafieken ----------
  if (include.charts && allDays.length) {
    const series = dailySeries(allDays);
    const chartW = 640;
    const blocks = [];
    if (s.measuredParts) {
      blocks.push([t.chartBp, bpChart({ from, to, days: allDays, pal, width: chartW, height: 250, showBands: state.settings.showCategories !== false }), bpLegend(pal)]);
      blocks.push([t.chartParts, partsChart({ stats: s, pal, width: chartW, height: 200 }), [
        { color: pal.sys, label: t.systolicLong },
        { color: pal.dia, label: t.diastolicLong },
      ]]);
      if (hasAny(series, 'pulse')) blocks.push([`${t.chartPulse} (${t.bpm})`, pulseChart({ from, to, days: allDays, pal, width: chartW, height: 190 })]);
    }
    if (hasAny(series, 'mood') || hasAny(series, 'stress')) blocks.push([t.chartMood, moodChart({ from, to, days: allDays, pal, width: chartW, height: 190 }), moodLegend(pal)]);
    if (allDays.some(d => d.activities.some(a => a.minutes))) blocks.push([`${t.chartExercise} (${t.minShort}; ${t.exerciseAdvice})`, exerciseChart({ from, to, pal, width: chartW, height: 190 })]);
    if (hasAny(series, 'sleep')) blocks.push([`${t.chartSleep} (${t.sleepAdvice})`, sleepChart({ from, to, days: allDays, pal, width: chartW, height: 180 })]);
    if (hasAny(series, 'weight')) blocks.push([`${t.chartWeight} (kg)`, weightChart({ from, to, days: allDays, pal, width: chartW, height: 180 })]);

    for (const [title, svg, legend] of blocks) {
      const img = await svgToPng(svg, 3);
      const hmm = (img.height / img.width) * CW;
      ensure(hmm + 16);
      setText(10.5, RGB.text, 'bold');
      doc.text(clean(title), M, y + 3);
      y += 5;
      doc.addImage(img.data, 'PNG', M, y, CW, hmm);
      y += hmm + 2;
      if (legend) {
        let x = M;
        setText(8, RGB.muted);
        for (const item of legend) {
          const label = clean(item.label);
          const w = doc.getTextWidth(label) + 9;
          if (x + w > M + CW) {
            x = M;
            y += 4.5;
          }
          const [r, g, b] = hexToRgb(item.color);
          doc.setDrawColor(r, g, b);
          doc.setLineWidth(0.8);
          if (item.type === 'dash') doc.setLineDashPattern([1.2, 0.8], 0);
          doc.line(x, y + 1.6, x + 5, y + 1.6);
          doc.setLineDashPattern([], 0);
          doc.text(label, x + 6.5, y + 2.6);
          x += w;
        }
        y += 6;
      }
      y += 3;
    }

    const complaints = Object.entries(s.complaintCounts).sort((a, b) => b[1] - a[1]);
    if (complaints.length) {
      ensure(12);
      setText(10.5, RGB.text, 'bold');
      doc.text(clean(`${t.chartComplaints} (${t.chartComplaintsSub})`), M, y + 3);
      y += 7;
      const max = Math.max(...complaints.map(c => c[1]));
      for (const [k, n] of complaints) {
        ensure(6);
        setText(9, RGB.text);
        doc.text(clean(t.complaints[k]), M, y + 3);
        doc.setFillColor(...RGB.head);
        doc.roundedRect(M + 62, y, CW - 75, 3.8, 1.5, 1.5, 'F');
        doc.setFillColor(...RGB.primary);
        doc.roundedRect(M + 62, y, Math.max(2, ((CW - 75) * n) / max), 3.8, 1.5, 1.5, 'F');
        doc.text(String(n), M + CW, y + 3, { align: 'right' });
        y += 5.5;
      }
      y += 3;
    }
  }

  // ---------- Verbanden ----------
  if (include.insights) {
    const list = insights(allDays);
    heading(t.insightsTitle);
    const { clear, same } = splitInsights(list);
    clear.forEach(i => paragraph(`• ${insightText(i)}`));
    if (same.length) paragraph(`• ${sameText(same)}`, 9.5, RGB.muted);
    if (!list.length) paragraph(t.insightsNone, 9, RGB.muted);
    paragraph(t.insightsDisclaimer, 8, RGB.muted);
  }

  // ---------- Metingen ----------
  if (include.table) {
    const rows = [];
    for (const d of allDays) {
      for (const p of PARTS) {
        const part = d.parts[p];
        const avg = partAverage(part);
        if (!avg && part.mood == null && part.stress == null && !Object.keys(part.meds).length) continue;
        const readings = validReadings(part);
        const meds = Object.entries(part.meds || {}).map(([id, v]) => `${medById(id)?.name || '?'} ${v ? '+' : '-'}`);
        const cond = [part.arm ? t.arms[part.arm] : null, part.position ? t.positions[part.position] : null].filter(Boolean).join(', ');
        rows.push({
          cat: avg?.category,
          cells: [
            fmtNumeric(d.date),
            t.parts[p],
            avg ? `${avg.sys}/${avg.dia}` : '',
            readings.length > 1 ? readings.map(r => `${r.time ? r.time + ' ' : ''}${r.sys}/${r.dia}${r.pulse ? ` (${r.pulse})` : ''}`).join('\n') : readings[0]?.time || '',
            avg?.pulse ? String(avg.pulse) : '',
            cond,
            part.mood != null ? String(part.mood) : '',
            part.stress != null ? String(part.stress) : '',
            meds.join(', '),
          ],
        });
      }
    }
    if (rows.length) {
      heading(t.pdfReadings);
      table(
        [
          { h: t.pdfDate, w: 22 },
          { h: t.pdfPart, w: 16 },
          { h: t.bpTitle, w: 20, bold: true, dot: true },
          { h: `${t.time} / ${t.readingsCount.toLowerCase()}`, w: 33 },
          { h: t.pulseShort, w: 11 },
          { h: t.pdfConditions, w: 24 },
          { h: t.mood, w: 12 },
          { h: t.stress, w: 12 },
          { h: t.medsTitle, w: 30 },
        ],
        rows,
      );
      paragraph(`${t.mood}/${t.stress}: 1-5. ${t.medsTitle}: + = ${t.medTaken.toLowerCase()}, - = ${t.medSkipped.toLowerCase()}.`, 8, RGB.muted);
    }
  }

  // ---------- Leefstijl ----------
  if (include.lifestyle) {
    const rows = allDays
      .filter(dailyHasData)
      .map(d => ({
        cells: [
          fmtNumeric(d.date),
          d.sleepHours != null ? `${fmtNum(d.sleepHours)} ${t.hoursSuffix}` : '',
          d.sleepQuality != null ? t.sleepQualities[d.sleepQuality - 1] : '',
          d.activities.filter(a => a.minutes).map(a => `${t.activities[a.type] || ''} ${a.minutes}`).join('\n'),
          d.steps != null ? fmtNum(d.steps, 0) : '',
          d.salt ? t.saltLevels[d.salt] : '',
          d.alcohol != null ? String(d.alcohol) : '',
          d.caffeine != null ? String(d.caffeine) : '',
          d.weight != null ? fmtNum(d.weight) : '',
        ],
      }));
    if (rows.length) {
      heading(t.pdfLifestyle);
      table(
        [
          { h: t.pdfDate, w: 22 },
          { h: t.chartSleep, w: 15 },
          { h: t.sleepQuality, w: 20 },
          { h: `${t.exerciseTitle} (${t.minShort})`, w: 38 },
          { h: t.steps, w: 16 },
          { h: t.salt, w: 17 },
          { h: 'Alcohol', w: 17 },
          { h: t.caffeine.split(' (')[0], w: 18 },
          { h: 'kg', w: 20 },
        ],
        rows,
      );
    }
  }

  // ---------- Klachten en notities ----------
  if (include.notes) {
    const items = [];
    for (const d of allDays) {
      for (const p of PARTS) {
        const part = d.parts[p];
        if (!partHasData(part)) continue;
        const bits = [];
        const cs = Object.entries(part.complaints).map(([c, sev]) => `${t.complaints[c]} (${t.severities[sev - 1].toLowerCase()})${c === 'otherPain' && part.painLocation.trim() ? `: ${part.painLocation.trim()}` : ''}`);
        if (cs.length) bits.push(`${t.pdfComplaints}: ${cs.join(', ')}`);
        if (part.sideEffects.trim()) {
          const med = part.sideEffectMed ? medById(part.sideEffectMed) : null;
          bits.push(`${t.sideEffectsTitle}: ${part.sideEffects.trim()}${med ? ` (${t.sideEffectsMed.toLowerCase()} ${medLabel(med)})` : ''}`);
        }
        if (part.note.trim()) bits.push(`${t.note}: ${part.note.trim()}`);
        if (bits.length) items.push([`${fmtNumeric(d.date)} · ${t.parts[p]}`, bits]);
      }
      if (d.note.trim()) items.push([`${fmtNumeric(d.date)} · ${t.dayAndLifestyle}`, [d.note.trim()]]);
    }
    if (items.length) {
      heading(t.pdfNotes);
      for (const [head, bits] of items) {
        ensure(10);
        setText(9.5, RGB.text, 'bold');
        doc.text(clean(head), M, y);
        y += 4.5;
        for (const b of bits) paragraph(b, 9, RGB.text);
        y += 1;
      }
    }
  }

  // ---------- Voettekst ----------
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    setText(7.5, RGB.muted);
    doc.setDrawColor(...RGB.line);
    doc.setLineWidth(0.2);
    doc.line(M, H - 12, W - M, H - 12);
    doc.text(clean(t.pdfFooter), M, H - 8);
    doc.text(clean(t.pdfPage(i, pages)), W - M, H - 8, { align: 'right' });
  }

  const filename = `bloody-pressure-${from}_${to}.pdf`;
  return { blob: doc.output('blob'), filename };

  // ---------- Tabel ----------
  function table(cols, rows) {
    const total = cols.reduce((sum, c) => sum + c.w, 0);
    const scale = CW / total;
    cols.forEach(c => (c.w *= scale));
    const pad = 1.4;
    const lineH = 3.6;
    const drawHeader = () => {
      setText(7.8, RGB.muted, 'bold');
      const heads = cols.map(c => doc.splitTextToSize(clean(c.h), c.w - 2 * pad));
      const hh = Math.max(...heads.map(l => l.length)) * lineH + 2 * pad;
      doc.setFillColor(...RGB.head);
      doc.rect(M, y, CW, hh, 'F');
      let x = M;
      cols.forEach((c, i) => {
        doc.text(heads[i], x + pad, y + pad + 2.6);
        x += c.w;
      });
      y += hh;
    };
    ensure(20);
    drawHeader();
    rows.forEach((row, ri) => {
      setText(8.3, RGB.text);
      const cells = row.cells.map((v, i) => doc.splitTextToSize(clean(v), cols[i].w - 2 * pad - (cols[i].dot ? 3 : 0)));
      const rh = Math.max(1, ...cells.map(l => l.length)) * lineH + 2 * pad;
      if (y + rh > H - 18) {
        doc.addPage();
        y = M;
        drawHeader();
        setText(8.3, RGB.text);
      }
      if (ri % 2 === 1) {
        doc.setFillColor(...RGB.zebra);
        doc.rect(M, y, CW, rh, 'F');
      }
      let x = M;
      cols.forEach((c, i) => {
        let tx = x + pad;
        if (c.dot && row.cat && cells[i].length && cells[i][0]) {
          doc.setFillColor(...RGB.cat[row.cat]);
          doc.circle(tx + 1, y + pad + 1.6, 1.1, 'F');
          tx += 3;
        }
        setText(8.3, RGB.text, c.bold ? 'bold' : 'normal');
        doc.text(cells[i], tx, y + pad + 2.6);
        x += c.w;
      });
      doc.setDrawColor(...RGB.line);
      doc.setLineWidth(0.15);
      doc.line(M, y + rh, M + CW, y + rh);
      y += rh;
    });
    y += 4;
  }
}

function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i.exec(hex.trim());
  return m ? [parseInt(m[1], 16), parseInt(m[2], 16), parseInt(m[3], 16)] : [82, 67, 67];
}

