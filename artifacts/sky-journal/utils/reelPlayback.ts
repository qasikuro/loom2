/** At most two players: visible plus one video within the next two feed cards. */
export function isReelPlaybackAppActive(state: string | null): boolean {
  // React Native can expose a null/unknown state before its native bridge
  // finishes initializing. Treat that one startup state as foreground; only
  // explicit background/inactive states should pause Reels.
  return state === null || state === 'unknown' || state === 'active';
}

export function getReelPlaybackWindow(
  posts: readonly { id: string; contentType?: string }[],
  visibleId: string | null,
  readyId: string | null,
  enabled: boolean,
) {
  const activeIndex = Math.max(0, posts.findIndex(post => post.id === visibleId));
  const active = posts[activeIndex];
  const preparedIndices: number[] = [];
  if (enabled && active) {
    preparedIndices.push(activeIndex);
    if (active.contentType !== 'video' || readyId === active.id) {
      // Mixed feeds may have a story between two videos. Prepare the next
      // video, not a story with no player, without scanning/loading the feed.
      for (let index = activeIndex + 1; index < Math.min(posts.length, activeIndex + 3); index++) {
        if (posts[index].contentType === 'video') {
          preparedIndices.push(index);
          break;
        }
      }
    }
  }
  return { activeIndex, activePostId: active?.id, preparedIndices };
}
