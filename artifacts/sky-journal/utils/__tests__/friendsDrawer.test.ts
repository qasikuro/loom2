import { describe, it, expect } from 'vitest';
import { shouldShowGlobalChat } from '../chatButtonVisibility';
import { mergeContacts, matchesQuery } from '../friendsDrawerContacts';

describe('shouldShowGlobalChat', () => {
  it('hides when signed out, in auth/onboarding, active conversation, or capture flows', () => {
    expect(shouldShowGlobalChat(['(tabs)', 'log'], false)).toBe(false);
    expect(shouldShowGlobalChat(['(auth)', 'sign-in'], true)).toBe(false);
    expect(shouldShowGlobalChat(['onboarding'], true)).toBe(false);
    expect(shouldShowGlobalChat(['messages', '[userId]'], true)).toBe(false);
    for (const tab of ['discover', 'reels', 'create']) expect(shouldShowGlobalChat(['(tabs)', tab], true)).toBe(false);
    expect(shouldShowGlobalChat(['(tabs)'], true)).toBe(true);
  });
  it('shows on main screens and inbox', () => {
    for (const tab of ['index', 'log', 'drift', 'profile']) expect(shouldShowGlobalChat(['(tabs)', tab], true)).toBe(true);
    expect(shouldShowGlobalChat(['messages'], true)).toBe(true);
  });
});

const friends = [
  { userId: 'a', name: 'Ada', username: 'ada', isOnline: true },
  { userId: 'b', name: 'Bo', username: null, isOnline: false, lastSeenAt: null },
  { userId: 'x', name: 'Blocked' },
];
const threads = [
  { partnerId: 'b', partnerName: 'Bo', partnerHandle: null, partnerAvatar: null, lastMessage: 'hi', lastAt: '2024-01-02T00:00:00Z', unread: true },
  { partnerId: 'c', partnerName: 'Cy', partnerHandle: 'cy', partnerAvatar: null, lastMessage: 'yo', lastAt: '2024-01-03T00:00:00Z', unread: false },
  { partnerId: 'x', partnerName: 'Blocked', partnerHandle: null, partnerAvatar: null, lastMessage: 'z', lastAt: '2024-01-04T00:00:00Z', unread: true },
];
describe('mergeContacts', () => {
  const out = mergeContacts(friends, threads, new Set(['x']), false);
  it('filters blocked, orders by recency, merges unread', () => {
    expect(out.map(c => c.userId)).toEqual(['c', 'b', 'a']);
    expect(out[1].unread).toBe(true);
  });
  it('gives conversation-only contacts no presence', () => {
    expect(out[0]).toMatchObject({ isFriend: false, online: false, lastSeenAt: null });
    expect(out[2].online).toBe(true);
  });
  it('returns nothing when restricted', () => {
    expect(mergeContacts(friends, threads, new Set(), true)).toEqual([]);
  });
});
describe('matchesQuery', () => {
  it('matches name or handle case-insensitively', () => {
    expect(matchesQuery('CY', 'Cyrus', 'x')).toBe(true);
    expect(matchesQuery('ada', 'Z', 'ADA')).toBe(true);
    expect(matchesQuery('@ada', 'Z', 'ADA')).toBe(true);
    expect(matchesQuery('q', 'Z', null)).toBe(false);
    expect(matchesQuery('  ', 'Z', null)).toBe(true);
  });
});
