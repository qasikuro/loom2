import { describe, expect, it } from 'vitest';
import { canWarmNextReel } from '../reelBuffer';

const status = { isPlaying: true, isBuffering: false, positionMillis: 1000, playableDurationMillis: 6000, durationMillis: 20_000 };
describe('reel preload bandwidth priority', () => {
  it('requires a healthy buffer, not just a first frame', () => {
    expect(canWarmNextReel({ ...status, positionMillis: 0 })).toBe(false);
    expect(canWarmNextReel({ ...status, playableDurationMillis: 1500 })).toBe(false);
    expect(canWarmNextReel(status)).toBe(true);
  });
  it('never competes with buffering or paused playback', () => {
    expect(canWarmNextReel({ ...status, isBuffering: true })).toBe(false);
    expect(canWarmNextReel({ ...status, isPlaying: false })).toBe(false);
  });
  it('can warm when a short clip is fully buffered', () => {
    expect(canWarmNextReel({ ...status, durationMillis: 3000, playableDurationMillis: 3000 })).toBe(true);
  });
  it('waits for sustained playback if the platform omits buffer data', () => {
    expect(canWarmNextReel({ ...status, playableDurationMillis: undefined })).toBe(false);
    expect(canWarmNextReel({ ...status, positionMillis: 2100, playableDurationMillis: undefined })).toBe(true);
  });
  it('keeps a prepared player through small buffer fluctuations without restarting it', () => {
    const fluctuating = { ...status, playableDurationMillis: 3500 };
    expect(canWarmNextReel(fluctuating, false)).toBe(false);
    expect(canWarmNextReel(fluctuating, true)).toBe(true);
  });
  it('revokes background preparation when the visible buffer runs low or stalls', () => {
    expect(canWarmNextReel({ ...status, playableDurationMillis: 2000 }, true)).toBe(false);
    expect(canWarmNextReel({ ...status, isBuffering: true }, true)).toBe(false);
  });
  it('retains the prepared successor through a user pause and a buffered loop', () => {
    expect(canWarmNextReel({ ...status, isPlaying: false }, true)).toBe(true);
    expect(canWarmNextReel({ ...status, positionMillis: 0 }, true)).toBe(true);
  });
  it('does not start preloading a paused or buffering video without previous headroom', () => {
    expect(canWarmNextReel({ ...status, isPlaying: false }, false)).toBe(false);
    expect(canWarmNextReel({ ...status, isBuffering: true }, false)).toBe(false);
  });
});
