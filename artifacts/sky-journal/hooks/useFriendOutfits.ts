import { useQuery } from '@tanstack/react-query';
import { apiFetch, type FriendSummary } from '@/context/AppContext';
import type { StoryMusic } from '@/context/mappers';

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

/**
 * Newest public outfits from the first few friends. Keyed by the signed-in
 * viewer so another account never sees a cached result. Per-friend failures
 * (blocked/private) are skipped; only a total failure surfaces as an error.
 */
export function useFriendOutfits(viewerId: string | null | undefined, friends: FriendSummary[]) {
  const picked = friends.slice(0, MAX_FRIENDS);
  const ids = picked.map(f => f.userId);
  return useQuery({
    queryKey: ['home-friend-outfits', viewerId ?? 'signed-out', ids],
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
}
