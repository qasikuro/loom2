const ANIMAL_EAR_FRAME_IDS = [
  'frame_ember_fox_ears',
  'frame_moonhare_ears',
  'frame_frost_lynx_ears',
] as const;
const ANIMAL_EAR_FRAME_ID_SET: ReadonlySet<string> = new Set(ANIMAL_EAR_FRAME_IDS);
const DP_COMPANION_FRAME_IDS = [
  'frame_baby_dragon',
  'frame_moon_bunny',
  'frame_shadow_keeper',
  'frame_forest_spirit',
  'frame_star_guardian',
] as const;
const DP_COMPANION_FRAME_ID_SET: ReadonlySet<string> = new Set(DP_COMPANION_FRAME_IDS);
const PROFILE_COMPANION_FRAME_IDS = [...ANIMAL_EAR_FRAME_IDS, ...DP_COMPANION_FRAME_IDS];
const PROFILE_COMPANION_FRAME_ID_SET: ReadonlySet<string> = new Set(PROFILE_COMPANION_FRAME_IDS);

/**
 * Keep avatar companions visible if an older API deployment returns a partial
 * catalog, while preferring live server metadata for supported items.
 * The collection stays grouped immediately after Ember Fox.
 */
export function mergeAnimalEarFrames<T extends { id: string }>(
  serverCatalog: readonly T[],
  fallbackCatalog: readonly T[],
): T[] {
  if (serverCatalog.length === 0) return [...fallbackCatalog];

  const serverById = new Map(serverCatalog.map(item => [item.id, item]));
  const fallbackById = new Map(fallbackCatalog.map(item => [item.id, item]));
  const companions = PROFILE_COMPANION_FRAME_IDS
    .map(id => serverById.get(id) ?? fallbackById.get(id))
    .filter((item): item is T => item !== undefined);
  const companionIds: ReadonlySet<string> = PROFILE_COMPANION_FRAME_ID_SET;
  const fox = companions.find(item => item.id === ANIMAL_EAR_FRAME_IDS[0]);
  const companionItems = companions.filter(item => item.id !== ANIMAL_EAR_FRAME_IDS[0]);
  const foxIndex = serverCatalog.findIndex(item => item.id === ANIMAL_EAR_FRAME_IDS[0]);

  if (!fox) return serverCatalog.filter(item => !companionIds.has(item.id));
  if (foxIndex < 0) {
    return [...serverCatalog.filter(item => !companionIds.has(item.id)), fox, ...companionItems];
  }

  return [
    ...serverCatalog.slice(0, foxIndex).filter(item => !companionIds.has(item.id)),
    fox,
    ...companionItems,
    ...serverCatalog.slice(foxIndex + 1).filter(item => !companionIds.has(item.id)),
  ];
}

/** Keep ear cosmetics in their own storefront category, even if the API labels them as profile frames. */
export function filterShopCatalogByCategory<T extends { id: string; category: string }>(
  catalog: readonly T[],
  category: string | null,
): T[] {
  if (category === 'ears') {
    return catalog.filter(item => ANIMAL_EAR_FRAME_ID_SET.has(item.id));
  }
  if (category === 'companions') {
    return catalog.filter(item => DP_COMPANION_FRAME_ID_SET.has(item.id));
  }
  if (category === 'frame') {
    return catalog.filter(item => item.category === 'frame' && !PROFILE_COMPANION_FRAME_ID_SET.has(item.id));
  }
  return category ? catalog.filter(item => item.category === category) : [...catalog];
}

export const animalEarFrameIds = ANIMAL_EAR_FRAME_IDS;
export const dpCompanionFrameIds = DP_COMPANION_FRAME_IDS;
