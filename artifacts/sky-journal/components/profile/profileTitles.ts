export const PROFILE_TITLE_CATALOG = [
  {
    name: 'Star Wanderer',
    meaning: 'A traveler beginning their constellation journey.',
    requiredStars: 1,
  },
  {
    name: 'Memory Keeper',
    meaning: 'A collector of moments worth keeping.',
    requiredStars: 2,
  },
  {
    name: 'Rising Star',
    meaning: 'Someone whose constellation is beginning to shine.',
    requiredStars: 3,
  },
  {
    name: 'Dreamer',
    meaning: 'A traveler who follows new ideas and possibilities.',
    requiredStars: 4,
  },
  {
    name: 'Guiding Light',
    meaning: 'A journey that can help light the way for others.',
    requiredStars: 5,
  },
  {
    name: 'Legend',
    meaning: 'A title for someone who has lit all six constellation stars.',
    requiredStars: 6,
  },
] as const;

export function getAvailableProfileTitles(unlockedStarCount: number): string[] {
  const count = Number.isFinite(unlockedStarCount)
    ? Math.max(0, Math.min(PROFILE_TITLE_CATALOG.length, Math.floor(unlockedStarCount)))
    : 0;

  return PROFILE_TITLE_CATALOG.slice(0, count).map(({ name }) => name);
}