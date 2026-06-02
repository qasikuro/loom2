const MAX_ENTRIES = 500;
const SWEEP_INTERVAL_MS = 5 * 60 * 1000;

interface CacheEntry<T> {
  value:     T;
  expiresAt: number;
}

const store = new Map<string, CacheEntry<unknown>>();

function evictLRU(): void {
  const firstKey = store.keys().next().value;
  if (firstKey !== undefined) {
    store.delete(firstKey);
  }
}

function sweep(): void {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.expiresAt) {
      store.delete(key);
    }
  }
}

const _sweepTimer = setInterval(sweep, SWEEP_INTERVAL_MS);
if (typeof _sweepTimer === 'object' && _sweepTimer !== null && 'unref' in _sweepTimer) {
  (_sweepTimer as NodeJS.Timeout).unref();
}

export function get<T>(key: string): T | undefined {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (Date.now() > entry.expiresAt) {
    store.delete(key);
    return undefined;
  }
  store.delete(key);
  store.set(key, entry);
  return entry.value as T;
}

export function set<T>(key: string, value: T, ttlMs: number): void {
  if (store.has(key)) {
    store.delete(key);
  } else if (store.size >= MAX_ENTRIES) {
    evictLRU();
  }
  store.set(key, { value, expiresAt: Date.now() + ttlMs });
}

export function invalidate(keyPrefix: string): void {
  for (const key of store.keys()) {
    if (key.startsWith(keyPrefix)) {
      store.delete(key);
    }
  }
}

export function size(): number {
  return store.size;
}
