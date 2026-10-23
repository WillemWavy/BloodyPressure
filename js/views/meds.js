import { h, icon, button, textField, chip, switchEl, confirmDialog } from '../dom.js';
import { t } from '../i18n.js';
import { state, save, uid, PARTS, medLabel } from '../store.js';
import { topAppBar } from './common.js';

export function medsView({ goBack }) {
  const list = h('div', { class: 'list' });
  const empty = h('p', { class: 'hint', style: { margin: '0 4px' } }, t.noMedsYet);

  const render = () => {
    const meds = state.meds.filter(m => !m.deleted);
    list.replaceChildren();
    list.style.display = meds.length ? '' : 'none';
    empty.style.display = meds.length ? 'none' : '';
    for (const med of meds) {
      const when = (med.parts || []).map(p => t.parts[p]).join(', ');
      list.appendChild(
        h(
          'button',
          { type: 'button', class: 'list-item', onclick: () => editMed(med, render) },
          h('span', { class: 'lead-icon' }, icon('pill')),
          h(
            'span',
            { class: 'text' },
            h('div', { class: 'headline' }, medLabel(med)),
            h('div', { class: 'support' }, [med.active === false ? t.medStopped : null, when].filter(Boolean).join(' · ') || '—'),
          ),
          icon('pencil', 's20'),
        ),
      );
    }
  };
  render();

  const content = h(
    'div',
    { class: 'content' },
    h('p', { class: 'hint', style: { margin: '0 4px' } }, t.medsIntro),
    empty,
    list,
    h('div', null, button(t.addMed, () => editMed(null, render), { variant: 'filled', iconName: 'plus' })),
  );

  return { el: h('div', null, topAppBar(t.medsScreen, { back: () => goBack('#/more') }), content) };
}

/** Dialoog om een medicijn toe te voegen of te bewerken. */
function editMed(med, onDone) {
  const draft = med ? { ...med, parts: [...(med.parts || [])] } : { id: uid(), name: '', dose: '', parts: ['morning'], active: true };
  const dlg = h('dialog', { 'aria-label': med ? t.editMed : t.addMed });
  const close = () => {
    dlg.close();
    dlg.remove();
  };

  const partChips = h(
    'div',
    { class: 'chips' },
    PARTS.map(p =>
      chip(t.parts[p], draft.parts.includes(p), (e, el) => {
        if (draft.parts.includes(p)) draft.parts = draft.parts.filter(x => x !== p);
        else draft.parts = PARTS.filter(x => x === p || draft.parts.includes(x));
        el.classList.toggle('selected', draft.parts.includes(p));
      }),
    ),
  );

  const nameField = textField(t.medName, draft.name, v => (draft.name = v));
  const saveBtn = button(t.save, () => {
    draft.name = draft.name.trim();
    draft.dose = draft.dose.trim();
    if (!draft.name) {
      nameField.querySelector('input').focus();
      return;
    }
    const idx = state.meds.findIndex(m => m.id === draft.id);
    if (idx >= 0) state.meds[idx] = draft;
    else state.meds.push(draft);
    save(true);
    close();
    onDone();
  });

  dlg.append(
    h('h2', null, med ? t.editMed : t.addMed),
    h(
      'div',
      { class: 'stack' },
      nameField,
      textField(t.medDose, draft.dose, v => (draft.dose = v)),
      h('div', { class: 'label-l muted' }, t.medWhen),
      partChips,
      h('label', { class: 'field-row' }, h('span', { class: 'label body-l' }, t.medActive), switchEl(draft.active !== false, v => (draft.active = v), t.medActive)),
    ),
    h(
      'div',
      { class: 'dialog-actions' },
      med
        ? button(t.delete, async () => {
            close();
            const ok = await confirmDialog(t.medDeleteTitle, t.medDeleteText, t.delete, { danger: true, iconName: 'deleteOutline' });
            if (!ok) return;
            const m = state.meds.find(x => x.id === med.id);
            if (m) m.deleted = true;
            save(true);
            onDone();
          }, { cls: 'danger' })
        : null,
      h('span', { class: 'spacer' }),
      button(t.cancel, close),
      saveBtn,
    ),
  );
  dlg.addEventListener('cancel', e => {
    e.preventDefault();
    close();
  });
  document.body.appendChild(dlg);
  dlg.showModal();
  if (!med) setTimeout(() => nameField.querySelector('input').focus(), 50);
}
