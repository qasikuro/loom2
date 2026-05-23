import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';

import { translations } from './translations';

const locale = getLocales()[0]?.languageCode ?? 'en';
const supported = Object.keys(translations);
const lng = supported.includes(locale) ? locale : 'en';

if (typeof I18nManager !== 'undefined') {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(lng === 'ar');
}

i18n
  .use(initReactI18next)
  .init({
    resources: Object.fromEntries(
      Object.entries(translations).map(([lang, t]) => [lang, { translation: t }])
    ),
    lng,
    fallbackLng: 'en',
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
export { lng as detectedLang };
