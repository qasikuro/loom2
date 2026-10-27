/** Retry only transport/transient failures. Permission or validation failures
 * remain held until an explicit user retry; unblocking must not send old drafts. */
export function nextDmRetry(
  attempts: number,
  now: number,
  status: number | null,
  retryAfter: number | null = null,
  permanentUploadFailure = false,
): { retryAt: number; deliveryState: 'failed' | 'queued' } {
  const permanent = permanentUploadFailure
    || (status !== null && status >= 400 && status < 500 && ![401, 408, 429].includes(status));
  if (permanent) return { retryAt: Number.MAX_SAFE_INTEGER, deliveryState: 'failed' };
  const delays = [1000, 2000, 5000, 15_000, 30_000, 60_000];
  const delay = status === 429 && retryAfter !== null && retryAfter > 0
    ? Math.min(Math.max(retryAfter * 1000, 1000), 600_000)
    : status === 401 ? 15_000
      : delays[Math.max(0, Math.min(Math.floor(attempts), delays.length - 1))];
  return { retryAt: now + delay, deliveryState: 'queued' };
}
