import { describe, expect, it, vi } from 'vitest';
vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 4,
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));
vi.mock('expo-crypto', async () => {
  const crypto = await import('node:crypto');
  return {
    CryptoDigestAlgorithm: { SHA256: 'SHA256' },
    randomUUID: crypto.randomUUID,
    digestStringAsync: async (_algorithm: string, text: string) =>
      crypto.createHash('sha256').update(text).digest('hex'),
  };
});
import {
  fetchDmConversation,
  forgetDmConversation,
  getDmConversationCache,
  markDmConversationOpened,
  rememberDmConversation,
  wasDmConversationOpened,
  type DmCachedMessage,
} from '../dmConversationCache';

function message(id: string, accountId = 'account-a', partnerId = 'bob'): DmCachedMessage {
  return {
    id,
    fromUserId: accountId,
    toUserId: partnerId,
    content: `message ${id}`,
    expression: null,
    isRead: true,
    createdAt: '2026-10-10T10:00:00.000Z',
    isOwn: true,
  };
}

describe('DM conversation cache', () => {
  it('keeps conversations isolated by signed-in account', () => {
    rememberDmConversation('account-a', 'bob', [message('a1')]);

    expect(getDmConversationCache('account-a', 'bob').map(item => item.id)).toEqual(['a1']);
    expect(getDmConversationCache('account-b', 'bob')).toEqual([]);
  });

  it('shares an in-flight prefetch with the conversation screen', async () => {
    let resolveFetch!: (messages: DmCachedMessage[]) => void;
    const fetcher = vi.fn(() => new Promise<DmCachedMessage[]>(resolve => {
      resolveFetch = resolve;
    }));

    const prefetch = fetchDmConversation('prefetch-account', 'prefetch-partner', fetcher);
    const screenLoad = fetchDmConversation('prefetch-account', 'prefetch-partner', fetcher);
    expect(fetcher).toHaveBeenCalledTimes(1);

    resolveFetch([message('prefetched', 'prefetch-account', 'prefetch-partner')]);
    await expect(prefetch).resolves.toMatchObject([{ id: 'prefetched' }]);
    await expect(screenLoad).resolves.toMatchObject([{ id: 'prefetched' }]);
    expect(getDmConversationCache('prefetch-account', 'prefetch-partner')).toHaveLength(1);
  });

  it('tracks first open and excludes unsent optimistic messages from the cache', () => {
    rememberDmConversation('open-account', 'open-partner', [
      message('saved', 'open-account', 'open-partner'),
      message('temp-123', 'open-account', 'open-partner'),
    ]);
    expect(wasDmConversationOpened('open-account', 'open-partner')).toBe(false);
    expect(getDmConversationCache('open-account', 'open-partner').map(item => item.id)).toEqual(['saved']);

    markDmConversationOpened('open-account', 'open-partner');
    expect(wasDmConversationOpened('open-account', 'open-partner')).toBe(true);
  });

  it('does not restore cached history when deletion races an in-flight prefetch', async () => {
    let resolveFetch!: (messages: DmCachedMessage[]) => void;
    const pending = fetchDmConversation('delete-account', 'delete-partner', () => new Promise(resolve => {
      resolveFetch = resolve;
    }));

    forgetDmConversation('delete-account', 'delete-partner');
    resolveFetch([message('deleted-chat')]);

    await expect(pending).resolves.toEqual([]);
    expect(getDmConversationCache('delete-account', 'delete-partner')).toEqual([]);
  });
});
