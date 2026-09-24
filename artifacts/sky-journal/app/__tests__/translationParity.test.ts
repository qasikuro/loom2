import { describe, expect, it } from 'vitest';
import { translations } from '../../i18n/translations';
import { mergedTranslations } from '../../i18n/resources';

function flatten(value: unknown, prefix = ''): Record<string, string> {
  if (!value || typeof value !== 'object') return {};
  return Object.entries(value).reduce<Record<string, string>>((result, [key, child]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') result[path] = child;
    else Object.assign(result, flatten(child, path));
    return result;
  }, {});
}

function interpolationNames(value: string): string[] {
  return [...value.matchAll(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g)]
    .map(match => match[1])
    .sort();
}

describe('translation resources', () => {
  const english = flatten(translations.en);
  const intentionalIdenticalStrings: Record<string, string[]> = {
    ja: ['auth.emailPlaceholder'],
    es: ['profile.outfits'],
    fr: ['common.public', 'nav.journal', 'profile.journal', 'profile.suggestions', 'log.moments', 'log.moment', 'log.composeMoment', 'create.pages', 'create.pagesPlural', 'create.descLabel', 'create.pageCount', 'journal.journalTitle', 'settings.messages'],
    de: ['discover.vibes', 'profile.outfits', 'log.moment', 'log.composeMoment'],
    pt: ['discover.vibes'],
    ko: ['auth.emailPlaceholder', 'onboarding.yourUsername'],
    zh: ['auth.emailPlaceholder'],
    ru: ['auth.emailPlaceholder'],
    ar: ['auth.emailPlaceholder', 'onboarding.yourUsername'],
    it: ['nav.home', 'auth.password', 'settings.privacy'],
  };

  it('has matching English key parity in every supported locale', () => {
    for (const [language, resource] of Object.entries(translations)) {
      expect(Object.keys(flatten(resource)).sort(), language).toEqual(Object.keys(english).sort());
    }
  });

  it('preserves interpolation variables in every locale', () => {
    for (const [language, resource] of Object.entries(translations)) {
      const localized = flatten(resource);
      for (const [key, englishValue] of Object.entries(english)) {
        expect(interpolationNames(localized[key]), `${language}:${key}`)
          .toEqual(interpolationNames(englishValue));
      }
    }
  });

  it('translates authored English keys unless identical wording is appropriate', () => {
    for (const [language, resource] of Object.entries(translations)) {
      if (language === 'en') continue;
      const localized = flatten(resource);
      const allowed = intentionalIdenticalStrings[language] ?? [];
      for (const [key, value] of Object.entries(localized)) {
        if (value === english[key]) {
          expect(allowed, `${language}:${key} unexpectedly matches English`).toContain(key);
        }
      }
    }
  });
});

describe('complete app translations', () => {
  const english = flatten(mergedTranslations.en);

  it('has matching keys and interpolation variables in every merged locale', () => {
    for (const [language, resource] of Object.entries(mergedTranslations)) {
      const localized = flatten(resource);
      expect(Object.keys(localized).sort(), language).toEqual(Object.keys(english).sort());
      for (const [key, source] of Object.entries(english)) {
        expect(interpolationNames(localized[key]), `${language}:${key}`)
          .toEqual(interpolationNames(source));
      }
    }
  });
});