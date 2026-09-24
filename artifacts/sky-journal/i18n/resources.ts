import { translations } from './translations';
import { featureTranslations } from './featureTranslations';
import { socialTranslations } from './socialTranslations';
import { socialTrFrDeTranslations } from './socialtrfrde';
import { socialPtKoZh } from './socialptkozh';
import { socialRuaritTranslations } from './socialruarit';
import { componentTranslations } from './componentTranslations';
import { publicProfileTranslations } from './publicProfileTranslations';
import { reelTranslations } from './reelTranslations';
import { shellTranslations } from './shellTranslations';
import { studioEditorTranslations } from './studioEditorTranslations';
import { studioReaderTranslations } from './studioReaderTranslations';
import { discoverLogTranslations } from './discoverLogTranslations';
import { outfitJournalTranslations } from './outfitJournalTranslations';

type Tree = Record<string, unknown>;

function mergeTree(base: Tree, additional: Tree): Tree {
  const merged = { ...base };
  for (const [key, value] of Object.entries(additional)) {
    const previous = merged[key];
    merged[key] =
      value && typeof value === 'object' && !Array.isArray(value)
      && previous && typeof previous === 'object' && !Array.isArray(previous)
        ? mergeTree(previous as Tree, value as Tree)
        : value;
  }
  return merged;
}

// The English catalog defines the supported locale list. Per-feature resources
// are merged deeply so adding a label never replaces an existing namespace.
const extensions: Tree[] = [
  featureTranslations,
  socialTranslations,
  socialTrFrDeTranslations,
  socialPtKoZh,
  socialRuaritTranslations,
  componentTranslations,
  publicProfileTranslations,
  reelTranslations,
  shellTranslations,
  studioEditorTranslations,
  studioReaderTranslations,
  discoverLogTranslations,
  outfitJournalTranslations,
];

export const mergedTranslations = Object.fromEntries(
  Object.entries(translations).map(([locale, base]) => [
    locale,
    extensions.reduce(
      (result, extension) => mergeTree(result, (extension[locale] ?? {}) as Tree),
      base as Tree,
    ),
  ]),
) as Record<keyof typeof translations, Tree>;