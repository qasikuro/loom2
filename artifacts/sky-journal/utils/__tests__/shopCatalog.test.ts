import { describe, expect, it } from 'vitest';
import {
  animalEarFrameIds,
  dpCompanionFrameIds,
  filterShopCatalogByCategory,
  mergeAnimalEarFrames,
} from '../shopCatalog';

describe('mergeAnimalEarFrames', () => {
  it('restores missing ear frames from fallback beside Ember Fox without duplicating IDs', () => {
    const server = [
      { id: 'frame_moonlight', source: 'server' },
      { id: 'frame_ember_fox_ears', source: 'server' },
      { id: 'effect_fireflies', source: 'server' },
    ];
    const fallback = animalEarFrameIds.map(id => ({ id, source: 'fallback' }));

    const result = mergeAnimalEarFrames(server, fallback);

    expect(result.map(item => item.id)).toEqual([
      'frame_moonlight',
      ...animalEarFrameIds,
      'effect_fireflies',
    ]);
    expect(result.find(item => item.id === 'frame_ember_fox_ears')?.source).toBe('server');
    expect(result.filter(item => animalEarFrameIds.includes(item.id as typeof animalEarFrameIds[number]))).toHaveLength(3);
  });

  it('keeps other catalog items and appends the ear collection when Ember Fox is missing', () => {
    const result = mergeAnimalEarFrames(
      [{ id: 'effect_fireflies' }],
      animalEarFrameIds.map(id => ({ id })),
    );

    expect(result.map(item => item.id)).toEqual(['effect_fireflies', ...animalEarFrameIds]);
  });

  it('preserves the complete fallback catalog when the server catalog is empty', () => {
    const fallback = [{ id: 'frame_ember_fox_ears' }, { id: 'frame_moonlight' }];

    expect(mergeAnimalEarFrames([], fallback)).toEqual(fallback);
  });

  it('restores missing new companions from fallback while preserving server metadata', () => {
    const server = [
      { id: 'frame_ember_fox_ears', source: 'server' },
      { id: 'frame_baby_dragon', source: 'server' },
      { id: 'effect_fireflies', source: 'server' },
    ];
    const fallback = [...animalEarFrameIds, ...dpCompanionFrameIds]
      .map(id => ({ id, source: 'fallback' }));

    const result = mergeAnimalEarFrames(server, fallback);

    expect(result.map(item => item.id)).toEqual([
      'frame_ember_fox_ears',
      ...animalEarFrameIds.filter(id => id !== 'frame_ember_fox_ears'),
      ...dpCompanionFrameIds,
      'effect_fireflies',
    ]);
    expect(result.find(item => item.id === 'frame_baby_dragon')?.source).toBe('server');
  });
});

describe('filterShopCatalogByCategory', () => {
  const catalog = [
    { id: 'frame_ember_fox_ears', category: 'frame' },
    { id: 'frame_moonhare_ears', category: 'frame' },
    { id: 'frame_baby_dragon', category: 'frame' },
    { id: 'frame_moon_bunny', category: 'frame' },
    { id: 'frame_shadow_keeper', category: 'frame' },
    { id: 'frame_forest_spirit', category: 'frame' },
    { id: 'frame_star_guardian', category: 'frame' },
    { id: 'frame_moonlight', category: 'frame' },
    { id: 'effect_fireflies', category: 'effect' },
  ];

  it('keeps animal-ear cosmetics together under their own filter', () => {
    expect(filterShopCatalogByCategory(catalog, 'ears').map(item => item.id)).toEqual([
      'frame_ember_fox_ears',
      'frame_moonhare_ears',
    ]);
  });

  it('does not mix ear cosmetics into regular profile frames', () => {
    expect(filterShopCatalogByCategory(catalog, 'frame').map(item => item.id)).toEqual([
      'frame_moonlight',
    ]);
  });

  it('keeps the five animated companions in their own Store category', () => {
    expect(filterShopCatalogByCategory(catalog, 'companions').map(item => item.id)).toEqual([
      ...dpCompanionFrameIds,
    ]);
  });

  it('keeps the full catalog order in the all-items view', () => {
    expect(filterShopCatalogByCategory(catalog, null)).toEqual(catalog);
  });
});
