import { h, icon, segmented, textField, numberValue, switchEl, confirmDialog, snackbar, downloadBlob } from '../dom.js';
import { t } from '../i18n.js';
import { state, save, backupJson, parseBackup, restoreBackup, wipeAll, activeMeds } from '../store.js';
import { todayKey, fmtLong, toKey } from '../dates.js';
import { topAppBar } from './common.js';
import { applyTheme, applyLang, installPrompt } from '../app.js';

export function moreView({ navigate, rerender }) {
  const meds = activeMeds();

  const listItem = (iconName, headline, support, onclick, trailing = icon('chevronRight', 's20')) =>
    h(
      'button',
      { type: 'button', class: 'list-item', onclick },
      h('span', { class: 'lead-icon' }, icon(iconName)),
      h('span', { class: 'text' }, h('div', { class: 'headline' }, headline), support ? h('div', { class: 'support' }, support) : null),
      trailing,
    );

  // Streefwaarde
  const target = h(
    'div',
    { class: 'grid-2' },
    textField(
      t.systolicLong,
      state.settings.targetSys,
      v => {
        const n = numberValue(v, { int: true });
        if (n && n > 60 && n < 250) {
          state.settings.targetSys = n;
          save();
        }
      },
      { type: 'number', inputmode: 'numeric', suffix: t.mmHg },
    ),
    textField(
      t.diastolicLong,
      state.settings.targetDia,
      v => {
        const n = numberValue(v, { int: true });
        if (n && n > 30 && n < 160) {
          state.settings.targetDia = n;
          save();
        }
      },
      { type: 'number', inputmode: 'numeric', suffix: t.mmHg },
    ),
  );

  const lastBackup = state.settings.lastBackup ? t.backupLast(fmtLong(toKey(new Date(state.settings.lastBackup)))) : t.backupNever;

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', style: { display: 'none' } });
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    fileInput.value = '';
    if (!file) return;
    const parsed = parseBackup(await file.text());
    if (!parsed) {
      snackbar(t.restoreInvalid);
      return;
    }
    const ok = await confirmDialog(t.restoreTitle, t.restoreText(parsed.dayCount, parsed.medCount), t.restoreConfirm, { danger: true, iconName: 'fileRestoreOutline' });
    if (!ok) return;
    restoreBackup(parsed);
    applyLang();
    applyTheme();
    rerender();
    snackbar(t.restoreDone);
  });

  const canShare = (() => {
    try {
      return !!(navigator.canShare && navigator.canShare({ files: [new File(['x'], 'x.json', { type: 'application/json' })] }));
    } catch {
      return false;
    }
  })();

  const makeBackup = async share => {
    try {
      const blob = new Blob([backupJson()], { type: 'application/json' });
      const name = `bloody-pressure-backup-${todayKey()}.json`;
      if (share) {
        try {
          await navigator.share({ files: [new File([blob], name, { type: 'application/json' })], title: name });
        } catch (e) {
          if (e && e.name === 'AbortError') return;
          throw e;
        }
      } else {
        downloadBlob(blob, name);
      }
      state.settings.lastBackup = new Date().toISOString();
      save(true);
      snackbar(t.backupSaved);
      rerender();
    } catch (e) {
      console.error(e);
      snackbar(t.backupFailed);
    }
  };

  const content = h(
    'div',
    { class: 'content' },
    h('h2', { class: 'section-title' }, t.settingsBp),
    h('div', { class: 'list' }, listItem('pill', t.manageMeds, meds.length ? meds.map(m => m.name).join(', ') : t.noMedsYet, () => navigate('#/meds'))),
    h('section', { class: 'card elevated' }, h('div', { class: 'card-head' }, h('span', { class: 'lead' }, icon('target')), h('div', { class: 'grow' }, h('h3', { class: 'title-m' }, t.targetTitle), h('div', { class: 'body-m muted' }, t.targetHint))), target),
    h(
      'div',
      { class: 'list' },
      h(
        'label',
        { class: 'list-item' },
        h('span', { class: 'lead-icon' }, icon('heartPulse')),
        h('span', { class: 'text' }, h('div', { class: 'headline' }, t.showCategories), h('div', { class: 'support' }, t.showCategoriesHint)),
        switchEl(state.settings.showCategories !== false, v => {
          state.settings.showCategories = v;
          save();
        }, t.showCategories),
      ),
    ),

    h('h2', { class: 'section-title' }, t.settingsDisplay),
    h(
      'section',
      { class: 'card elevated stack' },
      h('div', { class: 'row nowrap' }, icon('themeLightDark'), h('span', { class: 'title-s' }, t.theme)),
      segmented(
        ['auto', 'light', 'dark'].map(k => ({ value: k, label: t.themes[k] })),
        state.settings.theme,
        v => {
          state.settings.theme = v;
          save(true);
          applyTheme();
          rerender();
        },
        { allowNone: false, label: t.theme },
      ),
      h('div', { class: 'row nowrap', style: { marginTop: '8px' } }, icon('translate'), h('span', { class: 'title-s' }, t.language)),
      segmented(
        ['auto', 'nl', 'en'].map(k => ({ value: k, label: t.languages[k] })),
        state.settings.lang,
        v => {
          state.settings.lang = v;
          save(true);
          applyLang();
          rerender();
        },
        { allowNone: false, label: t.language },
      ),
    ),

    h('h2', { class: 'section-title' }, t.settingsData),
    h(
      'div',
      { class: 'list' },
      listItem('download', t.backupMake, `${t.backupMakeHint}. ${lastBackup}`, () => makeBackup(false), null),
      canShare ? listItem('shareVariant', t.backupShare, null, () => makeBackup(true), null) : null,
      listItem('fileRestoreOutline', t.backupRestore, t.backupRestoreHint, () => fileInput.click(), null),
      installPrompt
        ? listItem('cellphoneArrowDown', t.install, t.installHint, async () => {
            installPrompt.prompt();
            await installPrompt.userChoice.catch(() => null);
          }, null)
        : null,
      h(
        'button',
        {
          type: 'button',
          class: 'list-item',
          onclick: async () => {
            const ok = await confirmDialog(t.wipeTitle, t.wipeText, t.wipeConfirm, { danger: true, iconName: 'deleteForever' });
            if (!ok) return;
            wipeAll();
            applyLang();
            applyTheme();
            rerender();
            snackbar(t.wiped);
          },
        },
        h('span', { class: 'lead-icon', style: { color: 'var(--error)' } }, icon('deleteForever')),
        h('span', { class: 'text' }, h('div', { class: 'headline', style: { color: 'var(--error)' } }, t.wipe)),
      ),
    ),
    fileInput,

    h('div', { class: 'list', style: { marginTop: '8px' } }, listItem('informationOutline', t.about, null, () => navigate('#/about'))),
  );

  return { el: h('div', null, topAppBar(t.moreTitle), content) };
}
