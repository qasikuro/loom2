import { describe, expect, it } from 'vitest';
import { nextDmRetry } from '../dmRetryPolicy';

describe('DM retry policy', () => {
  it('backs off transport failures up to a bounded interval', () => {
    expect(nextDmRetry(0, 100, null)).toEqual({ retryAt: 1100, deliveryState: 'queued' });
    expect(nextDmRetry(20, 100, 503).retryAt).toBe(60_100);
  });
  it('honors server throttling and gives authentication time to recover', () => {
    expect(nextDmRetry(0, 100, 429, 45).retryAt).toBe(45_100);
    expect(nextDmRetry(0, 100, 401).retryAt).toBe(15_100);
  });
  it.each([400, 403, 404, 409, 410])('never automatically retries a definitive %i response', status => {
    expect(nextDmRetry(0, 100, status)).toEqual({
      retryAt: Number.MAX_SAFE_INTEGER, deliveryState: 'failed',
    });
  });
  it('holds a permanently invalid upload instead of repeatedly reuploading it', () => {
    expect(nextDmRetry(0, 100, null, null, true).deliveryState).toBe('failed');
  });
});
