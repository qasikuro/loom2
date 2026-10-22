/** Prioritize the visible reel. Only warm its immediate successor once ready. */
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
    if (activeIndex + 1 < posts.length && (active.contentType !== 'video' || readyId === active.id)) {
      preparedIndices.push(activeIndex + 1);
    }
  }
  return { activeIndex, activePostId: active?.id, preparedIndices };
}
