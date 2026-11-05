export const OUTFIT_SHOWCASE_STYLES = ['dreamy', 'holographic'] as const;

export type OutfitShowcaseStyle = (typeof OUTFIT_SHOWCASE_STYLES)[number];

export const OUTFIT_SHOWCASE_TRANSITIONS = ['fade', 'zoom', 'slide', 'pan', 'parallax'] as const;

export type OutfitShowcaseTransition = (typeof OUTFIT_SHOWCASE_TRANSITIONS)[number];

const SHOWCASE_PREFIX = 'showcase:';
const TRANSITION_PREFIX = 'showcase-transition:';
const VIBE_PREFIX = 'vibe:';

export function getOutfitShowcase(tags: readonly string[] = []): OutfitShowcaseStyle | null {
  const value = tags
    .find(tag => tag.startsWith(SHOWCASE_PREFIX))
    ?.slice(SHOWCASE_PREFIX.length)
    .split(':', 1)[0];
  return OUTFIT_SHOWCASE_STYLES.find(style => style === value) ?? null;
}

export function getOutfitShowcaseTransition(
  tags: readonly string[] = [],
): OutfitShowcaseTransition {
  const value = tags.find(tag => tag.startsWith(TRANSITION_PREFIX))?.slice(TRANSITION_PREFIX.length);
  return OUTFIT_SHOWCASE_TRANSITIONS.find(transition => transition === value) ?? 'fade';
}

export function visibleOutfitTags(
  tags: readonly string[] = [],
  options: { includeVibe?: boolean } = {},
): string[] {
  return tags.filter(tag =>
    !tag.startsWith(SHOWCASE_PREFIX)
    && !tag.startsWith(TRANSITION_PREFIX)
    && (options.includeVibe || !tag.startsWith(VIBE_PREFIX)),
  );
}

export function withOutfitShowcase(
  tags: readonly string[],
  style: OutfitShowcaseStyle | null,
): string[] {
  const cleanTags = tags.filter(tag => !tag.startsWith(SHOWCASE_PREFIX));
  return style ? [...cleanTags, `${SHOWCASE_PREFIX}${style}`] : cleanTags;
}

export function withOutfitShowcaseTransition(
  tags: readonly string[],
  transition: OutfitShowcaseTransition | null,
): string[] {
  const cleanTags = tags.filter(tag => !tag.startsWith(TRANSITION_PREFIX));
  return transition ? [...cleanTags, `${TRANSITION_PREFIX}${transition}`] : cleanTags;
}
