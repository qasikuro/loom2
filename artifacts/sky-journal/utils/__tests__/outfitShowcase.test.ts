import { describe, expect, it } from 'vitest';
import {
  getOutfitShowcase,
  getOutfitShowcaseTransition,
  visibleOutfitTags,
  withOutfitShowcase,
  withOutfitShowcaseTransition,
} from '../outfitShowcase';
import { outfitJournalTranslations, supportedOutfitJournalLocales } from '@/i18n/outfitJournalTranslations';

describe('outfit showcase metadata', () => {
  it('reads only supported saved showcase styles', () => {
    expect(getOutfitShowcase(['Cozy', 'showcase:dreamy'])).toBe('dreamy');
    expect(getOutfitShowcase(['showcase:unknown'])).toBeNull();
    expect(getOutfitShowcase([])).toBeNull();
  });

  it('keeps presentation metadata out of visible outfit tags', () => {
    expect(visibleOutfitTags(['Cozy', 'vibe:romantic', 'showcase:holographic'])).toEqual(['Cozy']);
  });

  it('replaces old showcase metadata without disturbing user tags or vibe', () => {
    expect(withOutfitShowcase(
      ['Cozy', 'vibe:dreamy', 'showcase:dreamy'],
      'holographic',
    )).toEqual(['Cozy', 'vibe:dreamy', 'showcase:holographic']);
    expect(withOutfitShowcase(['Cozy', 'showcase:dreamy'], null)).toEqual(['Cozy']);
  });

  it('reads only supported transitions and safely defaults legacy or invalid tags to fade', () => {
    expect(getOutfitShowcaseTransition(['Cozy', 'showcase-transition:parallax'])).toBe('parallax');
    expect(getOutfitShowcaseTransition(['showcase-transition:unknown'])).toBe('fade');
    expect(getOutfitShowcaseTransition([])).toBe('fade');
  });

  it('replaces transition metadata and keeps it out of visible outfit tags', () => {
    expect(withOutfitShowcaseTransition(
      ['Cozy', 'vibe:romantic', 'showcase-transition:zoom'],
      'slide',
    )).toEqual(['Cozy', 'vibe:romantic', 'showcase-transition:slide']);
    expect(withOutfitShowcaseTransition(
      ['Cozy', 'showcase-transition:parallax'],
      null,
    )).toEqual(['Cozy']);
    expect(visibleOutfitTags([
      'Cozy',
      'showcase:holographic',
      'showcase-transition:parallax',
    ])).toEqual(['Cozy']);
  });

  it('provides translated transition choices for every supported locale', () => {
    for (const locale of supportedOutfitJournalLocales) {
      const translations = outfitJournalTranslations[locale].outfitJournal;
      expect(translations.showcaseTransition).toBeTruthy();
      for (const transition of ['Fade', 'Zoom', 'Slide', 'Pan', 'Parallax']) {
        expect(translations[`showcaseTransition${transition}`]).toBeTruthy();
      }
    }
  });
});
