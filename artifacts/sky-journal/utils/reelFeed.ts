import type { DiscoverPost } from '@/context/mappers';

export const REEL_CATEGORIES = ['Videos', 'Stories', 'Outfits'] as const;

export type ReelCategory = typeof REEL_CATEGORIES[number];

export function filterReelPosts(posts: DiscoverPost[], category: ReelCategory): DiscoverPost[] {
  switch (category) {
    case 'Videos':
      return posts.filter(post => post.contentType === 'video');
    case 'Outfits':
      return posts.filter(post => post.contentType === 'outfit');
    case 'Stories':
      // Published book chapters are story posts too, even when older responses
      // omit contentType. Outfit and video cards must never leak into reading.
      return posts.filter(post => post.contentType !== 'video' && post.contentType !== 'outfit');
  }
}
