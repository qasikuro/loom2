import { describe, expect, it, vi } from 'vitest';
import {
  fetchDmConversation,
  forgetDmConversation,
  getDmConversationCache,
  markDmConversationOpened,
  rememberDmConversation,
  wasDmConversationOpened,
  type DmCachedMessage,
} from '../dmConversationCache';

function message(id: string): DmCachedMessage {
  return {
    id,
    fromUserId: 'alice',
    toUserId: 'bob',
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

    resolveFetch([message('prefetched')]);
    await expect(prefetch).resolves.toMatchObject([{ id: 'prefetched' }]);
    await expect(screenLoad).resolves.toMatchObject([{ id: 'prefetched' }]);
    expect(getDmConversationCache('prefetch-account', 'prefetch-partner')).toHaveLength(1);
  });

  it('tracks first open and excludes unsent optimistic messages from the cache', () => {
    rememberDmConversation('open-account', 'open-partner', [message('saved'), message('temp-123')]);
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
