/**
 * In-memory sliding-window rate limiter for message send endpoints.
 * Keyed by `userId:channelId` — each user gets MAX_MSGS sends per WINDOW_MS
 * per channel (a DM partner ID or a campfire room ID).
 */

const store  = new Map<string, number[]>();
const WINDOW_MS = 60_000;  // 1 minute
const MAX_MSGS  = 20;

export function checkMsgRateLimit(
  userId:    string,
  channelId: string,
): { ok: boolean; retryAfter: number } {
  const key  = `${userId}:${channelId}`;
  const now  = Date.now();
  const times = (store.get(key) ?? []).filter(t => now - t < WINDOW_MS);

  if (times.length >= MAX_MSGS) {
    const oldest     = times[0]!;
    const retryAfter = Math.ceil((oldest + WINDOW_MS - now) / 1000);
    return { ok: false, retryAfter };
  }

  times.push(now);
  store.set(key, times);
  return { ok: true, retryAfter: 0 };
}
