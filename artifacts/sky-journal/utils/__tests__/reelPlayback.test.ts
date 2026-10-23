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
  it('promotes the same prepared item rather than replacing it with a second player', () => {
    const before = getReelPlaybackWindow(posts, 'one', 'one', true);
    const after = getReelPlaybackWindow(posts, 'two', 'one', true);
    expect(before.preparedIndices).toContain(after.activeIndex);
    expect(after.preparedIndices).toEqual([1]);
  });
  it('removes the successor when visible-player buffer permission is revoked', () => {
    expect(getReelPlaybackWindow(posts, 'one', 'one', true).preparedIndices).toEqual([0, 1]);
    expect(getReelPlaybackWindow(posts, 'one', null, true).preparedIndices).toEqual([0]);
  });
  it('warms one next video across an intervening story, not a story-shaped preloader', () => {
    const mixed = [posts[0], { id: 'story', contentType: 'manga' }, posts[1], posts[2]];
    expect(getReelPlaybackWindow(mixed, 'one', 'one', true).preparedIndices).toEqual([0, 2]);
    expect(getReelPlaybackWindow(mixed, 'story', null, true).preparedIndices).toEqual([1, 2]);
  });
  it('does not load videos outside the bounded two-card lookahead', () => {
    const mixed = [posts[0], { id: 's1' }, { id: 's2' }, posts[1]];
    expect(getReelPlaybackWindow(mixed, 'one', 'one', true).preparedIndices).toEqual([0]);
  });
});
