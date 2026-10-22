import { describe, expect, it } from 'vitest';
import { getReelPlaybackWindow } from '../reelPlayback';

const posts = [
  { id: 'one', contentType: 'video' },
  { id: 'two', contentType: 'video' },
  { id: 'three', contentType: 'video' },
];

describe('bounded reel preparation', () => {
  it('starts the first reel immediately without waiting for viewability', () => {
    expect(getReelPlaybackWindow(posts, null, null, true)).toEqual({
      activeIndex: 0, activePostId: 'one', preparedIndices: [0],
    });
  });
  it('gives the visible video priority, then warms only the next reel', () => {
    expect(getReelPlaybackWindow(posts, 'one', null, true).preparedIndices).toEqual([0]);
    expect(getReelPlaybackWindow(posts, 'one', 'one', true).preparedIndices).toEqual([0, 1]);
    expect(getReelPlaybackWindow(posts, 'two', 'one', true).preparedIndices).toEqual([1]);
    expect(getReelPlaybackWindow(posts, 'two', 'two', true).preparedIndices).toEqual([1, 2]);
  });
  it('never creates extra players past the end or while unfocused/backgrounded', () => {
    expect(getReelPlaybackWindow(posts, 'three', 'three', true).preparedIndices).toEqual([2]);
    expect(getReelPlaybackWindow(posts, 'two', 'two', false).preparedIndices).toEqual([]);
    expect(getReelPlaybackWindow([], null, null, true).preparedIndices).toEqual([]);
  });
  it('warms the next reel immediately when viewing a story', () => {
    expect(getReelPlaybackWindow([{ id: 'story', contentType: 'manga' }, ...posts], 'story', null, true).preparedIndices).toEqual([0, 1]);
  });
  it('falls back safely after a filter or feed refresh removes the old item', () => {
    expect(getReelPlaybackWindow(posts, 'removed', null, true).activePostId).toBe('one');
  });
});
