export const OUTFIT_SHOWCASE_STYLES = ['dreamy', 'dark', 'mythical', 'magical', 'holographic'] as const;

export type OutfitShowcaseStyle = (typeof OUTFIT_SHOWCASE_STYLES)[number];

export const OUTFIT_SHOWCASE_TRANSITIONS = ['fade', 'zoom', 'slide', 'pan', 'parallax'] as const;

export type OutfitShowcaseTransition = (typeof OUTFIT_SHOWCASE_TRANSITIONS)[number];

const SHOWCASE_PREFIX = 'showcase:';
const TRANSITION_PREFIX = 'showcase-transition:';
const VIBE_PREFIX = 'vibe:';

const VIBE_SHOWCASE: Record<string, OutfitShowcaseStyle> = {
  romantic: 'dreamy',
  happy: 'magical',
  dark: 'dark',
  mythical: 'mythical',
  dreamy: 'dreamy',
  ethereal: 'mythical',
  cozy: 'dreamy',
  adventurous: 'mythical',
  magical: 'magical',
  energetic: 'holographic',
  cool: 'holographic',
  glitch: 'holographic',
  cute: 'magical',
  emotional: 'dark',
};

export function showcaseForVibe(vibe: string | null | undefined): OutfitShowcaseStyle | null {
  return vibe ? VIBE_SHOWCASE[vibe.toLowerCase()] ?? null : null;
}

export function getOutfitShowcase(tags: readonly string[] = []): OutfitShowcaseStyle | null {
  const saved = tags.find(tag => tag.startsWith(SHOWCASE_PREFIX));
  if (saved) {
    const value = saved.slice(SHOWCASE_PREFIX.length).split(':', 1)[0];
    return OUTFIT_SHOWCASE_STYLES.find(style => style === value) ?? null;
  }

  const vibe = tags.find(tag => tag.startsWith(VIBE_PREFIX))?.slice(VIBE_PREFIX.length);
  return showcaseForVibe(vibe);
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
  return [...cleanTags, `${SHOWCASE_PREFIX}${style ?? 'none'}`];
}

export function withOutfitShowcaseTransition(
  tags: readonly string[],
  transition: OutfitShowcaseTransition | null,
): string[] {
  const cleanTags = tags.filter(tag => !tag.startsWith(TRANSITION_PREFIX));
  return transition ? [...cleanTags, `${TRANSITION_PREFIX}${transition}`] : cleanTags;
}
