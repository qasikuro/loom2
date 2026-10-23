/**
 * Publish the feed without waiting for unrelated startup requests. Wait for
 * current block visibility too, and discard responses from a previous account.
 */
export async function publishReelStartup<T>(
  feedRequest: Promise<T | null>,
  blockRequest: Promise<{ blockedId: string }[] | null>,
  isCurrent: () => boolean,
  publish: (feed: T, blockedIds: string[]) => void,
): Promise<boolean> {
  const [feed, blocks] = await Promise.all([feedRequest, blockRequest]);
  if (!isCurrent() || feed === null || !Array.isArray(blocks)
    || !blocks.every(block => typeof block?.blockedId === 'string')) return false;
  publish(feed, blocks.map(block => block.blockedId));
  return true;
}
