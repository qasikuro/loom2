import AsyncStorage from '@react-native-async-storage/async-storage';
import { useQuery } from '@tanstack/react-query';
import { apiFetch, type FriendSummary } from '@/context/AppContext';
import type { StoryMusic } from '@/context/mappers';
import { friendOutfitsCacheKey, friendOutfitsCacheScope } from '@/utils/accountCache';
import { useEffect, useMemo, useState } from 'react';

/** Shape returned by GET /users/:userId/outfits (public, non-hidden only). */
export interface PublicOutfit {
  id: string;
  name: string;
  description: string;
  story: string;
  imageUri: string | null;
  tags: string[];
  music?: StoryMusic | null;
  date: string;
}

export interface FriendOutfit {
  outfit: PublicOutfit;
  author: FriendSummary;
  /** All public outfits of this author, newest first (for viewer paging). */
  authorOutfits: PublicOutfit[];
}

const MAX_FRIENDS = 6;
const CONCURRENCY = 3;
const FRIEND_OUTFIT_CACHE_TTL_MS = 7 * 24 * 60 * 60_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isPublicOutfit(value: unknown): value is PublicOutfit {
  if (!isRecord(value)) return false;
  return typeof value.id === 'string'
    && typeof value.name === 'string'
    && typeof value.description === 'string'
    && typeof value.story === 'string'
    && (typeof value.imageUri === 'string' || value.imageUri === null)
    && Array.isArray(value.tags)
    && value.tags.every(tag => typeof tag === 'string')
    && typeof value.date === 'string';
}

function isFriendOutfit(value: unknown): value is FriendOutfit {
  if (!isRecord(value) || !isRecord(value.author)) return false;
  return isPublicOutfit(value.outfit)
    && typeof value.author.userId === 'string'
    && typeof value.author.name === 'string'
    && Array.isArray(value.authorOutfits)
    && value.authorOutfits.every(isPublicOutfit);
}

function sameIds(left: unknown, right: string[]): boolean {
  if (!Array.isArray(left) || !left.every(id => typeof id === 'string')) return false;
  return JSON.stringify([...left].sort()) === JSON.stringify(right);
}

function parseFriendOutfitSnapshot(
  raw: string,
  friendIds: string[],
  blockedIds: string[],
): { savedAt: number; items: FriendOutfit[] } | null {
  try {
    const snapshot: unknown = JSON.parse(raw);
    if (
      !isRecord(snapshot)
      || snapshot.version !== 1
      || typeof snapshot.savedAt !== 'number'
      || Date.now() - snapshot.savedAt > FRIEND_OUTFIT_CACHE_TTL_MS
      || !Array.isArray(snapshot.items)
      || !sameIds(snapshot.friendIds, friendIds)
      || !sameIds(snapshot.blockedIds, blockedIds)
    ) return null;

    const eligibleIds = new Set(friendIds);
    return {
      savedAt: snapshot.savedAt,
      items: snapshot.items.filter(
        (item): item is FriendOutfit => isFriendOutfit(item) && eligibleIds.has(item.author.userId),
      ),
    };
  } catch {
    return null;
  }
}

/**
 * Newest public outfits from the first few friends. Keyed by the signed-in
 * viewer so another account never sees a cached result. Per-friend failures
 * (blocked/private) are skipped; only a total failure surfaces as an error.
 */
export function useFriendOutfits(
  viewerId: string | null | undefined,
  friends: FriendSummary[],
  blockedIds: string[] = [],
) {
  const blockedIdSignature = JSON.stringify([...blockedIds].sort());
  const sortedBlockedIds = useMemo(
    () => JSON.parse(blockedIdSignature) as string[],
    [blockedIdSignature],
  );
  const blockedSet = useMemo(() => new Set(sortedBlockedIds), [sortedBlockedIds]);
  const picked = friends.filter(friend => !blockedSet.has(friend.userId)).slice(0, MAX_FRIENDS);
  const ids = picked.map(f => f.userId);
  const friendIdSignature = JSON.stringify([...ids].sort());
  const sortedIds = useMemo(
    () => JSON.parse(friendIdSignature) as string[],
    [friendIdSignature],
  );
  const cacheKey = viewerId ? friendOutfitsCacheKey(viewerId) : null;
  const cacheScope = friendOutfitsCacheScope(sortedIds, sortedBlockedIds);
  const [diskCache, setDiskCache] = useState<{
    key: string; scope: string; savedAt: number; items: FriendOutfit[];
  } | null>(null);

  useEffect(() => {
    if (!cacheKey) {
      setDiskCache(null);
      return;
    }
    let active = true;
    AsyncStorage.getItem(cacheKey)
      .then(raw => {
        if (!active || !raw) return;
        const snapshot = parseFriendOutfitSnapshot(raw, sortedIds, sortedBlockedIds);
        if (snapshot) setDiskCache({ key: cacheKey, scope: cacheScope, ...snapshot });
      })
      .catch(() => null);
    return () => { active = false; };
  }, [cacheKey, cacheScope, sortedIds, sortedBlockedIds]);

  const query = useQuery({
    // Friend display order can shift as recent activity changes; keep the cache
    // key tied to the same friend set so Home can reuse valid outfit data.
    queryKey: ['home-friend-outfits', viewerId ?? 'signed-out', sortedIds],
    enabled: !!viewerId && ids.length > 0,
    staleTime: 2 * 60_000,
    queryFn: async () => {
      const results: FriendOutfit[] = [];
      let failures = 0;
      for (let i = 0; i < picked.length; i += CONCURRENCY) {
        const batch = picked.slice(i, i + CONCURRENCY);
        const settled = await Promise.allSettled(
          batch.map(f => apiFetch<PublicOutfit[]>(`/users/${encodeURIComponent(f.userId)}/outfits`)),
        );
        settled.forEach((r, j) => {
          if (r.status !== 'fulfilled') { failures++; return; }
          const list = Array.isArray(r.value) ? r.value : [];
          list.slice(0, 3).forEach(outfit => results.push({ outfit, author: batch[j]!, authorOutfits: list }));
        });
      }
      if (failures === picked.length) throw new Error('Could not load outfits');
      return results
        .sort((a, b) => new Date(b.outfit.date).getTime() - new Date(a.outfit.date).getTime())
        .slice(0, 10);
    },
  });

  useEffect(() => {
    if (!cacheKey || !query.data) return;
    const eligibleIds = new Set(sortedIds);
    const items = query.data.filter(item =>
      eligibleIds.has(item.author.userId) && !blockedSet.has(item.author.userId),
    );
    const savedAt = Date.now();
    const snapshot = JSON.stringify({
      version: 1,
      savedAt,
      friendIds: sortedIds,
      blockedIds: sortedBlockedIds,
      items,
    });
    setDiskCache({ key: cacheKey, scope: cacheScope, savedAt, items });
    void AsyncStorage.setItem(cacheKey, snapshot).catch(() => null);
  }, [blockedSet, cacheKey, cacheScope, query.data, sortedBlockedIds, sortedIds]);

  const isCachedSnapshotValid = diskCache
    && diskCache.key === cacheKey
    && diskCache.scope === cacheScope
    && Date.now() - diskCache.savedAt <= FRIEND_OUTFIT_CACHE_TTL_MS;
  const cachedItems = isCachedSnapshotValid ? diskCache.items : undefined;
  const data = query.data ?? cachedItems;
  return {
    ...query,
    data,
    // A valid local snapshot prevents a cold-start loading skeleton while the
    // network refresh is running. React Query's in-memory cache still wins.
    isLoading: query.isLoading && !data,
  };
}
