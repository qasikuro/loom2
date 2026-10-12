export type LumiCreationKind = 'story' | 'manga' | 'outfit' | 'journal' | 'post';
export type LumiCreationEvent = {
  key: string;
  userId: string;
  kind: LumiCreationKind;
  contentId: string;
  createdAt: number;
};

type Store = {
  seen: Set<string>;
  pending: LumiCreationEvent[];
  listeners: Set<(event: LumiCreationEvent) => void>;
};

// Survives Fast Refresh without re-celebrating the same successful mutation.
const registry = globalThis as typeof globalThis & { __storigamLumiCreations?: Store };
const store = registry.__storigamLumiCreations ??= { seen: new Set(), pending: [], listeners: new Set() };
const TTL = 10 * 60 * 1000;

/** Call only after a server confirms creation; never from optimistic list changes. */
export function publishLumiCreation(
  userId: string | null | undefined,
  kind: LumiCreationKind,
  contentId: string,
  now = Date.now(),
): boolean {
  if (!userId || !contentId) return false;
  const key = `${userId}:${kind}:${contentId}`;
  if (store.seen.has(key)) return false;
  store.seen.add(key);
  if (store.seen.size > 512) store.seen.delete(store.seen.values().next().value!);
  const event: LumiCreationEvent = { key, userId, kind, contentId, createdAt: now };
  store.pending = [...store.pending.filter(item => now - item.createdAt < TTL), event].slice(-16);
  for (const listener of store.listeners) {
    // A visual reaction must never turn a successful save into a failed save.
    try { listener(event); } catch { /* isolate companion observers */ }
  }
  return true;
}

/** Claims this account's confirmed events when its home companion is visible. */
export function takeLumiCreations(userId: string, now = Date.now()): LumiCreationEvent[] {
  const own = store.pending.filter(event => event.userId === userId && now - event.createdAt < TTL);
  store.pending = store.pending.filter(event => event.userId !== userId && now - event.createdAt < TTL);
  return own;
}

export function subscribeLumiCreations(listener: (event: LumiCreationEvent) => void): () => void {
  store.listeners.add(listener);
  return () => { store.listeners.delete(listener); };
}

/** Privacy reset for an account; does not affect another signed-in account's queue. */
export function clearLumiCreations(userId: string): void {
  store.pending = store.pending.filter(event => event.userId !== userId);
}
