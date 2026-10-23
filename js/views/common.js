// Gedeelde onderdelen van de schermen.
import { h, icon, iconButton } from '../dom.js';
import { t } from '../i18n.js';
import { state } from '../store.js';

export function topAppBar(title, { back = null, actions = [], sub = null, brand = false } = {}) {
  return h(
    'header',
    { class: 'top-app-bar' },
    back ? iconButton('arrowLeft', t.back, back, { class: 'on-surface' }) : null,
    h(
      'h1',
      { class: 'title' },
      brand ? h('span', { class: 'brand' }, h('img', { src: 'icons/icon-192.png', alt: '' }), title) : title,
      sub ? h('small', null, sub) : null,
    ),
    actions,
  );
}

export const PART_ICONS = { morning: 'weatherSunsetUp', afternoon: 'whiteBalanceSunny', evening: 'weatherNight' };
export const MOOD_ICONS = ['emoticonCryOutline', 'emoticonSadOutline', 'emoticonNeutralOutline', 'emoticonHappyOutline', 'emoticonExcitedOutline'];
export const ACTIVITY_ICONS = { walk: 'walk', cycle: 'bike', run: 'run', swim: 'swim', gym: 'dumbbell', yoga: 'yoga', garden: 'flower', other: 'dotsHorizontalCircleOutline' };
export const COMPLAINTS = [
  'headache',
  'dizziness',
  'lightheaded',
  'fatigue',
  'otherPain',
  'chestPain',
  'palpitations',
  'shortBreath',
  'nausea',
  'blurredVision',
  'tinnitus',
  'nosebleed',
  'swollenAnkles',
  'dryCough',
  'cramps',
  'urination',
];

export function showCats() {
  return state.settings.showCategories !== false;
}

export function bpText(avg) {
  return avg ? `${avg.sys}/${avg.dia}` : '–';
}

export function warningBanner(kind) {
  const text = { severe: t.warnSevere, chest: t.warnChest, low: t.warnLow }[kind];
  return h('div', { class: 'banner error', role: 'alert' }, icon('alert'), h('div', { class: 'grow' }, text));
}

/** Welke waarschuwingen horen bij een dagdeel. */
export function partWarnings(part, avg) {
  const out = [];
  const readings = (part.readings || []).filter(r => r.sys > 0 && r.dia > 0);
  if (readings.some(r => r.sys >= 180 || r.dia >= 110) || (avg && avg.category === 'severe')) out.push('severe');
  if (part.complaints && part.complaints.chestPain) out.push('chest');
  if (avg && avg.category === 'low' && (part.complaints.dizziness || part.complaints.lightheaded)) out.push('low');
  return out;
}
