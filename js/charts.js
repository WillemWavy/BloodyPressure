// Eenvoudige SVG-grafieken in Material-stijl. Dezelfde functies tekenen ook de grafieken in het PDF-rapport.
import { addDays, parseDate, toKey, fmtShort } from './dates.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, text = null) {
  const e = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v !== null && v !== undefined) e.setAttribute(k, v);
  if (text !== null) e.textContent = text;
  return e;
}

export function cssVar(name) {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Kleuren voor het scherm (volgen licht/donker thema). */
export function screenPalette() {
  return {
    text: cssVar('--on-surface-variant'),
    grid: cssVar('--outline-variant'),
    surface: cssVar('--surface'),
    sys: cssVar('--series-sys'),
    dia: cssVar('--series-dia'),
    pulse: cssVar('--series-pulse'),
    mood: cssVar('--series-mood'),
    stress: cssVar('--series-stress'),
    primary: cssVar('--primary'),
    target: cssVar('--on-surface-variant'),
    cat: {
      low: cssVar('--cat-low'),
      normal: cssVar('--cat-normal'),
      elevated: cssVar('--cat-elevated'),
      high: cssVar('--cat-high'),
      severe: cssVar('--cat-severe'),
    },
    font: cssVar('--font'),
  };
}

/** Vaste lichte kleuren voor het PDF-rapport. */
export const printPalette = {
  text: '#524343',
  grid: '#d7c1c1',
  surface: '#ffffff',
  sys: '#9c4146',
  dia: '#3f6ab0',
  pulse: '#755a2f',
  mood: '#2e7d4f',
  stress: '#b8860b',
  primary: '#9c4146',
  target: '#524343',
  cat: { low: '#3f6ab0', normal: '#2e7d4f', elevated: '#c99a0e', high: '#d0541b', severe: '#b3132b' },
  font: 'Helvetica, Arial, sans-serif',
};

function niceTicks(min, max, count = 5) {
  if (min === max) {
    min -= 1;
    max += 1;
  }
  const span = max - min;
  const raw = span / count;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const norm = raw / mag;
  const step = (norm >= 5 ? 10 : norm >= 2 ? 5 : norm >= 1 ? 2 : 1) * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Math.round(v * 100) / 100);
  return { lo, hi, ticks };
}

function svgRoot(width, height, pal) {
  const svg = el('svg', { viewBox: `0 0 ${width} ${height}`, width, height, role: 'img', 'font-family': pal.font, xmlns: NS });
  return svg;
}

function dateKeys(from, to) {
  const keys = [];
  let d = parseDate(from);
  const end = parseDate(to);
  while (d <= end) {
    keys.push(toKey(d));
    d = addDays(d, 1);
  }
  return keys;
}

/**
 * Lijngrafiek over datums.
 * series: [{ color, values: { 'JJJJ-MM-DD': getal }, dashed }]
 */
export function lineChart({ from, to, series, width = 340, height = 220, pal, yMin = null, yMax = null, refLines = [], bands = [], yFormat = v => String(v), dots = true }) {
  const keys = dateKeys(from, to);
  const all = series.flatMap(s => Object.values(s.values).filter(v => v !== null && v !== undefined));
  refLines.forEach(r => all.push(r.y));
  let lo = yMin ?? Math.min(...all);
  let hi = yMax ?? Math.max(...all);
  if (!all.length) {
    lo = 0;
    hi = 1;
  }
  const pad = (hi - lo) * 0.08 || 2;
  const fixed = yMin !== null && yMax !== null && yMax - yMin <= 10;
  const { lo: yLo, hi: yHi, ticks } = fixed
    ? { lo: yMin, hi: yMax, ticks: Array.from({ length: yMax - yMin + 1 }, (_, i) => yMin + i) }
    : niceTicks(yMin ?? lo - pad, yMax ?? hi + pad, 4);

  const m = { l: 36, r: 12, t: 10, b: 26 };
  const w = width - m.l - m.r;
  const hgt = height - m.t - m.b;
  const n = Math.max(keys.length - 1, 1);
  const x = i => m.l + (keys.length === 1 ? w / 2 : (i / n) * w);
  const y = v => m.t + hgt - ((v - yLo) / (yHi - yLo)) * hgt;

  const svg = svgRoot(width, height, pal);

  // Gekleurde zones
  for (const b of bands) {
    const top = y(Math.min(b.to, yHi));
    const bottom = y(Math.max(b.from, yLo));
    if (bottom > top) svg.appendChild(el('rect', { x: m.l, y: top, width: w, height: bottom - top, fill: b.color, 'fill-opacity': b.opacity ?? 0.08 }));
  }

  // Raster en y-as
  for (const tv of ticks) {
    svg.appendChild(el('line', { x1: m.l, x2: m.l + w, y1: y(tv), y2: y(tv), stroke: pal.grid, 'stroke-width': 1 }));
    svg.appendChild(el('text', { x: m.l - 6, y: y(tv) + 4, 'text-anchor': 'end', 'font-size': 11, fill: pal.text }, yFormat(tv)));
  }

  // X-as: hooguit ~5 labels
  const labelCount = Math.min(keys.length, Math.max(2, Math.floor(w / 70)));
  const used = new Set();
  for (let j = 0; j < labelCount; j++) {
    const i = labelCount === 1 ? 0 : Math.round((j / (labelCount - 1)) * (keys.length - 1));
    if (used.has(i)) continue;
    used.add(i);
    const anchor = j === 0 ? 'start' : j === labelCount - 1 ? 'end' : 'middle';
    svg.appendChild(el('text', { x: x(i), y: height - 6, 'text-anchor': keys.length === 1 ? 'middle' : anchor, 'font-size': 11, fill: pal.text }, fmtShort(keys[i])));
  }

  // Referentielijnen (streefwaarde)
  for (const r of refLines) {
    svg.appendChild(el('line', { x1: m.l, x2: m.l + w, y1: y(r.y), y2: y(r.y), stroke: r.color, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
  }

  // Reeksen
  const radius = keys.length > 120 ? 1.5 : keys.length > 45 ? 2.5 : 3.5;
  for (const s of series) {
    const pts = keys.map((k, i) => (s.values[k] === null || s.values[k] === undefined ? null : [x(i), y(s.values[k])])).filter(Boolean);
    if (pts.length > 1) {
      svg.appendChild(
        el('polyline', {
          points: pts.map(p => p.map(v => v.toFixed(1)).join(',')).join(' '),
          fill: 'none',
          stroke: s.color,
          'stroke-width': 2.5,
          'stroke-linejoin': 'round',
          'stroke-linecap': 'round',
          'stroke-dasharray': s.dashed ? '6 4' : null,
        }),
      );
    }
    if (dots || pts.length === 1) {
      for (const p of pts) svg.appendChild(el('circle', { cx: p[0], cy: p[1], r: radius, fill: s.color }));
    }
  }
  return svg;
}

/**
 * Staafgrafiek met groepen.
 * groups: [{ label, bars: [{ value, color }] }]
 */
export function barChart({ groups, width = 340, height = 200, pal, yMin = 0, yMax = null, refLines = [], yFormat = v => String(v), valueLabels = true }) {
  const all = groups.flatMap(g => g.bars.map(b => b.value).filter(v => v !== null && v !== undefined));
  refLines.forEach(r => all.push(r.y));
  const maxV = yMax ?? Math.max(1, ...all);
  const { lo: yLo, hi: yHi, ticks } = niceTicks(yMin, maxV, 4);
  const m = { l: 36, r: 8, t: 14, b: 26 };
  const w = width - m.l - m.r;
  const hgt = height - m.t - m.b;
  const y = v => m.t + hgt - ((v - yLo) / (yHi - yLo)) * hgt;
  const svg = svgRoot(width, height, pal);

  for (const tv of ticks) {
    svg.appendChild(el('line', { x1: m.l, x2: m.l + w, y1: y(tv), y2: y(tv), stroke: pal.grid, 'stroke-width': 1 }));
    svg.appendChild(el('text', { x: m.l - 6, y: y(tv) + 4, 'text-anchor': 'end', 'font-size': 11, fill: pal.text }, yFormat(tv)));
  }

  const gw = w / Math.max(groups.length, 1);
  const showLabelsEvery = Math.ceil(groups.length / Math.max(1, Math.floor(w / 46)));
  groups.forEach((g, gi) => {
    const nb = g.bars.length;
    const inner = Math.min(gw * 0.72, nb * 28);
    const bw = inner / nb;
    const gx = m.l + gi * gw + (gw - inner) / 2;
    g.bars.forEach((b, bi) => {
      if (b.value === null || b.value === undefined) return;
      const top = y(Math.max(b.value, yLo));
      const bh = Math.max(0, y(yLo) - top);
      const bx = gx + bi * bw + 1;
      const r = Math.min(4, (bw - 2) / 2, bh / 2);
      svg.appendChild(el('path', { d: roundedTop(bx, top, bw - 2, bh, r), fill: b.color }));
      if (valueLabels && nb * groups.length <= 16) {
        svg.appendChild(el('text', { x: bx + (bw - 2) / 2, y: top - 4, 'text-anchor': 'middle', 'font-size': 10, fill: pal.text }, yFormat(b.value)));
      }
    });
    if (gi % showLabelsEvery === 0) {
      svg.appendChild(el('text', { x: m.l + gi * gw + gw / 2, y: height - 6, 'text-anchor': 'middle', 'font-size': 11, fill: pal.text }, g.label));
    }
  });

  for (const r of refLines) {
    svg.appendChild(el('line', { x1: m.l, x2: m.l + w, y1: y(r.y), y2: y(r.y), stroke: r.color, 'stroke-width': 1.5, 'stroke-dasharray': '5 4' }));
  }
  return svg;
}

function roundedTop(x, y, w, h, r) {
  if (h <= 0 || w <= 0) return '';
  return `M${x},${y + h} V${y + r} Q${x},${y} ${x + r},${y} H${x + w - r} Q${x + w},${y} ${x + w},${y + r} V${y + h} Z`;
}

/** Eén horizontale 100%-staaf met segmenten (bijv. de indeling). */
export function stackedBar({ segments, width = 340, height = 28, pal }) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const svg = svgRoot(width, height, pal);
  const clipId = `clip${Math.random().toString(36).slice(2, 8)}`;
  const defs = el('defs');
  const clip = el('clipPath', { id: clipId });
  clip.appendChild(el('rect', { x: 0, y: 0, width, height, rx: 8 }));
  defs.appendChild(clip);
  svg.appendChild(defs);
  const g = el('g', { 'clip-path': `url(#${clipId})` });
  let x = 0;
  for (const s of segments) {
    if (!s.value) continue;
    const w = (s.value / total) * width;
    g.appendChild(el('rect', { x, y: 0, width: w, height, fill: s.color }));
    x += w;
  }
  svg.appendChild(g);
  return svg;
}

/** Zet een SVG om naar een PNG-dataURL (voor het PDF-rapport). */
export function svgToPng(svg, scale = 3) {
  return new Promise((resolve, reject) => {
    const width = Number(svg.getAttribute('width'));
    const height = Number(svg.getAttribute('height'));
    const xml = new XMLSerializer().serializeToString(svg);
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = width * scale;
      canvas.height = height * scale;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve({ data: canvas.toDataURL('image/png'), width, height });
    };
    img.onerror = reject;
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);
  });
}
