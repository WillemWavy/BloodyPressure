// Datumhulpjes. Dagen worden opgeslagen als 'JJJJ-MM-DD' in lokale tijd.
import { locale } from './i18n.js';

export function toKey(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function parseDate(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(d, n) {
  const r = new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  return r;
}

export function todayKey() {
  return toKey(new Date());
}

export function isValidKey(key) {
  return /^\d{4}-\d{2}-\d{2}$/.test(key || '') && !Number.isNaN(parseDate(key).getTime());
}

export function fmtDate(key, opts = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat(locale(), opts).format(parseDate(key));
}

export function fmtShort(key) {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'short' }).format(parseDate(key));
}

export function fmtLong(key) {
  return new Intl.DateTimeFormat(locale(), { day: 'numeric', month: 'long', year: 'numeric' }).format(parseDate(key));
}

export function fmtNumeric(key) {
  return new Intl.DateTimeFormat(locale(), { weekday: 'short', day: '2-digit', month: '2-digit', year: '2-digit' }).format(parseDate(key));
}

export function fmtMonth(year, month) {
  return new Intl.DateTimeFormat(locale(), { month: 'long', year: 'numeric' }).format(new Date(year, month, 1));
}

/** Korte weekdagnamen, beginnend op maandag. */
export function weekdayNames() {
  const base = new Date(2024, 0, 1); // maandag
  return Array.from({ length: 7 }, (_, i) =>
    new Intl.DateTimeFormat(locale(), { weekday: 'narrow' }).format(addDays(base, i)),
  );
}

export function nowTime() {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

/** Welk dagdeel past bij het huidige tijdstip. */
export function currentPart() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 18) return 'afternoon';
  return 'evening';
}
