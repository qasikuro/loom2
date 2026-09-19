import { describe, expect, it } from 'vitest';
import {
  calculateMusicSegment,
  formatVideoRange,
  normalizeVideoTrim,
  selectedVideoDuration,
} from '../videoEditing';

describe('video editing calculations', () => {
  it('limits a 90 second source to a 25 second selection', () => {
    const trim = normalizeVideoTrim(90, 0, 25);
    expect(selectedVideoDuration(trim)).toBe(25);
    expect(formatVideoRange(trim)).toBe('0:00 – 0:25');
  });

  it('limits a five minute source to 60 seconds', () => {
    const trim = normalizeVideoTrim(300, 0, 300);
    expect(trim).toEqual({ startSeconds: 0, endSeconds: 60 });
  });

  it('selects a 40 second segment from a longer song', () => {
    expect(calculateMusicSegment(40, 180, 70)).toEqual({
      startSeconds: 70,
      durationSeconds: 40,
      endsAtSeconds: 110,
    });
  });

  it('does not stretch a song shorter than the video', () => {
    expect(calculateMusicSegment(20, 10, 0).durationSeconds).toBe(10);
  });

  it('preserves an exact 60 second final duration', () => {
    expect(selectedVideoDuration(normalizeVideoTrim(60, 0, 60))).toBe(60);
  });

  it('reconforms music when the video trim changes', () => {
    const short = calculateMusicSegment(20, 120, 5);
    const long = calculateMusicSegment(45, 120, short.startSeconds);
    expect(short.durationSeconds).toBe(20);
    expect(long.durationSeconds).toBe(45);
  });

  it('returns no segment after music is removed', () => {
    expect(calculateMusicSegment(20, 0, 0)).toEqual({
      startSeconds: 0,
      durationSeconds: 0,
      endsAtSeconds: 0,
    });
  });
});
