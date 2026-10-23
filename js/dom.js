// Kleine DOM-helpers en Material-componenten.
import { icons } from './icons.js';
import { t } from './i18n.js';

/** Maakt een element: h('div', { class: 'x', onclick: fn }, kind1, kind2). */
export function h(tag, props, ...children) {
  const el = document.createElement(tag);
  if (props) {
    for (const [k, v] of Object.entries(props)) {
      if (v === null || v === undefined || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
      else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
      else if (k === 'html') el.innerHTML = v;
      else if (k in el && typeof v !== 'string') el[k] = v;
      else el.setAttribute(k, v === true ? '' : v);
    }
  }
  append(el, children);
  return el;
}

function append(el, children) {
  for (const c of children) {
    if (c === null || c === undefined || c === false) continue;
    if (Array.isArray(c)) append(el, c);
    else if (c instanceof Node) el.appendChild(c);
    else el.appendChild(document.createTextNode(String(c)));
  }
}

const SVG_NS = 'http://www.w3.org/2000/svg';

export function icon(name, cls = '') {
  const svg = document.createElementNS(SVG_NS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('class', `icon ${cls}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  const path = document.createElementNS(SVG_NS, 'path');
  path.setAttribute('d', icons[name] || '');
  svg.appendChild(path);
  return svg;
}

export function iconButton(name, label, onclick, extra = {}) {
  return h('button', { type: 'button', class: `icon-btn ${extra.class || ''}`, 'aria-label': label, title: label, onclick, disabled: extra.disabled }, icon(name));
}

export function button(text, onclick, { variant = 'text', iconName = null, cls = '', type = 'button', disabled = false } = {}) {
  return h(
    'button',
    { type, class: `btn ${variant} ${iconName ? 'with-icon' : ''} ${cls}`, onclick, disabled },
    iconName ? icon(iconName, 's18') : null,
    text,
  );
}

export function linkButton(text, href, { variant = 'text', iconName = null } = {}) {
  return h(
    'a',
    { class: `btn ${variant} ${iconName ? 'with-icon' : ''}`, href, target: '_blank', rel: 'noopener noreferrer' },
    iconName ? icon(iconName, 's18') : null,
    text,
  );
}

/** Gesegmenteerde knop. Opnieuw tikken op de gekozen optie zet hem uit (alles optioneel). */
export function segmented(options, value, onchange, { compact = false, allowNone = true, label = '' } = {}) {
  const wrap = h('div', { class: `segmented ${compact ? 'compact' : ''}`, role: 'radiogroup', 'aria-label': label });
  let current = value;
  const buttons = options.map(opt => {
    const b = h(
      'button',
      {
        type: 'button',
        role: 'radio',
        'aria-checked': String(opt.value === current),
        class: opt.value === current ? 'selected' : '',
        onclick: () => {
          current = current === opt.value && allowNone ? null : opt.value;
          buttons.forEach((bb, i) => {
            const sel = options[i].value === current;
            bb.classList.toggle('selected', sel);
            bb.setAttribute('aria-checked', String(sel));
          });
          onchange(current);
        },
      },
      opt.icon ? icon(opt.icon, 's18') : null,
      opt.label,
    );
    return b;
  });
  buttons.forEach(b => wrap.appendChild(b));
  return wrap;
}

export function chip(label, selected, onclick, { iconName = null, cls = '' } = {}) {
  const el = h(
    'button',
    { type: 'button', class: `chip ${selected ? 'selected' : ''} ${cls}`, 'aria-pressed': String(!!selected), onclick: e => onclick(e, el) },
    h('span', { class: 'check' }, icon('check', 's18')),
    iconName ? icon(iconName, 's18') : null,
    label,
  );
  return el;
}

let fieldId = 0;

/** Outlined tekstveld met zwevend label. */
export function textField(label, value, oninput, { type = 'text', suffix = '', inputmode = null, min = null, max = null, step = null, cls = '', placeholder = ' ', multiline = false, autocomplete = 'off' } = {}) {
  const id = `f${++fieldId}`;
  const input = multiline
    ? h('textarea', { id, placeholder, rows: 3 })
    : h('input', { id, type, placeholder, inputmode, min, max, step, autocomplete });
  input.value = value ?? '';
  input.addEventListener('input', () => oninput(input.value, input));
  return h('div', { class: `tf ${suffix ? 'has-suffix' : ''} ${cls}` }, input, h('label', { for: id }, label), suffix ? h('span', { class: 'suffix' }, suffix) : null);
}

export function selectField(label, options, value, onchange) {
  const id = `f${++fieldId}`;
  const sel = h('select', { id }, options.map(o => h('option', { value: o.value }, o.label)));
  sel.value = value ?? '';
  sel.addEventListener('change', () => onchange(sel.value));
  return h('div', { class: 'tf' }, sel, h('label', { for: id }, label));
}

export function numberValue(str, { int = false } = {}) {
  if (str === '' || str === null || str === undefined) return null;
  const n = Number(String(str).replace(',', '.'));
  if (!Number.isFinite(n)) return null;
  return int ? Math.round(n) : n;
}

export function switchEl(checked, onchange, label) {
  const input = h('input', { type: 'checkbox', role: 'switch', 'aria-label': label });
  input.checked = !!checked;
  input.addEventListener('change', () => onchange(input.checked));
  return h('span', { class: 'switch' }, input, h('span', { class: 'track' }), h('span', { class: 'thumb' }));
}

export function stepper(value, onchange, { min = 0, max = 30, label = '' } = {}) {
  let v = value;
  const display = h('span', { class: 'value', 'aria-live': 'polite' }, v ?? '–');
  const set = nv => {
    v = nv;
    display.textContent = v ?? '–';
    onchange(v);
  };
  return h(
    'div',
    { class: 'stepper', role: 'group', 'aria-label': label },
    iconButton('minus', '−', () => set(v == null ? null : v <= min ? null : v - 1)),
    display,
    iconButton('plus', '+', () => set(v == null ? min : Math.min(max, v + 1))),
  );
}

export function card(children, cls = '') {
  return h('section', { class: `card ${cls}` }, children);
}

export function cardHead(iconName, title, sub = null, trailing = null) {
  return h(
    'div',
    { class: 'card-head' },
    iconName ? h('span', { class: 'lead' }, icon(iconName)) : null,
    h('div', { class: 'grow' }, h('h2', { class: 'title-m' }, title), sub ? h('div', { class: 'body-m muted' }, sub) : null),
    trailing,
  );
}

export function catBadge(category) {
  if (!category) return null;
  return h('span', { class: `cat-badge cat-${category}` }, t.categories[category]);
}

// ---------- Dialoog ----------

export function dialog({ title, body, iconName = null, actions = [] }) {
  return new Promise(resolve => {
    const dlg = h('dialog', { 'aria-label': title });
    const close = val => {
      dlg.close();
      dlg.remove();
      resolve(val);
    };
    dlg.append(
      iconName ? h('div', { class: 'dialog-icon' }, icon(iconName)) : null,
      h('h2', null, title),
      h('div', { class: 'dialog-body' }, body),
      h(
        'div',
        { class: 'dialog-actions' },
        actions.map(a => button(a.label, () => close(a.value), { variant: a.variant || 'text', cls: a.cls || '' })),
      ),
    );
    dlg.addEventListener('cancel', e => {
      e.preventDefault();
      close(null);
    });
    dlg.addEventListener('click', e => {
      if (e.target === dlg) close(null);
    });
    document.body.appendChild(dlg);
    dlg.showModal();
  });
}

export function confirmDialog(title, text, confirmLabel, { danger = false, iconName = null } = {}) {
  return dialog({
    title,
    body: text,
    iconName,
    actions: [
      { label: t.cancel, value: false },
      { label: confirmLabel, value: true, cls: danger ? 'danger' : '' },
    ],
  });
}

// ---------- Snackbar ----------

let snackEl = null;
let snackTimer = null;

export function snackbar(text, action = null, duration = 4000) {
  if (!snackEl) {
    snackEl = h('div', { class: 'snackbar', role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(snackEl);
  }
  snackEl.replaceChildren(h('span', { class: 'grow' }, text));
  if (action) snackEl.appendChild(button(action.label, () => { hide(); action.onclick(); }));
  const hide = () => snackEl.classList.remove('show');
  clearTimeout(snackTimer);
  requestAnimationFrame(() => snackEl.classList.add('show'));
  if (duration) snackTimer = setTimeout(hide, duration);
}

/** Bestand downloaden (werkt ook in Safari op iPhone). */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: filename, style: { display: 'none' } });
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    URL.revokeObjectURL(url);
    a.remove();
  }, 2000);
}
