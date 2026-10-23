import { h, iconButton, button, segmented, textField, selectField, numberValue, stepper, cardHead } from '../dom.js';
import { t } from '../i18n.js';
import { getDay, save, uid } from '../store.js';
import { fmtDate } from '../dates.js';
import { topAppBar, ACTIVITY_ICONS } from './common.js';

export function dailyView({ params, goBack }) {
  const { date } = params;
  const day = getDay(date);
  const back = () => goBack(`#/day/${date}`);

  const content = h(
    'div',
    { class: 'content' },
    h('p', { class: 'hint', style: { margin: '0 4px' } }, t.autosaveHint),
    sleepCard(day),
    exerciseCard(day),
    intakeCard(day),
    weightCard(day),
    h(
      'section',
      { class: 'card' },
      cardHead('noteTextOutline', t.dayNote),
      textField(
        t.notePlaceholder,
        day.note,
        v => {
          day.note = v;
          save();
        },
        { multiline: true },
      ),
    ),
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, button(t.done, back, { variant: 'filled', iconName: 'check' })),
  );

  return {
    el: h('div', null, topAppBar(t.dayAndLifestyle, { back, sub: fmtDate(date), actions: [iconButton('check', t.done, back)] }), content),
  };
}

function sleepCard(day) {
  return h(
    'section',
    { class: 'card' },
    cardHead('sleep', t.sleepTitle),
    h(
      'div',
      { class: 'stack' },
      textField(
        t.sleepHours,
        day.sleepHours ?? '',
        v => {
          const n = numberValue(v);
          day.sleepHours = n === null ? null : Math.max(0, Math.min(24, n));
          save();
        },
        { type: 'number', inputmode: 'decimal', step: '0.5', min: 0, max: 24, suffix: t.hoursSuffix },
      ),
      h('div', { class: 'body-s muted' }, t.sleepQuality),
      segmented(
        t.sleepQualities.map((label, i) => ({ value: i + 1, label })),
        day.sleepQuality,
        v => {
          day.sleepQuality = v;
          save();
        },
        { compact: true, label: t.sleepQuality },
      ),
    ),
  );
}

function exerciseCard(day) {
  const list = h('div', { class: 'stack' });
  const render = () => {
    list.replaceChildren();
    day.activities.forEach((a, i) => {
      list.appendChild(
        h(
          'div',
          { class: 'activity' },
          selectField(
            t.activityType,
            Object.keys(ACTIVITY_ICONS).map(k => ({ value: k, label: t.activities[k] })),
            a.type,
            v => {
              a.type = v;
              save();
            },
          ),
          textField(
            t.minutes,
            a.minutes ?? '',
            v => {
              a.minutes = numberValue(v, { int: true });
              save();
            },
            { type: 'number', inputmode: 'numeric', min: 0, max: 1440 },
          ),
          iconButton('deleteOutline', t.delete, () => {
            day.activities.splice(i, 1);
            render();
            save();
          }),
          segmented(
            ['light', 'moderate', 'vigorous'].map(k => ({ value: k, label: t.intensities[k] })),
            a.intensity,
            v => {
              a.intensity = v;
              save();
            },
            { label: t.intensity },
          ),
        ),
      );
    });
  };
  render();

  return h(
    'section',
    { class: 'card' },
    cardHead('run', t.exerciseTitle),
    h(
      'div',
      { class: 'stack' },
      list,
      h(
        'div',
        null,
        button(
          t.addActivity,
          () => {
            day.activities.push({ id: uid(), type: 'walk', minutes: null, intensity: 'moderate' });
            render();
            const inputs = list.querySelectorAll('.activity:last-child input');
            if (inputs[0]) inputs[0].focus();
          },
          { variant: 'tonal', iconName: 'plus' },
        ),
      ),
      textField(
        t.steps,
        day.steps ?? '',
        v => {
          day.steps = numberValue(v, { int: true });
          save();
        },
        { type: 'number', inputmode: 'numeric', min: 0 },
      ),
    ),
  );
}

function intakeCard(day) {
  return h(
    'section',
    { class: 'card' },
    cardHead('shakerOutline', t.intakeTitle),
    h(
      'div',
      { class: 'stack' },
      h('div', { class: 'body-s muted' }, `${t.salt} — ${t.saltHint}`),
      segmented(
        ['low', 'normal', 'high'].map(k => ({ value: k, label: t.saltLevels[k] })),
        day.salt,
        v => {
          day.salt = v;
          save();
        },
        { label: t.salt },
      ),
      h(
        'div',
        { class: 'field-row' },
        h('span', { class: 'label body-l' }, t.alcohol),
        stepper(day.alcohol, v => {
          day.alcohol = v;
          save();
        }, { label: t.alcohol }),
      ),
      h(
        'div',
        { class: 'field-row' },
        h('span', { class: 'label body-l' }, t.caffeine),
        stepper(day.caffeine, v => {
          day.caffeine = v;
          save();
        }, { label: t.caffeine }),
      ),
    ),
  );
}

function weightCard(day) {
  return h(
    'section',
    { class: 'card' },
    cardHead('scaleBathroom', t.weightTitle),
    textField(
      t.weightKg,
      day.weight != null ? Math.round(day.weight * 10) / 10 : '',
      v => {
        const n = numberValue(v);
        day.weight = n && n > 0 ? n : null;
        save();
      },
      { type: 'number', inputmode: 'decimal', step: '0.1', min: 0, suffix: 'kg' },
    ),
  );
}
