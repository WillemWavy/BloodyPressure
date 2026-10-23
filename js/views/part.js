import { h, icon, iconButton, button, segmented, chip, textField, selectField, numberValue, catBadge, cardHead } from '../dom.js';
import { t } from '../i18n.js';
import { getDay, save, activeMeds, medById, medLabel, uid, state } from '../store.js';
import { fmtDate, todayKey, nowTime } from '../dates.js';
import { partAverage, inTarget } from '../bp.js';
import { topAppBar, PART_ICONS, MOOD_ICONS, COMPLAINTS, showCats, partWarnings, warningBanner } from './common.js';

export function partView({ params, navigate, goBack }) {
  const { date, part: partKey } = params;
  const day = getDay(date);
  const part = day.parts[partKey];
  const back = () => goBack(`#/day/${date}`);

  const warningsBox = h('div', { class: 'stack' });
  const refreshWarnings = () => {
    warningsBox.replaceChildren(...partWarnings(part, partAverage(part)).map(warningBanner));
  };

  const content = h(
    'div',
    { class: 'content' },
    h('p', { class: 'hint', style: { margin: '0 4px' } }, t.autosaveHint),
    warningsBox,
    bpCard(date, part, refreshWarnings),
    moodCard(part),
    medsCard(part, partKey, navigate),
    complaintsCard(part, refreshWarnings),
    sideEffectsCard(part),
    noteCard(part),
    h('div', { class: 'row', style: { justifyContent: 'flex-end' } }, button(t.done, back, { variant: 'filled', iconName: 'check' })),
  );
  refreshWarnings();

  return {
    el: h(
      'div',
      null,
      topAppBar(t.parts[partKey], {
        back,
        sub: fmtDate(date),
        actions: [iconButton('check', t.done, back)],
      }),
      content,
    ),
  };
}

// ---------- Bloeddruk ----------

function bpCard(date, part, refreshWarnings) {
  if (!part.readings.length) part.readings.push(newReading(date));
  const list = h('div', { class: 'stack' });
  const avgBox = h('div');

  const refreshAvg = () => {
    const avg = partAverage(part);
    if (!avg) {
      avgBox.replaceChildren();
      return;
    }
    const target = inTarget(avg);
    avgBox.replaceChildren(
      h(
        'div',
        { class: 'avg-box' },
        h('span', { class: 'value' }, `${avg.sys}/${avg.dia}`),
        h('div', { class: 'grow' }, h('div', { class: 'body-m muted' }, `${t.mmHg} · ${t.averageOf(avg.n)}`), avg.pulse ? h('div', { class: 'body-m muted' }, `${t.pulse} ${avg.pulse} ${t.bpm}`) : null),
        h('div', { class: 'row' }, showCats() ? catBadge(avg.category) : null, h('span', { class: `cat-badge ${target ? 'cat-normal' : 'cat-neutral'}` }, target ? t.inTarget : t.aboveTarget)),
      ),
    );
  };

  const changed = () => {
    refreshAvg();
    refreshWarnings();
    save();
  };

  const renderList = () => {
    list.replaceChildren();
    part.readings.forEach((r, i) => {
      if (i > 0) list.appendChild(h('div', { class: 'reading-sep' }));
      list.appendChild(readingRow(r, i, part, changed, renderList));
    });
  };
  renderList();
  refreshAvg();

  return h(
    'section',
    { class: 'card' },
    cardHead('heartPulse', t.bpTitle, t.bpTip),
    h(
      'div',
      { class: 'stack' },
      list,
      h('div', null, button(t.addReading, () => {
        part.readings.push(newReading(date));
        renderList();
        const inputs = list.querySelectorAll('.reading:last-child input');
        if (inputs[1]) inputs[1].focus();
      }, { variant: 'tonal', iconName: 'plus' })),
      avgBox,
      h('div', { class: 'label-l muted', style: { marginTop: '4px' } }, t.conditions),
      h('div', { class: 'body-s muted' }, t.arm),
      segmented(
        [
          { value: 'left', label: t.arms.left },
          { value: 'right', label: t.arms.right },
        ],
        part.arm,
        v => {
          part.arm = v;
          save();
        },
        { label: t.arm },
      ),
      h('div', { class: 'body-s muted' }, t.position),
      segmented(
        [
          { value: 'sitting', label: t.positions.sitting },
          { value: 'standing', label: t.positions.standing },
          { value: 'lying', label: t.positions.lying },
        ],
        part.position,
        v => {
          part.position = v;
          save();
        },
        { label: t.position },
      ),
    ),
  );
}

function newReading(date) {
  return { id: uid(), time: date === todayKey() ? nowTime() : '', sys: null, dia: null, pulse: null };
}

function readingRow(r, index, part, changed, renderList) {
  const num = (key, label) =>
    textField(
      label,
      r[key] ?? '',
      v => {
        r[key] = numberValue(v, { int: true });
        changed();
      },
      { type: 'number', inputmode: 'numeric', min: 0, max: 300 },
    );
  const time = textField(
    t.time,
    r.time || '',
    v => {
      r.time = v;
      save();
    },
    { type: 'time', cls: 'time' },
  );
  const del = h(
    'div',
    { class: 'del' },
    iconButton('deleteOutline', t.delete, () => {
      part.readings.splice(index, 1);
      if (!part.readings.length) part.readings.push({ id: uid(), time: '', sys: null, dia: null, pulse: null });
      renderList();
      changed();
    }),
  );
  return h('div', { class: 'reading', 'aria-label': t.readingN(index + 1) }, time, num('sys', t.systolic), num('dia', t.diastolic), num('pulse', t.pulseShort), del);
}

// ---------- Gevoel en stress ----------

function moodCard(part) {
  const picker = h('div', { class: 'mood-picker', role: 'radiogroup', 'aria-label': t.moodTitle });
  const buttons = t.moods.map((label, i) =>
    h(
      'button',
      {
        type: 'button',
        role: 'radio',
        class: part.mood === i + 1 ? 'selected' : '',
        'aria-checked': String(part.mood === i + 1),
        onclick: () => {
          part.mood = part.mood === i + 1 ? null : i + 1;
          buttons.forEach((b, j) => {
            b.classList.toggle('selected', part.mood === j + 1);
            b.setAttribute('aria-checked', String(part.mood === j + 1));
          });
          save();
        },
      },
      icon(MOOD_ICONS[i]),
      label,
    ),
  );
  buttons.forEach(b => picker.appendChild(b));

  return h(
    'section',
    { class: 'card' },
    cardHead('emoticonHappyOutline', t.moodTitle),
    h(
      'div',
      { class: 'stack' },
      picker,
      h('div', { class: 'label-l muted', style: { marginTop: '4px' } }, t.stressTitle),
      segmented(
        t.stressLevels.map((label, i) => ({ value: i + 1, label })),
        part.stress,
        v => {
          part.stress = v;
          save();
        },
        { compact: true, label: t.stressTitle },
      ),
    ),
  );
}

// ---------- Medicatie ----------

function medsCard(part, partKey, navigate) {
  const body = h('div', { class: 'stack' });
  let showAll = false;

  const render = () => {
    body.replaceChildren();
    const active = activeMeds();
    if (!state.meds.filter(m => !m.deleted).length && !Object.keys(part.meds).length) {
      body.append(h('p', { class: 'hint' }, t.noMedsYet), h('div', null, button(t.manageMeds, () => navigate('#/meds'), { variant: 'tonal', iconName: 'pill' })));
      return;
    }
    const scheduled = active.filter(m => (m.parts || []).includes(partKey));
    const recorded = Object.keys(part.meds).map(medById).filter(Boolean);
    const shown = [...new Map([...scheduled, ...recorded, ...(showAll ? active : [])].map(m => [m.id, m])).values()];
    if (!shown.length) body.appendChild(h('p', { class: 'hint' }, t.noMedsHere));
    for (const med of shown) {
      const value = part.meds[med.id];
      body.appendChild(
        h(
          'div',
          { class: 'med-row' },
          h('div', { class: 'row nowrap' }, icon('pill', 's20'), h('span', { class: 'body-l' }, medLabel(med))),
          segmented(
            [
              { value: true, label: t.medTaken, icon: 'checkCircle' },
              { value: false, label: t.medSkipped, icon: 'closeCircle' },
            ],
            value === undefined ? null : value,
            v => {
              if (v === null) delete part.meds[med.id];
              else part.meds[med.id] = v;
              save();
            },
            { label: medLabel(med) },
          ),
        ),
      );
    }
    const others = active.filter(m => !shown.includes(m));
    const actions = h('div', { class: 'row' });
    if (others.length && !showAll) {
      actions.appendChild(button(t.showAllMeds, () => {
        showAll = true;
        render();
      }, { iconName: 'plus' }));
    }
    actions.appendChild(button(t.manageMeds, () => navigate('#/meds'), { iconName: 'cogOutline' }));
    body.appendChild(actions);
  };
  render();

  return h('section', { class: 'card' }, cardHead('pill', t.medsTitle), body);
}

// ---------- Klachten ----------

function complaintsCard(part, refreshWarnings) {
  const details = h('div', { class: 'stack' });
  const chipsWrap = h('div', { class: 'chips' });

  const renderDetails = () => {
    details.replaceChildren();
    for (const c of COMPLAINTS) {
      if (!part.complaints[c]) continue;
      const block = h(
        'div',
        { class: 'complaint-detail' },
        h('div', { class: 'label-l' }, t.complaints[c]),
        segmented(
          t.severities.map((label, i) => ({ value: i + 1, label })),
          part.complaints[c],
          v => {
            part.complaints[c] = v;
            save();
          },
          { allowNone: false, label: t.complaints[c] },
        ),
        c === 'otherPain'
          ? textField(t.painLocation, part.painLocation, v => {
              part.painLocation = v;
              save();
            })
          : null,
      );
      details.appendChild(block);
    }
  };

  for (const c of COMPLAINTS) {
    chipsWrap.appendChild(
      chip(t.complaints[c], !!part.complaints[c], (e, el) => {
        if (part.complaints[c]) delete part.complaints[c];
        else part.complaints[c] = 1;
        const sel = !!part.complaints[c];
        el.classList.toggle('selected', sel);
        el.setAttribute('aria-pressed', String(sel));
        renderDetails();
        refreshWarnings();
        save();
      }),
    );
  }
  renderDetails();

  return h('section', { class: 'card' }, cardHead('stethoscope', t.complaintsTitle, t.complaintsHint), h('div', { class: 'stack' }, chipsWrap, details));
}

function sideEffectsCard(part) {
  const meds = state.meds.filter(m => !m.deleted || m.id === part.sideEffectMed);
  return h(
    'section',
    { class: 'card' },
    cardHead('alertOutline', t.sideEffectsTitle),
    h(
      'div',
      { class: 'stack' },
      textField(t.sideEffectsLabel, part.sideEffects, v => {
        part.sideEffects = v;
        save();
      }),
      meds.length
        ? selectField(
            t.sideEffectsMed,
            [{ value: '', label: t.sideEffectsUnknown }, ...meds.map(m => ({ value: m.id, label: medLabel(m) }))],
            part.sideEffectMed,
            v => {
              part.sideEffectMed = v;
              save();
            },
          )
        : null,
    ),
  );
}

function noteCard(part) {
  return h(
    'section',
    { class: 'card' },
    cardHead('noteTextOutline', t.note),
    textField(
      t.notePlaceholder,
      part.note,
      v => {
        part.note = v;
        save();
      },
      { multiline: true },
    ),
  );
}
