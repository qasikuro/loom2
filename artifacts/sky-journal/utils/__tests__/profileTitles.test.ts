import { describe, expect, it } from 'vitest';
import { getAvailableProfileTitles, PROFILE_TITLE_CATALOG } from '../../components/profile/profileTitles';

describe('profile title availability', () => {
  it('shows an unlock guide before the first constellation star is earned', () => {
    expect(getAvailableProfileTitles(0)).toEqual([]);
  });

  it('unlocks titles in constellation progress order', () => {
    expect(getAvailableProfileTitles(2)).toEqual([
      'Star Wanderer',
      'Memory Keeper',
    ]);
  });

  it('never exposes more titles than the catalogue contains', () => {
    expect(getAvailableProfileTitles(99)).toEqual(
      PROFILE_TITLE_CATALOG.map(({ name }) => name),
    );
  });
});