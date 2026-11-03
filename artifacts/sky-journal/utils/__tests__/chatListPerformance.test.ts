import { describe, expect, it } from 'vitest';
import { CHAT_HISTORY_LIST_CONFIG, getDmUploadProgressUpdate } from '../chatListPerformance';

describe('chat history virtualization budget', () => {
  it('keeps the initial batch, incremental batch, cadence, and render window bounded', () => {
    expect(CHAT_HISTORY_LIST_CONFIG).toEqual({
      initialNumToRender: 12,
      maxToRenderPerBatch: 8,
      updateCellsBatchingPeriod: 40,
      windowSize: 7,
    });
  });

  it('coalesces unchanged and burst upload progress callbacks', () => {
    const checkpoint = { percent: 12, updatedAt: 1_000 };
    expect(getDmUploadProgressUpdate(0.12, 1_300, checkpoint)).toBeNull();
    expect(getDmUploadProgressUpdate(0.13, 1_100, checkpoint)).toBeNull();
    expect(getDmUploadProgressUpdate(0.16, 1_160, checkpoint)).toEqual({
      percent: 16,
      fraction: 0.16,
    });
  });

  it('always publishes completion and clamps invalid progress values', () => {
    expect(getDmUploadProgressUpdate(1, 1_010, { percent: 99, updatedAt: 1_000 })).toEqual({
      percent: 100,
      fraction: 1,
    });
    expect(getDmUploadProgressUpdate(Number.NaN, 1_200, { percent: 99, updatedAt: 1_000 })).toEqual({
      percent: 0,
      fraction: 0,
    });
  });
});
