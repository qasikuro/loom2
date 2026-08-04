/**
 * Unit tests for buildNewMessageUpdater — the pure helper extracted from the
 * campfire SSE `new_message` handler.
 *
 * Verifies two critical invariants:
 *   1. A message whose userId appears in blockedIds is silently ignored
 *      (returns null → caller must not invoke setData).
 *   2. A message from a non-blocked user is still appended normally.
 */

import { describe, it, expect, vi } from 'vitest';

// ── Stub every RN / Expo module the campfire screen imports ────────────────

vi.mock('react-native', () => ({
  StyleSheet:            { create: (s: object) => s, absoluteFill: {} },
  Animated: {
    Value:   class { constructor() { return {}; } },
    timing:  () => ({ start: vi.fn() }),
    loop:    () => ({ start: vi.fn(), stop: vi.fn() }),
    sequence:() => ({ start: vi.fn() }),
    parallel:() => ({ start: vi.fn() }),
    delay:   () => ({ start: vi.fn() }),
    View:    ({ children }: { children: unknown }) => children,
  },
  Easing: { out: () => () => 0, inOut: () => () => 0, sin: () => 0, quad: () => 0 },
  Platform:             { OS: 'ios' },
  Alert:                { alert: vi.fn() },
  ActivityIndicator:    () => null,
  FlatList:             () => null,
  Image:                () => null,
  KeyboardAvoidingView: ({ children }: { children: unknown }) => children,
  Modal:                ({ children }: { children: unknown }) => children,
  Pressable:            ({ children }: { children: unknown }) => children,
  ScrollView:           ({ children }: { children: unknown }) => children,
  Text:                 ({ children }: { children: unknown }) => children,
  TextInput:            () => null,
  TouchableOpacity:     ({ children }: { children: unknown }) => children,
  View:                 ({ children }: { children: unknown }) => children,
  useWindowDimensions:  () => ({ width: 390, height: 844 }),
}));

vi.mock('expo-linear-gradient', () => ({ LinearGradient: () => null }));
vi.mock('expo-haptics', () => ({
  default: { impactAsync: vi.fn() },
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  impactAsync: vi.fn(),
}));
vi.mock('expo-router', () => ({
  useLocalSearchParams: () => ({ roomId: 'room-1' }),
}));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));
vi.mock('@clerk/expo', () => ({
  useAuth: () => ({ userId: 'user-me' }),
}));
vi.mock('@/utils/navigation', () => ({ safeBack: vi.fn() }));
vi.mock('@/components/Icon',  () => ({ Icon: () => null }));
vi.mock('@/components/Toast', () => ({ showToastGlobal: vi.fn() }));
vi.mock('@/hooks/useSSE',     () => ({
  useSSE: () => ({ connected: false }),
}));
vi.mock('@/context/AppContext', () => ({
  ApiError:  class ApiError extends Error {
    constructor(
      message: string,
      public readonly status: number,
      public readonly retryAfter: number | null = null,
    ) { super(message); this.name = 'ApiError'; }
  },
  apiFetch:  vi.fn(),
  useApp:    () => ({
    character:            { name: 'Tester' },
    markCampfireRoomRead: vi.fn(),
    blockedIds:           [],
  }),
}));
vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>();
  return real;
});

// ── Import after mocks ─────────────────────────────────────────────────────

import {
  buildNewMessageUpdater,
  type SseNewMessage,
} from '../campfire/[roomId]';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeRoomData(messageIds: string[] = []) {
  return {
    room:      { id: 'room-1', name: 'Test Room', mood: 'Peaceful', isPreset: true },
    soulCount: 2,
    messages:  messageIds.map(id => ({
      id,
      userId:       `user-${id}`,
      authorName:   `Author ${id}`,
      content:      `Message ${id}`,
      expression:   null,
      createdAt:    '2026-08-04T00:00:00Z',
      isMine:       false,
      isFounder:    false,
      isBetaTester: false,
    })),
  };
}

function makeMsg(overrides: Partial<SseNewMessage> = {}): SseNewMessage {
  return {
    id:          'msg-new',
    userId:      'user-other',
    authorName:  'Other User',
    content:     'Hello from other',
    expression:  null,
    createdAt:   '2026-08-04T01:00:00Z',
    isFounder:   false,
    isBetaTester: false,
    ...overrides,
  };
}

// ── Tests: blocked user — setData must NOT be called ──────────────────────

describe('buildNewMessageUpdater — blocked user', () => {
  it('returns null when the message userId is in blockedIds', () => {
    const msg  = makeMsg({ userId: 'blocked-user-1' });
    const result = buildNewMessageUpdater(msg, ['blocked-user-1'], 'user-me');
    expect(result).toBeNull();
  });

  it('returns null regardless of message content when user is blocked', () => {
    const msg  = makeMsg({ userId: 'blocked-user-2', content: 'I am blocked' });
    const result = buildNewMessageUpdater(msg, ['blocked-user-1', 'blocked-user-2'], 'user-me');
    expect(result).toBeNull();
  });

  it('returns null for each of several blocked users', () => {
    const blockedIds = ['u-a', 'u-b', 'u-c'];
    for (const userId of blockedIds) {
      const result = buildNewMessageUpdater(makeMsg({ userId }), blockedIds, 'user-me');
      expect(result).toBeNull();
    }
  });

  it('caller does not invoke setData when result is null (blocked user)', () => {
    const msg     = makeMsg({ userId: 'blocked-user-1' });
    const setData = vi.fn();
    const updater = buildNewMessageUpdater(msg, ['blocked-user-1'], 'user-me');
    if (!updater) {
      // Guard — this is the expected path
    } else {
      setData(updater);
    }
    expect(setData).not.toHaveBeenCalled();
  });
});

// ── Tests: non-blocked user — message is appended normally ────────────────

describe('buildNewMessageUpdater — non-blocked user', () => {
  it('returns a function (not null) when blockedIds is empty', () => {
    const result = buildNewMessageUpdater(makeMsg(), [], 'user-me');
    expect(result).toBeTypeOf('function');
  });

  it('returns a function when the user is not in the blocked list', () => {
    const result = buildNewMessageUpdater(makeMsg({ userId: 'user-other' }), ['different-user'], 'user-me');
    expect(result).toBeTypeOf('function');
  });

  it('appends the new message to the existing list', () => {
    const prev    = makeRoomData(['msg-1', 'msg-2']);
    const msg     = makeMsg({ id: 'msg-3', userId: 'user-other' });
    const updater = buildNewMessageUpdater(msg, [], 'user-me')!;
    const next    = updater(prev);
    expect(next?.messages.map(m => m.id)).toEqual(['msg-1', 'msg-2', 'msg-3']);
  });

  it('sets isMine=true when the message userId matches myUserId', () => {
    const msg     = makeMsg({ id: 'msg-mine', userId: 'user-me' });
    const updater = buildNewMessageUpdater(msg, [], 'user-me')!;
    const next    = updater(makeRoomData())!;
    expect(next.messages[0].isMine).toBe(true);
  });

  it('sets isMine=false when the message userId does not match myUserId', () => {
    const msg     = makeMsg({ id: 'msg-other', userId: 'user-other' });
    const updater = buildNewMessageUpdater(msg, [], 'user-me')!;
    const next    = updater(makeRoomData())!;
    expect(next.messages[0].isMine).toBe(false);
  });

  it('preserves existing messages when appending', () => {
    const prev    = makeRoomData(['msg-1', 'msg-2']);
    const msg     = makeMsg({ id: 'msg-3' });
    const updater = buildNewMessageUpdater(msg, [], 'user-me')!;
    const next    = updater(prev)!;
    expect(next.messages).toHaveLength(3);
    expect(next.messages[0].id).toBe('msg-1');
    expect(next.messages[1].id).toBe('msg-2');
  });

  it('preserves room metadata when appending', () => {
    const prev    = makeRoomData(['msg-1']);
    const updater = buildNewMessageUpdater(makeMsg(), [], 'user-me')!;
    const next    = updater(prev)!;
    expect(next.room).toEqual(prev.room);
    expect(next.soulCount).toBe(prev.soulCount);
  });

  it('returns prev unchanged (same reference) when the message id is already present (dedup)', () => {
    const prev    = makeRoomData(['msg-existing']);
    const msg     = makeMsg({ id: 'msg-existing', userId: 'user-other' });
    const updater = buildNewMessageUpdater(msg, [], 'user-me')!;
    const next    = updater(prev);
    expect(next).toBe(prev);
  });

  it('returns prev unchanged when prev is null', () => {
    const updater = buildNewMessageUpdater(makeMsg(), [], 'user-me')!;
    expect(updater(null)).toBeNull();
  });

  it('defaults isFounder and isBetaTester to false when undefined', () => {
    const msg     = makeMsg({ userId: 'user-other', isFounder: undefined, isBetaTester: undefined });
    const updater = buildNewMessageUpdater(msg, [], 'user-me')!;
    const next    = updater(makeRoomData())!;
    expect(next.messages[0].isFounder).toBe(false);
    expect(next.messages[0].isBetaTester).toBe(false);
  });

  it('preserves isFounder=true when provided', () => {
    const msg     = makeMsg({ userId: 'user-other', isFounder: true });
    const updater = buildNewMessageUpdater(msg, [], 'user-me')!;
    const next    = updater(makeRoomData())!;
    expect(next.messages[0].isFounder).toBe(true);
  });
});

// ── Tests: blocked vs non-blocked boundary ────────────────────────────────

describe('buildNewMessageUpdater — blocked/non-blocked boundary', () => {
  it('does not affect non-blocked users when blocked list is non-empty', () => {
    const msg    = makeMsg({ userId: 'user-allowed' });
    const result = buildNewMessageUpdater(msg, ['user-blocked'], 'user-me');
    expect(result).toBeTypeOf('function');
  });

  it('only blocks the exact userId — similar-looking ids are not blocked', () => {
    const result = buildNewMessageUpdater(
      makeMsg({ userId: 'user-1' }),
      ['user-10', 'user-100'],
      'user-me',
    );
    expect(result).toBeTypeOf('function');
  });

  it('unblocked message still appends when one other user is blocked', () => {
    const prev    = makeRoomData(['msg-1']);
    const msg     = makeMsg({ id: 'msg-2', userId: 'user-allowed' });
    const updater = buildNewMessageUpdater(msg, ['user-blocked'], 'user-me')!;
    const next    = updater(prev)!;
    expect(next.messages.map(m => m.id)).toEqual(['msg-1', 'msg-2']);
  });
});
