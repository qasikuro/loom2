import { describe, expect, it, vi } from 'vitest';
import { hintReelWebPreload } from '../reelWebPreload';

function makeVideo(bufferedSeconds: number, duration = 20) {
  const listeners = new Map<string, () => void>();
  return {
    preload: '',
    currentTime: 0,
    duration,
    buffered: { length: 1, start: () => 0, end: () => bufferedSeconds },
    addEventListener: vi.fn((name: string, callback: () => void) => listeners.set(name, callback)),
    removeEventListener: vi.fn((name: string) => listeners.delete(name)),
    load: vi.fn(),
    listeners,
  };
}

describe('bounded browser-native reel preload hints', () => {
  it('prioritizes visible playback even with only a small buffer', () => {
    const video = makeVideo(1);
    hintReelWebPreload(video as unknown as HTMLVideoElement, true);
    expect(video.preload).toBe('auto');
    expect(video.addEventListener).not.toHaveBeenCalled();
    expect(video.load).not.toHaveBeenCalled();
  });
  it('reduces the background hint once three seconds are prepared', () => {
    const video = makeVideo(1);
    hintReelWebPreload(video as unknown as HTMLVideoElement, false);
    expect(video.preload).toBe('auto');
    video.buffered.end = () => 3.5;
    video.listeners.get('progress')?.();
    expect(video.preload).toBe('metadata');
    expect(video.load).not.toHaveBeenCalled();
  });
  it('handles fully buffered short clips and promotes without restarting the source', () => {
    const video = makeVideo(2, 2);
    const cleanup = hintReelWebPreload(video as unknown as HTMLVideoElement, false);
    expect(video.preload).toBe('metadata');
    cleanup();
    hintReelWebPreload(video as unknown as HTMLVideoElement, true);
    expect(video.preload).toBe('auto');
    expect(video.load).not.toHaveBeenCalled();
  });
  it('removes listeners when the player leaves the window', () => {
    const video = makeVideo(1);
    const cleanup = hintReelWebPreload(video as unknown as HTMLVideoElement, false);
    cleanup();
    expect(video.listeners.size).toBe(0);
    expect(video.removeEventListener).toHaveBeenCalledTimes(2);
  });
});
