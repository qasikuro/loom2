import { useEffect, useState } from 'react';
import { en, type LandingCopy } from './en';
import { ja } from './ja';
import { es } from './es';
import { tr } from './tr';
import { fr } from './fr';
import { de } from './de';
import { pt } from './pt';
import { ko } from './ko';
import { zh } from './zh';
import { ru } from './ru';
import { ar } from './ar';
import { it } from './it';

// Match the supported locale codes in the Ximo app's i18n resources.
export const languageNames = {
  en: 'English',
  ja: '日本語',
  es: 'Español',
  tr: 'Türkçe',
  fr: 'Français',
  de: 'Deutsch',
  pt: 'Português',
  ko: '한국어',
  zh: '中文',
  ru: 'Русский',
  ar: 'العربية',
  it: 'Italiano',
} as const;

export type LandingLanguage = keyof typeof languageNames;

const resources: Record<LandingLanguage, LandingCopy> = {
  en, ja, es, tr, fr, de, pt, ko, zh, ru, ar, it,
};
const storageKey = 'storigam-landing-language';

function supportedLanguage(value: string | null): LandingLanguage | null {
  const code = value?.toLowerCase().split(/[-_]/)[0];
  return code && Object.prototype.hasOwnProperty.call(languageNames, code)
    ? code as LandingLanguage
    : null;
}

function initialLanguage(): LandingLanguage {
  const fromLink = supportedLanguage(new URLSearchParams(window.location.search).get('lang'));
  if (fromLink) return fromLink;

  try {
    const saved = supportedLanguage(window.localStorage.getItem(storageKey));
    if (saved) return saved;
  } catch {
    // A private browser may block storage; browser language still works.
  }

  for (const locale of navigator.languages?.length ? navigator.languages : [navigator.language]) {
    const match = supportedLanguage(locale);
    if (match) return match;
  }
  return 'en';
}

export function useLandingLanguage() {
  const [language, setLanguage] = useState<LandingLanguage>(initialLanguage);
  const copy = resources[language];

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
    document.title = copy.seoTitle;
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ]) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', copy.seoDescription);
    }
    for (const selector of ['meta[property="og:title"]', 'meta[name="twitter:title"]']) {
      document.querySelector<HTMLMetaElement>(selector)?.setAttribute('content', copy.seoTitle);
    }
    try {
      window.localStorage.setItem(storageKey, language);
    } catch {
      // The page still works without persistent storage.
    }
  }, [language, copy]);

  function chooseLanguage(next: LandingLanguage) {
    setLanguage(next);
    const url = new URL(window.location.href);
    url.searchParams.set('lang', next);
    window.history.replaceState(window.history.state, '', url);
  }

  return { language, copy, chooseLanguage };
}