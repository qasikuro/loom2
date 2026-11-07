import { describe, expect, it } from 'vitest';
import { filterReelPosts, REEL_CATEGORIES } from '../reelFeed';
import type { DiscoverPost } from '@/context/mappers';

const post = (id: string, contentType?: DiscoverPost['contentType']): DiscoverPost => ({
  id,
  authorUserId: 'author',
  authorName: 'Creator',
  authorHandle: '@creator',
  chapterTitle: id,
  storySnippet: '',
  mood: 'Hopeful',
  witnessedCount: 0,
  likeCount: 0,
  liked: false,
  savedCount: 0,
  stickerCount: 0,
  timeAgo: 'today',
  date: '2026-11-06T00:00:00.000Z',
  chapterNumber: 1,
  vibe: 'Hopeful',
  saved: false,
  isFollowing: false,
  contentType,
});

describe('Reels category feed', () => {
  const items = [post('clip', 'video'), post('rich-story', 'story'), post('manga-chapter'), post('look', 'outfit')];

  it('offers only the three supported categories', () => {
    expect(REEL_CATEGORIES).toEqual(['Videos', 'Stories', 'Outfits']);
  });

  it('shows only clips in Videos', () => {
    expect(filterReelPosts(items, 'Videos').map(item => item.id)).toEqual(['clip']);
  });

  it('keeps rich-text stories and manga/book chapters together', () => {
    expect(filterReelPosts(items, 'Stories').map(item => item.id)).toEqual(['rich-story', 'manga-chapter']);
  });

  it('shows outfits only in Outfits', () => {
    expect(filterReelPosts(items, 'Outfits').map(item => item.id)).toEqual(['look']);
  });
});
