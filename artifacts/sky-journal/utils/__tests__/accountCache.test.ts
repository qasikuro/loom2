import { describe, expect, it } from 'vitest';
import {
  accountCacheKey,
  friendOutfitsCacheKey,
  friendOutfitsCacheScope,
  shouldShowOfflinePill,
} from '../accountCache';

describe('account-scoped startup cache', () => {
  it('uses a different persistent key for each authenticated account', () => {
    expect(accountCacheKey('user/a', 'journal_v2')).not.toBe(
      accountCacheKey('user-b', 'journal_v2'),
    );
    expect(accountCacheKey('user/a', 'journal_v2')).toContain('user%2Fa');
  });

  it('keeps the Home friend-outfit snapshot separate for each account', () => {
    expect(friendOutfitsCacheKey('user-a')).not.toBe(friendOutfitsCacheKey('user-b'));
    expect(friendOutfitsCacheKey('user-a')).toContain('home-friend-outfits:v1');
  });

  it('invalidates a friend-outfit snapshot when its friend or blocked-user set changes', () => {
    expect(friendOutfitsCacheScope(['friend-b', 'friend-a'], ['blocked-z'])).toBe(
      friendOutfitsCacheScope(['friend-a', 'friend-b'], ['blocked-z']),
    );
    expect(friendOutfitsCacheScope(['friend-a'], [])).not.toBe(
      friendOutfitsCacheScope(['friend-a', 'friend-b'], []),
    );
    expect(friendOutfitsCacheScope(['friend-a'], ['blocked-z'])).not.toBe(
      friendOutfitsCacheScope(['friend-a'], []),
    );
  });

  it('does not show an offline warning while connectivity is still being checked', () => {
    expect(shouldShowOfflinePill(false, false, false)).toBe(false);
    expect(shouldShowOfflinePill(true, true, false)).toBe(false);
    expect(shouldShowOfflinePill(false, true, false)).toBe(true);
    expect(shouldShowOfflinePill(false, true, true)).toBe(false);
  });
});
