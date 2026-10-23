import { h, icon, chip, textField, button, switchEl, snackbar, downloadBlob } from '../dom.js';
import { t } from '../i18n.js';
import { state, save } from '../store.js';
import { todayKey, isValidKey } from '../dates.js';
import { periodRange, daysInRange } from '../bp.js';
import { topAppBar } from './common.js';

let quick = 'd30';
let range = null;
const include = { charts: true, insights: true, table: true, lifestyle: true, notes: true };

export function reportView() {
  const today = todayKey();
  if (!range) range = periodRange(quick, today);

  const fromField = textField(t.from, range.from, v => {
    if (isValidKey(v)) range.from = v;
    setQuick(null);
  }, { type: 'date' });
  const toField = textField(t.to, range.to, v => {
    if (isValidKey(v)) range.to = v;
    setQuick(null);
  }, { type: 'date' });

  const chipKeys = Object.keys(t.reportQuick);
  const chips = h(
    'div',
    { class: 'chips scroll' },
    chipKeys.map(k =>
      chip(t.reportQuick[k], k === quick, () => {
        const map = { w2: 'w2', d30: 'd30', month: 'month', d90: 'd90', all: 'all' };
        range = periodRange(map[k], today);
        fromField.querySelector('input').value = range.from;
        toField.querySelector('input').value = range.to;
        setQuick(k);
      }),
    ),
  );
  function setQuick(k) {
    quick = k;
    chips.querySelectorAll('.chip').forEach((c, i) => {
      c.classList.toggle('selected', chipKeys[i] === quick);
      c.setAttribute('aria-pressed', String(chipKeys[i] === quick));
    });
  }

  const toggle = (key, label) =>
    h('label', { class: 'list-item' }, h('span', { class: 'text' }, h('div', { class: 'headline' }, label)), switchEl(include[key], v => (include[key] = v), label));

  const makeBtn = button(t.makePdf, async () => {
    const from = range.from <= range.to ? range.from : range.to;
    const to = range.from <= range.to ? range.to : range.from;
    if (!daysInRange(from, to).length) {
      snackbar(t.reportEmpty);
      return;
    }
    makeBtn.disabled = true;
    const label = makeBtn.lastChild;
    label.textContent = t.makingPdf;
    try {
      const { makePdf } = await import('../pdf.js');
      const { blob, filename } = await makePdf({ from, to, name: state.settings.reportName, include });
      downloadBlob(blob, filename);
      snackbar(t.pdfDone);
    } catch (e) {
      console.error(e);
      snackbar(t.pdfFailed);
    } finally {
      makeBtn.disabled = false;
      label.textContent = t.makePdf;
    }
  }, { variant: 'filled', iconName: 'filePdfBox', cls: 'block' });

  const content = h(
    'div',
    { class: 'content' },
    h('p', { class: 'hint', style: { margin: '0 4px' } }, t.reportIntro),
    h(
      'section',
      { class: 'card elevated stack' },
      h('div', { class: 'row nowrap' }, icon('calendarMonthOutline'), h('h2', { class: 'title-m' }, t.reportPeriod)),
      chips,
      h('div', { class: 'grid-2' }, fromField, toField),
      textField(t.reportName, state.settings.reportName, v => {
        state.settings.reportName = v;
        save();
      }),
    ),
    h('h2', { class: 'section-title' }, t.reportInclude),
    h(
      'div',
      { class: 'list' },
      toggle('charts', t.reportCharts),
      toggle('insights', t.reportInsights),
      toggle('table', t.reportTable),
      toggle('lifestyle', t.reportLifestyle),
      toggle('notes', t.reportNotes),
    ),
    makeBtn,
  );

  return { el: h('div', null, topAppBar(t.reportTitle), content) };
}
