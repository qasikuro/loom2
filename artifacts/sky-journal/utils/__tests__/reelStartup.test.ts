import { describe, expect, it, vi } from 'vitest';
import { publishReelStartup } from '../reelStartup';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(done => { resolve = done; });
  return { promise, resolve };
}

describe('early reel startup', () => {
  it('publishes without waiting for unrelated startup work', async () => {
    const unrelated = deferred<void>();
    const feed = Promise.resolve(['video']);
    const blocks = Promise.resolve([]);
    let wholeStartupFinished = false;
    const wholeStartup = Promise.all([feed, blocks, unrelated.promise]).then(() => { wholeStartupFinished = true; });
    const publish = vi.fn();
    await publishReelStartup(feed, blocks, () => true, publish);
    expect(publish).toHaveBeenCalledWith(['video'], []);
    expect(wholeStartupFinished).toBe(false);
    unrelated.resolve();
    await wholeStartup;
  });

  it('does not expose feed data until the current block check finishes', async () => {
    const blocks = deferred<{ blockedId: string }[] | null>();
    const publish = vi.fn();
    const ready = publishReelStartup(Promise.resolve(['video']), blocks.promise, () => true, publish);
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
    blocks.resolve([{ blockedId: 'blocked-author' }]);
    expect(await ready).toBe(true);
    expect(publish).toHaveBeenCalledWith(['video'], ['blocked-author']);
  });

  it('ignores late responses after an account change', async () => {
    const feed = deferred<string[] | null>();
    let current = true;
    const publish = vi.fn();
    const ready = publishReelStartup(feed.promise, Promise.resolve([]), () => current, publish);
    current = false;
    feed.resolve(['old-account-video']);
    expect(await ready).toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });

  it('retains cached feed when a request or privacy check fails', async () => {
    for (const [feed, blocks] of [[null, []], [['video'], null]] as const) {
      const publish = vi.fn();
      expect(await publishReelStartup(Promise.resolve(feed), Promise.resolve(blocks as [] | null), () => true, publish)).toBe(false);
      expect(publish).not.toHaveBeenCalled();
    }
  });

  it('does not publish with malformed block data', async () => {
    const publish = vi.fn();
    const malformed = [{ blockedId: 123 }] as unknown as { blockedId: string }[];
    expect(await publishReelStartup(Promise.resolve(['video']), Promise.resolve(malformed), () => true, publish)).toBe(false);
    expect(publish).not.toHaveBeenCalled();
  });
});
