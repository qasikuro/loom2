import * as Crypto from 'expo-crypto';
import * as NativeSecureStore from 'expo-secure-store';
import type { ChatMessage, ChatMessageInput } from '@workspace/api-client-react';

// SecureStore is native-only. The browser preview keeps its existing memory
// behavior; it must not persist private messages in plaintext or disable sends.
const SecureStore = {
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: NativeSecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
  getItemAsync: (key: string, options: NativeSecureStore.SecureStoreOptions) =>
    typeof document !== 'undefined' ? Promise.resolve(null) : NativeSecureStore.getItemAsync(key, options),
  setItemAsync: (key: string, value: string, options: NativeSecureStore.SecureStoreOptions) =>
    typeof document !== 'undefined' ? Promise.resolve() : NativeSecureStore.setItemAsync(key, value, options),
  deleteItemAsync: (key: string, options: NativeSecureStore.SecureStoreOptions) =>
    typeof document !== 'undefined' ? Promise.resolve() : NativeSecureStore.deleteItemAsync(key, options),
};

export type DmCachedMessage = ChatMessage & {
  deliveryState?: 'sending' | 'queued' | 'failed';
};

export type DmOutboxItem = {
  clientMessageId: string;
  createdAt: string;
  content: string | null;
  imageUri: string | null;
  expression: ChatMessageInput['expression'] | null;
  localPhotoUri?: string | null;
  attempts: number;
  retryAt: number;
};

interface CacheEntry {
  messages: DmCachedMessage[];
  opened: boolean;
}

interface SecureBlobMeta {
  version: 1;
  chunks: number;
  revision: string;
}

const MAX_CACHED_CONVERSATIONS = 8;
const MAX_CACHED_MESSAGES = 50;
const MAX_OUTBOX_MESSAGES = 50;
const SECURE_CHUNK_LENGTH = 1600;
const SECURE_OPTIONS = {
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
} as const;
const conversations = new Map<string, CacheEntry>();
const outboxes = new Map<string, DmOutboxItem[]>();
const inFlight = new Map<string, { promise: Promise<DmCachedMessage[]> }>();
const generations = new Map<string, number>();
const writeQueues = new Map<string, Promise<unknown>>();
const backgroundTasks = new Set<Promise<unknown>>();
const historySignatures = new Map<string, string>();

function cacheKey(accountId: string | null | undefined, partnerId: string | null | undefined) {
  return accountId && partnerId ? `${accountId}\u001f${partnerId}` : null;
}

function generationFor(key: string): number {
  if (!generations.has(key)) generations.set(key, 0);
  return generations.get(key)!;
}

async function storageRoot(accountId: string, partnerId: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${accountId}\u001f${partnerId}`,
  );
  return `storigam_dm_v2_${digest}`;
}

async function accountIndexKey(accountId: string): Promise<string> {
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, accountId);
  return `storigam_dm_index_v2_${digest}`;
}

function enqueueWrite<T>(key: string, action: () => Promise<T>): Promise<T> {
  const prior = writeQueues.get(key) ?? Promise.resolve();
  const next = prior.catch(() => undefined).then(action);
  writeQueues.set(key, next);
  void next.finally(() => {
    if (writeQueues.get(key) === next) writeQueues.delete(key);
  }).catch(() => undefined);
  return next;
}

function observeBackgroundTask(task: Promise<unknown>): void {
  backgroundTasks.add(task);
  void task.finally(() => backgroundTasks.delete(task)).catch(() => undefined);
}

/** Test/support hook to wait for queued platform-store writes to settle. */
export async function flushDmConversationCacheWrites(): Promise<void> {
  while (backgroundTasks.size > 0) {
    await Promise.all([...backgroundTasks].map(task => task.catch(() => undefined)));
  }
}

function blobMetaKey(root: string, kind: 'history' | 'outbox'): string {
  return `${root}_${kind}_meta`;
}

function blobChunkKey(root: string, kind: 'history' | 'outbox', index: number, revision: string): string {
  return `${root}_${kind}_${revision}_${index}`;
}

function parseMeta(raw: string | null): SecureBlobMeta | null {
  try {
    const meta = raw ? JSON.parse(raw) as SecureBlobMeta : null;
    return meta?.version === 1 && Number.isInteger(meta.chunks)
      && meta.chunks > 0 && meta.chunks <= 512
      && typeof meta.revision === 'string' && /^[\w-]+$/.test(meta.revision) ? meta : null;
  } catch { return null; }
}

async function readBlob<T>(root: string, kind: 'history' | 'outbox'): Promise<T | null> {
  const metaRaw = await SecureStore.getItemAsync(blobMetaKey(root, kind), SECURE_OPTIONS);
  if (!metaRaw) return null;
  const meta = parseMeta(metaRaw);
  if (!meta) return null;
  const chunks = await Promise.all(
    Array.from({ length: meta.chunks }, (_, index) =>
      SecureStore.getItemAsync(blobChunkKey(root, kind, index, meta.revision), SECURE_OPTIONS)),
  );
  if (chunks.some(chunk => chunk === null)) return null;
  try {
    return JSON.parse(decodeURIComponent(chunks.join(''))) as T;
  } catch {
    return null;
  }
}

async function writeBlob(
  root: string,
  kind: 'history' | 'outbox',
  value: unknown,
  isCurrent: () => boolean,
): Promise<void> {
  const metaKey = blobMetaKey(root, kind);
  const stagingKey = `${metaKey}_staging`;
  const oldMeta = parseMeta(await SecureStore.getItemAsync(metaKey, SECURE_OPTIONS));
  const abandoned = parseMeta(await SecureStore.getItemAsync(stagingKey, SECURE_OPTIONS));
  if (abandoned && abandoned.revision !== oldMeta?.revision) {
    await Promise.all(Array.from({ length: abandoned.chunks }, (_, index) =>
      SecureStore.deleteItemAsync(blobChunkKey(root, kind, index, abandoned.revision), SECURE_OPTIONS)));
  }
  const encoded = encodeURIComponent(JSON.stringify(value));
  const chunks: string[] = [];
  for (let start = 0; start < encoded.length; start += SECURE_CHUNK_LENGTH) {
    chunks.push(encoded.slice(start, start + SECURE_CHUNK_LENGTH));
  }
  if (chunks.length === 0) chunks.push(encodeURIComponent('null'));
  if (chunks.length > 512) throw new Error('Secure conversation snapshot exceeds storage limit');
  const meta: SecureBlobMeta = { version: 1, chunks: chunks.length, revision: Crypto.randomUUID() };
  // Write a new revision before switching the commit pointer. A process killed
  // mid-write keeps the previous complete outbox/history, never mixed chunks.
  await SecureStore.setItemAsync(stagingKey, JSON.stringify(meta), SECURE_OPTIONS);
  await Promise.all(chunks.map((chunk, index) =>
    SecureStore.setItemAsync(blobChunkKey(root, kind, index, meta.revision), chunk, SECURE_OPTIONS)));
  if (!isCurrent()) {
    await Promise.all(chunks.map((_, index) =>
      SecureStore.deleteItemAsync(blobChunkKey(root, kind, index, meta.revision), SECURE_OPTIONS)));
    await SecureStore.deleteItemAsync(stagingKey, SECURE_OPTIONS);
    return;
  }
  await SecureStore.setItemAsync(metaKey, JSON.stringify(meta), SECURE_OPTIONS);
  if (oldMeta) {
    await Promise.all(Array.from({ length: oldMeta.chunks }, (_, index) =>
      SecureStore.deleteItemAsync(blobChunkKey(root, kind, index, oldMeta.revision), SECURE_OPTIONS)));
  }
  await SecureStore.deleteItemAsync(stagingKey, SECURE_OPTIONS);
}

async function deleteBlob(root: string, kind: 'history' | 'outbox'): Promise<void> {
  const metaKey = blobMetaKey(root, kind);
  const stagingKey = `${metaKey}_staging`;
  const metas = await Promise.all([metaKey, stagingKey].map(async key =>
    parseMeta(await SecureStore.getItemAsync(key, SECURE_OPTIONS))));
  await Promise.all([
    SecureStore.deleteItemAsync(metaKey, SECURE_OPTIONS),
    SecureStore.deleteItemAsync(stagingKey, SECURE_OPTIONS),
    ...metas.flatMap(meta => meta ? Array.from({ length: meta.chunks }, (_, index) =>
      SecureStore.deleteItemAsync(blobChunkKey(root, kind, index, meta.revision), SECURE_OPTIONS)) : []),
  ]);
}

async function trackConversation(accountId: string, partnerId: string): Promise<void> {
  const key = await accountIndexKey(accountId);
  await enqueueWrite(key, async () => {
    let partners: string[] = [];
    try {
      const parsed = await readBlob<unknown>(key, 'history');
      if (Array.isArray(parsed)) partners = parsed.filter((id): id is string => typeof id === 'string');
    } catch { /* rebuild a damaged index */ }
    partners = partners.filter(id => id !== partnerId);
    partners.push(partnerId);
    const evicted = partners.length > MAX_CACHED_CONVERSATIONS
      ? partners.slice(-MAX_CACHED_CONVERSATIONS - 1, -MAX_CACHED_CONVERSATIONS) : [];
    // Keep the full cleanup index. Only recent history is bounded; never evict
    // a durable unsent message just because another conversation was opened.
    await writeBlob(key, 'history', partners, () => true);
    await Promise.all(evicted.map(async id => {
      const root = await storageRoot(accountId, id);
      await deleteBlob(root, 'history');
      const memoryKey = cacheKey(accountId, id);
      if (memoryKey) {
        conversations.delete(memoryKey);
        historySignatures.delete(memoryKey);
      }
    }));
  });
}

function saveMemory(key: string, messages: DmCachedMessage[]): void {
  const opened = conversations.get(key)?.opened ?? false;
  conversations.delete(key);
  conversations.set(key, {
    messages: messages
      .filter(message => !message.id.startsWith('temp-') && !message.deliveryState)
      .slice(-MAX_CACHED_MESSAGES),
    opened,
  });
  while (conversations.size > MAX_CACHED_CONVERSATIONS) {
    const oldestKey = conversations.keys().next().value;
    if (oldestKey === undefined) break;
    conversations.delete(oldestKey);
    historySignatures.delete(oldestKey);
  }
}

function isMessageForConversation(
  value: unknown,
  accountId: string,
  partnerId: string,
): value is DmCachedMessage {
  if (!value || typeof value !== 'object') return false;
  const message = value as Partial<DmCachedMessage>;
  return typeof message.id === 'string'
    && typeof message.fromUserId === 'string'
    && typeof message.toUserId === 'string'
    && ((message.fromUserId === accountId && message.toUserId === partnerId)
      || (message.fromUserId === partnerId && message.toUserId === accountId))
    && typeof message.createdAt === 'string';
}

function isOutboxItem(value: unknown): value is DmOutboxItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<DmOutboxItem>;
  return typeof item.clientMessageId === 'string'
    && typeof item.createdAt === 'string'
    && typeof item.attempts === 'number'
    && typeof item.retryAt === 'number';
}

/** Synchronous memory read keeps recently visited chats available before paint. */
export function getDmConversationCache(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
): DmCachedMessage[] {
  const key = cacheKey(accountId, partnerId);
  if (!key) return [];
  const entry = conversations.get(key);
  if (!entry) return [];
  conversations.delete(key);
  conversations.set(key, entry);
  return [...entry.messages];
}

/** Hydrate the encrypted on-device snapshot after process restarts. */
export async function hydrateDmConversationCache(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
): Promise<DmCachedMessage[]> {
  const key = cacheKey(accountId, partnerId);
  if (!key || !accountId || !partnerId) return [];
  const memory = getDmConversationCache(accountId, partnerId);
  if (memory.length) return memory;
  const generation = generationFor(key);
  try {
    const root = await storageRoot(accountId, partnerId);
    const stored = await readBlob<unknown>(root, 'history');
    if (generation !== generationFor(key)) return [];
    // A network prefetch may have completed while SecureStore was reading.
    const freshMemory = getDmConversationCache(accountId, partnerId);
    if (conversations.has(key)) return freshMemory;
    const messages = Array.isArray(stored)
      ? stored.filter(item => isMessageForConversation(item, accountId, partnerId))
        .map(item => ({ ...item, isOwn: item.fromUserId === accountId }))
      : [];
    if (messages.length) saveMemory(key, messages);
    return messages;
  } catch {
    return [];
  }
}

export function wasDmConversationOpened(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
): boolean {
  const key = cacheKey(accountId, partnerId);
  return key ? conversations.get(key)?.opened ?? false : false;
}

export function markDmConversationOpened(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
): void {
  const key = cacheKey(accountId, partnerId);
  if (!key) return;
  const entry = conversations.get(key);
  if (entry) entry.opened = true;
}

/** Share inbox prefetches with the screen and collapse concurrent poll requests. */
export function fetchDmConversation(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
  fetcher: () => Promise<DmCachedMessage[]>,
): Promise<DmCachedMessage[]> {
  const key = cacheKey(accountId, partnerId);
  if (!key) return fetcher();
  const pending = inFlight.get(key);
  if (pending) return pending.promise;
  const entry: { promise: Promise<DmCachedMessage[]> } = { promise: Promise.resolve([]) };
  const request = fetcher()
    .then(messages => {
      if (inFlight.get(key) !== entry) return [];
      const result = Array.isArray(messages)
        ? messages.filter(message => isMessageForConversation(message, accountId!, partnerId!)) : [];
      saveMemory(key, result);
      return result;
    })
    .finally(() => {
      if (inFlight.get(key) === entry) inFlight.delete(key);
    });
  entry.promise = request;
  inFlight.set(key, entry);
  return request;
}

/** Retain only confirmed recent messages, encrypted by the platform key store. */
export function rememberDmConversation(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
  messages: DmCachedMessage[],
): void {
  const key = cacheKey(accountId, partnerId);
  if (!key || !accountId || !partnerId) return;
  const confirmed = messages
    .filter(message => !message.id.startsWith('temp-') && !message.deliveryState
      && isMessageForConversation(message, accountId, partnerId))
    .slice(-MAX_CACHED_MESSAGES);
  saveMemory(key, confirmed);
  const signature = JSON.stringify(confirmed);
  if (historySignatures.get(key) === signature) return;
  historySignatures.set(key, signature);
  const generation = generationFor(key);
  const rootPromise = storageRoot(accountId, partnerId);
  const task = rootPromise.then(root => enqueueWrite(`${root}_history`, async () => {
    if (generation !== generationFor(key)) return;
    await trackConversation(accountId, partnerId);
    if (generation !== generationFor(key)) return;
    if (confirmed.length) await writeBlob(root, 'history', confirmed, () => generation === generationFor(key));
    else await deleteBlob(root, 'history');
  })).catch(error => {
    if (historySignatures.get(key) === signature) historySignatures.delete(key);
    throw error;
  });
  observeBackgroundTask(task);
}

export function getDmOutbox(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
): DmOutboxItem[] {
  const key = cacheKey(accountId, partnerId);
  return key ? [...(outboxes.get(key) ?? [])] : [];
}

export async function hydrateDmOutbox(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
): Promise<DmOutboxItem[]> {
  const key = cacheKey(accountId, partnerId);
  if (!key || !accountId || !partnerId) return [];
  if (outboxes.has(key)) return getDmOutbox(accountId, partnerId);
  const generation = generationFor(key);
  try {
    const root = await storageRoot(accountId, partnerId);
    const stored = await readBlob<unknown>(root, 'outbox');
    if (generation !== generationFor(key)) return [];
    if (outboxes.has(key)) return getDmOutbox(accountId, partnerId);
    const items = Array.isArray(stored) ? stored.filter(isOutboxItem).slice(-MAX_OUTBOX_MESSAGES) : [];
    outboxes.set(key, items);
    return [...items];
  } catch (error) {
    // An unavailable keychain is not an empty outbox. A new send must not
    // overwrite previously queued messages when their storage cannot be read.
    throw error;
  }
}

export async function saveDmOutbox(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
  items: DmOutboxItem[],
): Promise<void> {
  const key = cacheKey(accountId, partnerId);
  if (!key || !accountId || !partnerId) return;
  if (items.length > MAX_OUTBOX_MESSAGES) throw new Error('Too many pending messages to queue safely');
  const unique = [...new Map(items.map(item => [item.clientMessageId, item])).values()];
  const previous = outboxes.get(key);
  outboxes.set(key, unique);
  const generation = generationFor(key);
  try {
    const root = await storageRoot(accountId, partnerId);
    await enqueueWrite(`${root}_outbox`, async () => {
      if (generation !== generationFor(key)) return;
      await trackConversation(accountId, partnerId);
      if (generation !== generationFor(key)) return;
      if (unique.length) await writeBlob(root, 'outbox', unique, () => generation === generationFor(key));
      else await deleteBlob(root, 'outbox');
    });
  } catch (error) {
    if (outboxes.get(key) === unique && generation === generationFor(key)) {
      if (previous) outboxes.set(key, previous);
      else outboxes.delete(key);
    }
    throw error;
  }
}

/** Remove local history and queued sends when this account clears a chat. */
export function forgetDmConversation(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
): void {
  const key = cacheKey(accountId, partnerId);
  if (!key || !accountId || !partnerId) return;
  generations.set(key, generationFor(key) + 1);
  historySignatures.delete(key);
  conversations.delete(key);
  outboxes.delete(key);
  inFlight.delete(key);
  const rootPromise = storageRoot(accountId, partnerId);
  const task = rootPromise.then(root => Promise.all([
    enqueueWrite(`${root}_history`, () => deleteBlob(root, 'history')),
    enqueueWrite(`${root}_outbox`, () => deleteBlob(root, 'outbox')),
  ])).then(async () => {
    const indexKey = await accountIndexKey(accountId);
    await enqueueWrite(indexKey, async () => {
      try {
        const partners = await readBlob<unknown>(indexKey, 'history');
        if (Array.isArray(partners)) {
          const next = partners.filter(id => id !== partnerId);
          if (next.length) await writeBlob(indexKey, 'history', next, () => true);
          else await deleteBlob(indexKey, 'history');
        }
      } catch { /* privacy cleanup is best-effort if secure storage is unavailable */ }
    });
  });
  observeBackgroundTask(task);
}

/** Clear all private local chat history and queued sends at account boundaries. */
export function clearDmAccountCache(accountId: string): void {
  const prefix = `${accountId}\u001f`;
  const accountKeys = new Set([
    ...generations.keys(), ...conversations.keys(), ...outboxes.keys(), ...inFlight.keys(),
  ]);
  const outstanding = [...backgroundTasks, ...writeQueues.values()];
  for (const key of accountKeys) {
    if (key.startsWith(prefix)) {
      generations.set(key, generationFor(key) + 1);
      historySignatures.delete(key);
    }
  }
  for (const key of [...conversations.keys()]) {
    if (key.startsWith(prefix)) conversations.delete(key);
  }
  for (const key of [...outboxes.keys()]) {
    if (key.startsWith(prefix)) outboxes.delete(key);
  }
  for (const key of [...inFlight.keys()]) {
    if (key.startsWith(prefix)) inFlight.delete(key);
  }
  const task = (async () => {
    await Promise.all(outstanding.map(write => write.catch(() => undefined)));
    const indexKey = await accountIndexKey(accountId);
    let partners: string[] = [];
    try {
      const parsed = await readBlob<unknown>(indexKey, 'history');
      if (Array.isArray(parsed)) partners = parsed.filter((id): id is string => typeof id === 'string');
    } catch { /* continue by removing the account index */ }
    // Drain per-conversation writes before deleting the index; doing this
    // outside the index queue avoids deadlocking a write that is registering.
    await Promise.all(partners.map(async partnerId => {
      const root = await storageRoot(accountId, partnerId);
      await Promise.all([
        enqueueWrite(`${root}_history`, () => deleteBlob(root, 'history')),
        enqueueWrite(`${root}_outbox`, () => deleteBlob(root, 'outbox')),
      ]);
    }));
    await enqueueWrite(indexKey, async () => {
      await deleteBlob(indexKey, 'history');
    });
  })();
  observeBackgroundTask(task);
}
