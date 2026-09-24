import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { getLocales } from 'expo-localization';
import { I18nManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { mergedTranslations } from './resources';

const locale = getLocales()[0]?.languageCode ?? 'en';
const supported = Object.keys(mergedTranslations);
const deviceLanguage = supported.includes(locale) ? locale : 'en';
const LANGUAGE_STORAGE_KEY = 'ximo-language';

if (typeof I18nManager !== 'undefined') {
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(deviceLanguage === 'ar');
}

i18n
  .use(initReactI18next)
  .init({
    resources: Object.fromEntries(
      Object.entries(mergedTranslations).map(([lang, t]) => [lang, { translation: t }])
    ),
    lng: deviceLanguage,
    // Supported locales are expected to be complete; never mask missing keys
    // with English at runtime.
    fallbackLng: false,
    interpolation: { escapeValue: false },
    compatibilityJSON: 'v4',
  });

export default i18n;
export const supportedLanguages = supported;
export const detectedLang = deviceLanguage;

export async function setAppLanguage(language: string): Promise<void> {
  if (!supported.includes(language)) {
    throw new Error(`Unsupported language: ${language}`);
  }
  await AsyncStorage.setItem(LANGUAGE_STORAGE_KEY, language);
  await i18n.changeLanguage(language);
  setLayoutDirection(language);
}

void AsyncStorage.getItem(LANGUAGE_STORAGE_KEY).then(language => {
  if (language && supported.includes(language)) {
    setLayoutDirection(language);
    return i18n.changeLanguage(language);
  }
}).catch(error => {
  console.warn('Unable to restore saved language preference', error);
});

function setLayoutDirection(language: string) {
  if (typeof I18nManager === 'undefined') return;
  I18nManager.allowRTL(true);
  // React Native applies a changed layout direction after the next app start;
  // text direction itself updates immediately with the active locale.
  I18nManager.forceRTL(language === 'ar');
}
