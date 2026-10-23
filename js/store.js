// Opslag: alles staat lokaal in IndexedDB in de browser van de gebruiker. Er gaat niets naar een server.

export const APP_VERSION = '1.0.0';
const DB_NAME = 'bloodypressure';
const STORE = 'kv';
const KEY = 'state';
const BACKUP_FORMAT = 'bloodypressure-backup';
const BACKUP_VERSION = 1;

export const PARTS = ['morning', 'afternoon', 'evening'];

export function defaultSettings() {
  return {
    lang: 'auto',
    theme: 'auto',
    targetSys: 130,
    targetDia: 80,
    showCategories: true,
    reportName: '',
    lastBackup: null,
    nudgeDismissed: null,
  };
}

function emptyState() {
  return { version: 1, days: {}, meds: [], settings: defaultSettings() };
}

export const state = emptyState();
let db = null;
let memoryOnly = false;
const listeners = new Set();

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbGet(key) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readonly');
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function idbSet(key, value) {
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function load() {
  try {
    db = await openDb();
    const saved = await idbGet(KEY);
    if (saved) applyState(saved);
  } catch (e) {
    console.warn('IndexedDB niet beschikbaar', e);
    memoryOnly = true;
  }
  return state;
}

export function isMemoryOnly() {
  return memoryOnly;
}

function applyState(src) {
  state.version = 1;
  state.days = src.days && typeof src.days === 'object' ? src.days : {};
  state.meds = Array.isArray(src.meds) ? src.meds : [];
  state.settings = { ...defaultSettings(), ...(src.settings || {}) };
  for (const key of Object.keys(state.days)) normalizeDay(state.days[key], key);
  // Lege dagen (bijv. geopend maar niets ingevuld) ruimen we alleen bij het laden op,
  // zodat een scherm dat een dag open heeft nooit een losgekoppeld object bewerkt.
  pruneEmptyDays();
}

let saveTimer = null;
let persistAsked = false;

/** Bewaart de staat (licht vertraagd, zodat typen soepel blijft). */
export function save(immediate = false) {
  clearTimeout(saveTimer);
  const run = () => {
    if (!memoryOnly && db) {
      idbSet(KEY, JSON.parse(JSON.stringify(state))).catch(e => console.warn('Opslaan mislukt', e));
    }
    if (!persistAsked && navigator.storage && navigator.storage.persist) {
      persistAsked = true;
      navigator.storage.persist().catch(() => {});
    }
    listeners.forEach(fn => fn());
  };
  if (immediate) run();
  else saveTimer = setTimeout(run, 250);
}

export function flush() {
  if (saveTimer) save(true);
}

export function onSaved(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// ---------- Dagen ----------

export function emptyPart() {
  return {
    mood: null,
    stress: null,
    readings: [],
    arm: null,
    position: null,
    complaints: {},
    painLocation: '',
    sideEffects: '',
    sideEffectMed: '',
    meds: {},
    note: '',
  };
}

export function emptyDay(date) {
  return {
    date,
    parts: { morning: emptyPart(), afternoon: emptyPart(), evening: emptyPart() },
    sleepHours: null,
    sleepQuality: null,
    activities: [],
    steps: null,
    salt: null,
    alcohol: null,
    caffeine: null,
    weight: null,
    note: '',
  };
}

function normalizeDay(day, key) {
  day.date = key;
  day.parts = day.parts || {};
  for (const p of PARTS) day.parts[p] = { ...emptyPart(), ...(day.parts[p] || {}) };
  const base = emptyDay(key);
  for (const k of Object.keys(base)) if (day[k] === undefined) day[k] = base[k];
}

/** Geeft de dag terug; maakt hem aan (in het geheugen) als hij nog niet bestaat. */
export function getDay(date) {
  if (!state.days[date]) state.days[date] = emptyDay(date);
  return state.days[date];
}

export function peekDay(date) {
  return state.days[date] || null;
}

export function partHasData(part) {
  if (!part) return false;
  return (
    part.mood != null ||
    part.stress != null ||
    part.readings.some(r => r.sys || r.dia || r.pulse) ||
    Object.keys(part.complaints).length > 0 ||
    Object.keys(part.meds).length > 0 ||
    !!part.sideEffects.trim() ||
    !!part.note.trim() ||
    !!part.painLocation.trim()
  );
}

export function dailyHasData(day) {
  if (!day) return false;
  return (
    day.sleepHours != null ||
    day.sleepQuality != null ||
    day.activities.some(a => a.minutes) ||
    day.steps != null ||
    day.salt != null ||
    day.alcohol != null ||
    day.caffeine != null ||
    day.weight != null ||
    !!day.note.trim()
  );
}

export function dayHasData(day) {
  return !!day && (PARTS.some(p => partHasData(day.parts[p])) || dailyHasData(day));
}

function pruneEmptyDays() {
  for (const [key, day] of Object.entries(state.days)) {
    if (!dayHasData(day)) delete state.days[key];
  }
}

// ---------- Medicijnen ----------

export function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

export function activeMeds() {
  return state.meds.filter(m => !m.deleted && m.active !== false);
}

export function medById(id) {
  return state.meds.find(m => m.id === id) || null;
}

export function medLabel(med) {
  if (!med) return '?';
  return med.dose ? `${med.name} ${med.dose}` : med.name;
}

// ---------- Back-up ----------

export function backupJson() {
  pruneEmptyDays();
  const data = JSON.parse(JSON.stringify(state));
  return JSON.stringify(
    {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      appVersion: APP_VERSION,
      createdAt: new Date().toISOString(),
      days: data.days,
      meds: data.meds,
      settings: data.settings,
    },
    null,
    2,
  );
}

export function parseBackup(text) {
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    return null;
  }
  if (!json || json.format !== BACKUP_FORMAT || typeof json.days !== 'object') return null;
  return {
    days: json.days || {},
    meds: Array.isArray(json.meds) ? json.meds : [],
    settings: json.settings || {},
    dayCount: Object.keys(json.days || {}).length,
    medCount: (json.meds || []).filter(m => !m.deleted).length,
  };
}

export function restoreBackup(parsed) {
  const keepLastBackup = state.settings.lastBackup;
  applyState({ days: parsed.days, meds: parsed.meds, settings: parsed.settings });
  state.settings.lastBackup = state.settings.lastBackup || keepLastBackup;
  save(true);
}

export function wipeAll() {
  const fresh = emptyState();
  state.days = fresh.days;
  state.meds = fresh.meds;
  state.settings = fresh.settings;
  save(true);
}
