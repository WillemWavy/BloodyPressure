import { h, icon, linkButton } from '../dom.js';
import { t } from '../i18n.js';
import { APP_VERSION } from '../store.js';
import { topAppBar } from './common.js';

export const GITHUB_URL = 'https://github.com/WillemWavy/BloodyPressure';
export const THRONE_URL = 'https://throne.com/willemwavy';

export function aboutView({ goBack }) {
  const content = h(
    'div',
    { class: 'content' },
    h(
      'div',
      { class: 'about-hero' },
      h('img', { src: 'icons/icon-512.png', alt: '' }),
      h('h2', { class: 'headline-s', style: { margin: '8px 0 0' } }, t.appName),
      h('div', { class: 'label-l muted' }, t.aboutVersion(APP_VERSION)),
      h('div', { class: 'title-m' }, t.aboutMadeBy),
    ),
    h('div', { class: 'about-links' }, linkButton(t.aboutGithub, GITHUB_URL, { variant: 'outlined', iconName: 'github' }), linkButton(t.aboutThrone, THRONE_URL, { variant: 'filled', iconName: 'crown' })),
    h('p', { class: 'hint', style: { textAlign: 'center', margin: '0' } }, t.aboutThroneHint),
    h('section', { class: 'card' }, h('p', { class: 'body-l', style: { margin: 0 } }, t.aboutDescription)),
    h(
      'section',
      { class: 'card elevated' },
      h('div', { class: 'card-head' }, h('span', { class: 'lead' }, icon('shieldCheckOutline')), h('h3', { class: 'title-m grow' }, t.aboutPrivacyTitle)),
      h('p', { class: 'body-m muted', style: { margin: 0 } }, t.aboutPrivacy),
    ),
    h(
      'section',
      { class: 'card elevated' },
      h('div', { class: 'card-head' }, h('span', { class: 'lead' }, icon('stethoscope')), h('h3', { class: 'title-m grow' }, t.aboutMedicalTitle)),
      h('p', { class: 'body-m muted', style: { margin: 0 } }, t.aboutMedical),
    ),
    h('p', { class: 'body-s muted', style: { textAlign: 'center' } }, t.aboutCredits),
  );
  return { el: h('div', null, topAppBar(t.about, { back: () => goBack('#/more') }), content) };
}
