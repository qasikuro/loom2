/**
 * Lightweight persistent mutation queue for H-1.
 *
 * When a profile/outfit/cosmetic sync fails its one-tap-to-retry chance, the
 * mutation is queued here in AsyncStorage so it can be replayed the next time
 * the app comes to the foreground. Same-URL + method entries are deduplicated
 * (last write wins), so rapid saves only replay the most recent value.
 *
 * Entries older than 24 hours are silently expired — stale profile saves
 * should not be replayed after a long absence.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const QUEUE_KEY  = 'pending_mutations_v1';
const MAX_AGE_MS = 24 * 60 * 60 * 1000; // 24 hours

export interface PendingMutation {
  id:        string;
  url:       string;
  method:    string;
  body:      string | null;
  queuedAt:  number;
}

/**
 * Add a mutation to the persistent queue.
 * If an entry with the same URL + method already exists, it is replaced so
 * only the latest value is retried (idempotent SET / PUT semantics).
 */
export async function enqueueMutation(
  url:    string,
  method: string,
  body:   string | null,
): Promise<void> {
  try {
    const raw   = await AsyncStorage.getItem(QUEUE_KEY);
    const queue: PendingMutation[] = raw ? JSON.parse(raw) : [];
    const now   = Date.now();

    // Expire old entries; deduplicate by url+method (last write wins)
    const fresh = queue.filter(
      m => now - m.queuedAt < MAX_AGE_MS && !(m.url === url && m.method === method),
    );
    fresh.push({ id: crypto.randomUUID(), url, method, body, queuedAt: now });
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(fresh));
  } catch { /* never block the caller */ }
}

/**
 * Replay all queued mutations in insertion order.
 * Mutations that succeed are removed; failures stay for the next drain.
 * Call this whenever the app returns to the foreground.
 */
export async function drainMutationQueue(
  apiFetch: (url: string, opts: { method: string; body?: string }) => Promise<unknown>,
): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    if (!raw) return;
    const queue: PendingMutation[] = JSON.parse(raw);
    if (!queue.length) return;

    const now       = Date.now();
    const fresh     = queue.filter(m => now - m.queuedAt < MAX_AGE_MS);
    const remaining: PendingMutation[] = [];

    for (const mutation of fresh) {
      try {
        await apiFetch(mutation.url, {
          method: mutation.method,
          body:   mutation.body ?? undefined,
        });
        // Success — do not carry forward
      } catch {
        remaining.push(mutation); // Keep for next foreground event
      }
    }

    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
  } catch { /* never block the caller */ }
}
