import type { ChatMessage } from '@workspace/api-client-react';

export type DmCachedMessage = ChatMessage;

interface CacheEntry {
  messages: DmCachedMessage[];
  opened: boolean;
}

const MAX_CACHED_CONVERSATIONS = 8;
const conversations = new Map<string, CacheEntry>();
const inFlight = new Map<string, { promise: Promise<DmCachedMessage[]> }>();

function cacheKey(accountId: string | null | undefined, partnerId: string | null | undefined) {
  return accountId && partnerId ? `${accountId}\u001f${partnerId}` : null;
}

function save(key: string, messages: DmCachedMessage[]) {
  const opened = conversations.get(key)?.opened ?? false;
  conversations.delete(key);
  conversations.set(key, {
    messages: messages.filter(message => !message.id.startsWith('temp-')),
    opened,
  });
  while (conversations.size > MAX_CACHED_CONVERSATIONS) {
    const oldestKey = conversations.keys().next().value;
    if (oldestKey === undefined) break;
    conversations.delete(oldestKey);
  }
}

/** Memory-only cache: avoid persisting private message text to unencrypted storage. */
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
      const result = Array.isArray(messages) ? messages : [];
      save(key, result);
      return result;
    })
    .finally(() => {
      if (inFlight.get(key) === entry) inFlight.delete(key);
    });
  entry.promise = request;
  inFlight.set(key, entry);
  return request;
}

export function rememberDmConversation(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
  messages: DmCachedMessage[],
): void {
  const key = cacheKey(accountId, partnerId);
  if (key) save(key, messages);
}

/** Remove local history and prevent a late prefetch from restoring a deleted chat. */
export function forgetDmConversation(
  accountId: string | null | undefined,
  partnerId: string | null | undefined,
): void {
  const key = cacheKey(accountId, partnerId);
  if (!key) return;
  conversations.delete(key);
  inFlight.delete(key);
}
