import { beforeEach, describe, expect, it, vi } from 'vitest';

const device = vi.hoisted(() => ({ data: new Map<string, string>(), failChunks: false, failReads: false }));
vi.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY: 4,
  getItemAsync: async (key: string) => {
    if (device.failReads) throw new Error('simulated locked keychain');
    return device.data.get(key) ?? null;
  },
  setItemAsync: async (key: string, value: string) => {
    if (device.failChunks && /_outbox_[\w-]+_\d+$/.test(key)) throw new Error('simulated storage failure');
    device.data.set(key, value);
  },
  deleteItemAsync: async (key: string) => { device.data.delete(key); },
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

const message = (id: string, account = 'alice', partner = 'bob') => ({
  id, fromUserId: account, toUserId: partner, content: `你好 ${id} 🌟`,
  imageUri: null, expression: null, isRead: false,
  createdAt: '2026-10-27T12:00:00.000Z', isOwn: true,
});
const pending = (id = '00000000-0000-4000-8000-000000000001') => ({
  clientMessageId: id, createdAt: '2026-10-27T12:00:00.000Z',
  content: 'pending message', imageUri: null, expression: null, attempts: 1, retryAt: 1,
});
async function restart() {
  vi.resetModules();
  return import('../dmConversationCache');
}

beforeEach(() => {
  vi.resetModules();
  device.data.clear();
  device.failChunks = false;
  device.failReads = false;
});

describe('native secure DM persistence', () => {
  it('does not treat an unavailable keychain as an empty outbox', async () => {
    let cache = await restart();
    await cache.saveDmOutbox('alice', 'bob', [pending()]);
    cache = await restart();
    device.failReads = true;
    await expect(cache.hydrateDmOutbox('alice', 'bob')).rejects.toThrow('locked keychain');
    device.failReads = false;
    expect(await cache.hydrateDmOutbox('alice', 'bob')).toHaveLength(1);
  });
  it('hydrates the latest 50 Unicode messages after a process restart and isolates account/partner keys', async () => {
    let cache = await restart();
    cache.rememberDmConversation('alice', 'bob', Array.from({ length: 70 }, (_, i) => message(String(i))));
    await cache.flushDmConversationCacheWrites();
    expect([...device.data.values()].every(value => Buffer.byteLength(value) < 2000)).toBe(true);

    cache = await restart();
    const restored = await cache.hydrateDmConversationCache('alice', 'bob');
    expect(restored).toHaveLength(50);
    expect(restored[0].id).toBe('20');
    expect(restored[49].content).toBe('你好 69 🌟');
    expect(await cache.hydrateDmConversationCache('another-account', 'bob')).toEqual([]);
    expect(await cache.hydrateDmConversationCache('alice', 'another-partner')).toEqual([]);
  });

  it('persists an outbox ID across restarts and never evicts unsent messages with the history LRU', async () => {
    let cache = await restart();
    await cache.saveDmOutbox('alice', 'bob', [pending()]);
    for (let i = 0; i < 10; i++) {
      cache.rememberDmConversation('alice', `partner-${i}`, [message(String(i), 'alice', `partner-${i}`)]);
    }
    await cache.flushDmConversationCacheWrites();
    cache = await restart();
    expect(await cache.hydrateDmOutbox('alice', 'bob')).toEqual([pending()]);
  });

  it('keeps the previous committed outbox if an update is interrupted', async () => {
    let cache = await restart();
    await cache.saveDmOutbox('alice', 'bob', [pending()]);
    device.failChunks = true;
    await expect(cache.saveDmOutbox('alice', 'bob', [pending(), pending('00000000-0000-4000-8000-000000000002')]))
      .rejects.toThrow('simulated storage failure');
    device.failChunks = false;
    cache = await restart();
    expect(await cache.hydrateDmOutbox('alice', 'bob')).toEqual([pending()]);
  });

  it('forgets both history and queued sends when the current account deletes a chat', async () => {
    let cache = await restart();
    cache.rememberDmConversation('alice', 'bob', [message('private')]);
    await cache.saveDmOutbox('alice', 'bob', [pending()]);
    await cache.flushDmConversationCacheWrites();
    cache.forgetDmConversation('alice', 'bob');
    await cache.flushDmConversationCacheWrites();
    cache = await restart();
    expect(await cache.hydrateDmConversationCache('alice', 'bob')).toEqual([]);
    expect(await cache.hydrateDmOutbox('alice', 'bob')).toEqual([]);
    expect(device.data.size).toBe(0);
  });

  it('invalidates racing writes on logout without deleting another account data', async () => {
    let cache = await restart();
    cache.rememberDmConversation('other', 'bob', [message('keep', 'other')]);
    await cache.flushDmConversationCacheWrites();
    cache.rememberDmConversation('alice', 'bob', [message('remove')]);
    const pendingWrite = cache.saveDmOutbox('alice', 'bob', [pending()]);
    cache.clearDmAccountCache('alice');
    await pendingWrite;
    await cache.flushDmConversationCacheWrites();
    cache = await restart();
    expect(await cache.hydrateDmConversationCache('alice', 'bob')).toEqual([]);
    expect(await cache.hydrateDmOutbox('alice', 'bob')).toEqual([]);
    expect((await cache.hydrateDmConversationCache('other', 'bob'))[0]?.id).toBe('keep');
  });

  it('does not let a late disk snapshot replace an authoritative empty network page', async () => {
    let cache = await restart();
    cache.rememberDmConversation('alice', 'bob', [message('deleted')]);
    await cache.flushDmConversationCacheWrites();
    cache = await restart();
    const hydration = cache.hydrateDmConversationCache('alice', 'bob');
    await cache.fetchDmConversation('alice', 'bob', async () => []);
    expect(await hydration).toEqual([]);
  });
});
