import { describe, expect, it } from 'vitest';
import {
  clearLumiCreations, publishLumiCreation, subscribeLumiCreations, takeLumiCreations,
} from '../../features/lumi/home/events';

describe('confirmed Lumi creation events', () => {
  it('ignores unsigned-in events and empty content IDs', () => {
    expect(publishLumiCreation(null, 'story', 'story')).toBe(false);
    expect(publishLumiCreation('lumi-empty', 'outfit', '')).toBe(false);
    expect(takeLumiCreations('lumi-empty')).toEqual([]);
  });

  it('deduplicates repeated saves or retries of the same creation', () => {
    expect(publishLumiCreation('lumi-dedup', 'story', 'one', 1_000)).toBe(true);
    expect(publishLumiCreation('lumi-dedup', 'story', 'one', 1_100)).toBe(false);
    expect(takeLumiCreations('lumi-dedup', 1_200)).toHaveLength(1);
    expect(takeLumiCreations('lumi-dedup', 1_300)).toEqual([]);
  });

  it('holds confirmed events until the owning account claims them', () => {
    publishLumiCreation('lumi-owner', 'journal', 'private', 2_000);
    expect(takeLumiCreations('lumi-other', 2_100)).toEqual([]);
    expect(takeLumiCreations('lumi-owner', 2_100)[0]).toMatchObject({ kind: 'journal', contentId: 'private' });
  });

  it('expires stale events so an old creation is not celebrated on a later visit', () => {
    publishLumiCreation('lumi-expired', 'outfit', 'old', 3_000);
    expect(takeLumiCreations('lumi-expired', 3_000 + 10 * 60 * 1_000)).toEqual([]);
  });

  it('clears only one account on sign-out', () => {
    publishLumiCreation('lumi-clear-a', 'manga', 'a', 4_000);
    publishLumiCreation('lumi-clear-b', 'post', 'b', 4_000);
    clearLumiCreations('lumi-clear-a');
    expect(takeLumiCreations('lumi-clear-a', 4_100)).toEqual([]);
    expect(takeLumiCreations('lumi-clear-b', 4_100)).toHaveLength(1);
  });

  it('notifies observers without allowing animation failures to break successful saves', () => {
    const observed: string[] = [];
    const stopBroken = subscribeLumiCreations(() => { throw new Error('animation unavailable'); });
    const stopWorking = subscribeLumiCreations(event => { observed.push(event.key); });
    expect(() => publishLumiCreation('lumi-observe', 'story', 'confirmed', 5_000)).not.toThrow();
    expect(observed).toEqual(['lumi-observe:story:confirmed']);
    stopBroken();
    stopWorking();
    publishLumiCreation('lumi-observe', 'story', 'next', 5_100);
    expect(observed).toHaveLength(1);
    clearLumiCreations('lumi-observe');
  });
});
