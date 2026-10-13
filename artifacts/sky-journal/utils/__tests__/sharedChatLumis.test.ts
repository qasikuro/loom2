import { describe, expect, it } from 'vitest';
import { CHAT_EMOTES } from '../../features/lumi/chat/chatEmotes';
import {
  acceptSharedReaction, MAX_PENDING_PERFORMANCES, mergeConfirmedChatMessage, parseSharedReaction,
  queueSharedPerformances, seedSharedReactionHistory, sharedReactionContent,
  type SharedLumiEvent, type SharedReactionMessage, type SharedReactionTracker,
} from '../../features/lumi/chat/sharedChatReactions';

const now = Date.parse('2026-10-13T16:00:00Z');
const ctxA = { viewerId: 'user-a', partnerId: 'user-b', active: true, now };
const ctxB = { viewerId: 'user-b', partnerId: 'user-a', active: true, now };
const tracker = (): SharedReactionTracker => ({ seen: [] });
const message = (patch: Partial<SharedReactionMessage> = {}): SharedReactionMessage => ({
  id: 'confirmed-1', fromUserId: 'user-a', toUserId: 'user-b',
  content: sharedReactionContent('heart'), expression: null, imageUri: null,
  createdAt: new Date(now - 1000).toISOString(), ...patch,
});

describe('shared Lumi message protocol', () => {
  it.each(CHAT_EMOTES)('round-trips $id as readable, ordinary message text', emote => {
    const content = sharedReactionContent(emote.id);
    expect(content).toBe(`Lumi: ${emote.emoji}`);
    expect(parseSharedReaction(content)).toBe(emote.id);
    expect(content.length).toBeLessThan(2000);
    expect(JSON.parse(JSON.stringify({ content }))).toEqual({ content });
  });

  it('does not turn captions, unknown identifiers or normal emoji messages into animations', () => {
    for (const content of [null, undefined, '❤️', 'Lumi: unknown', 'Hi Lumi: ❤️', 'Lumi: ❤️ more', ' Lumi: ❤️']) {
      expect(parseSharedReaction(content)).toBeNull();
    }
    expect(acceptSharedReaction(tracker(), message({ imageUri: '/api/images/photo.jpg' }), ctxB)).toBeNull();
    expect(acceptSharedReaction(tracker(), message({ expression: 'spark' }), ctxB)).toBeNull();
  });
});

describe('shared Lumi playback isolation and delivery', () => {
  it('replaces an optimistic message once, regardless of an early SSE confirmation', () => {
    const sent = message();
    const optimistic = message({ id: 'temp-1' });
    expect(mergeConfirmedChatMessage([optimistic], sent, optimistic.id)).toEqual([sent]);
    expect(mergeConfirmedChatMessage([optimistic, sent], sent, optimistic.id)).toEqual([sent]);
    expect(mergeConfirmedChatMessage([sent], sent)).toEqual([sent]);
  });
  it('mirrors roles correctly on both phones, for either sender', () => {
    expect(acceptSharedReaction(tracker(), message(), ctxA)?.side).toBe('own');
    expect(acceptSharedReaction(tracker(), message(), ctxB)?.side).toBe('other');
    const reply = message({ fromUserId: 'user-b', toUserId: 'user-a' });
    expect(acceptSharedReaction(tracker(), reply, ctxA)?.side).toBe('other');
    expect(acceptSharedReaction(tracker(), reply, ctxB)?.side).toBe('own');
  });

  it.each(['POST first', 'SSE first'])('deduplicates sender confirmation, live push and poll: %s', () => {
    const a = tracker();
    const b = tracker();
    expect(acceptSharedReaction(a, message(), ctxA)?.emoteId).toBe('heart');
    expect(acceptSharedReaction(b, message(), ctxB)?.emoteId).toBe('heart');
    for (let repeat = 0; repeat < 3; repeat++) {
      expect(acceptSharedReaction(a, message(), ctxA)).toBeNull();
      expect(acceptSharedReaction(b, message(), ctxB)).toBeNull();
    }
  });

  it('seeds even fresh unread history without replay when a conversation opens again', () => {
    const state = tracker();
    seedSharedReactionHistory(state, [message()]);
    expect(acceptSharedReaction(state, message(), ctxB)).toBeNull();
    expect(acceptSharedReaction(state, message({ id: 'new-live' }), ctxB)?.side).toBe('other');
  });

  it('does not replay reactions received while the chat was inactive', () => {
    const state = tracker();
    expect(acceptSharedReaction(state, message(), { ...ctxB, active: false })).toBeNull();
    expect(acceptSharedReaction(state, message(), ctxB)).toBeNull();
  });

  it('rejects unconfirmed, stale, invalid-date and far-future messages', () => {
    for (const patch of [
      { id: 'temp-1' },
      { createdAt: new Date(now - 61_000).toISOString() },
      { createdAt: new Date(now + 31_000).toISOString() },
      { createdAt: 'invalid' },
    ]) expect(acceptSharedReaction(tracker(), message(patch), ctxB)).toBeNull();
  });

  it('accepts a fresh confirmed message found by the existing fallback poll', () => {
    expect(acceptSharedReaction(tracker(), message({ createdAt: new Date(now - 35_000).toISOString() }), ctxB)?.emoteId)
      .toBe('heart');
  });

  it('rejects another conversation, account or spoofed participant', () => {
    for (const patch of [
      { fromUserId: 'unrelated' }, { toUserId: 'unrelated' },
      { fromUserId: 'user-b', toUserId: 'user-b' },
    ]) expect(acceptSharedReaction(tracker(), message(patch), ctxB)).toBeNull();
    expect(acceptSharedReaction(tracker(), message(), { ...ctxB, viewerId: 'another-account' })).toBeNull();
  });

  it('bounds deduplication memory independently of the conversation length', () => {
    const state = tracker();
    seedSharedReactionHistory(state, Array.from({ length: 1200 }, (_, i) => ({ id: `id-${i}` })));
    expect(state.seen).toHaveLength(512);
    expect(state.seen.at(-1)).toBe('id-1199');
  });
});

describe('one center shared by two mascots', () => {
  const event = (id: string, side: 'own' | 'other' = 'own'): SharedLumiEvent => ({
    messageId: id, emoteId: 'heart', side, createdAt: new Date(now).toISOString(),
  });

  it('preserves both participants turns and excludes the currently playing message', () => {
    const queued = [event('a', 'own')];
    const incoming = [event('playing'), event('a', 'own'), event('b', 'other')];
    expect(queueSharedPerformances(queued, incoming, 'playing').map(e => [e.messageId, e.side]))
      .toEqual([['a', 'own'], ['b', 'other']]);
    expect(queued).toHaveLength(1);
    expect(incoming).toHaveLength(3);
  });

  it('cannot grow without bound during repeated emote spam', () => {
    const incoming = Array.from({ length: 200 }, (_, i) => event(`event-${i}`, i % 2 ? 'own' : 'other'));
    const queue = queueSharedPerformances([], incoming);
    expect(queue).toHaveLength(MAX_PENDING_PERFORMANCES);
    expect(new Set(queue.map(e => e.messageId)).size).toBe(MAX_PENDING_PERFORMANCES);
  });
});
