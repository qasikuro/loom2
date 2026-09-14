/**
 * Unit tests for executeSendText — the extracted core of the campfire sendText
 * handler.  Focuses on the 429 rate-limit path: verifies that text is restored,
 * showInput is set back to true, and showToastGlobal is called with the right
 * message.  No React render or native runtime required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── The function under test lives in the campfire screen. ──────────────────
// The file imports several RN / Expo modules at the top level; mock them so
// the module can be loaded in a plain Node environment.

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
  useAuth: () => ({ userId: 'user-1' }),
}));
vi.mock('@/utils/navigation', () => ({ safeBack: vi.fn() }));
vi.mock('@/components/Icon',  () => ({ Icon: () => null }));
vi.mock('@/components/SkyLoading', () => ({
  SkyLoadingMark:    () => null,
  SkyLoadingOverlay: () => null,
}));
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
// Silence React import inside the screen module
vi.mock('react', async (importOriginal) => {
  const real = await importOriginal<typeof import('react')>();
  return real;
});

// ── Import after mocks ─────────────────────────────────────────────────────

import { executeSendText, applyDeletedMessage, applyPollResult, type SendTextDeps } from '../campfire/[roomId]';

// ── Helpers ────────────────────────────────────────────────────────────────

function makeErr(status: number, retryAfter: number | null = null) {
  return Object.assign(new Error(`HTTP ${status}`), { status, retryAfter });
}

// Concrete helper type — all injectable deps are vi.fn() mocks so tests can
// call .toHaveBeenCalledWith() etc.  Passed to executeSendText via cast.
interface TestDeps {
  text:             string;
  sending:          boolean;
  roomId:           string | undefined;
  characterName:    string;
  apiFetch:         ReturnType<typeof vi.fn>;
  appendOwnMessage: ReturnType<typeof vi.fn>;
  setSending:       ReturnType<typeof vi.fn>;
  setText:          ReturnType<typeof vi.fn>;
  setShowInput:     ReturnType<typeof vi.fn>;
  showToast:        ReturnType<typeof vi.fn>;
}

type PartialOverrides = Partial<Omit<TestDeps, 'apiFetch'>> & { apiFetch?: ReturnType<typeof vi.fn> };

function makeDeps(overrides: PartialOverrides = {}): TestDeps {
  return {
    text:             'Hello campfire',
    sending:          false,
    roomId:           'room-42',
    characterName:    'Wanderer',
    apiFetch:         vi.fn(),
    appendOwnMessage: vi.fn(),
    setSending:       vi.fn(),
    setText:          vi.fn(),
    setShowInput:     vi.fn(),
    showToast:        vi.fn(),
    ...overrides,
  };
}

function asSendTextDeps(d: TestDeps): import('../campfire/[roomId]').SendTextDeps {
  return d as unknown as import('../campfire/[roomId]').SendTextDeps;
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe('executeSendText — 429 rate-limit path', () => {
  let deps: ReturnType<typeof makeDeps>;

  beforeEach(() => {
    deps = makeDeps();
  });

  it('restores text to the original trimmed value after a 429', async () => {
    deps.apiFetch.mockRejectedValue(makeErr(429));
    await executeSendText(asSendTextDeps(deps));
    expect(deps.setText).toHaveBeenLastCalledWith('Hello campfire');
  });

  it('sets showInput to true after a 429 so the input bar reappears', async () => {
    deps.apiFetch.mockRejectedValue(makeErr(429));
    await executeSendText(asSendTextDeps(deps));
    expect(deps.setShowInput).toHaveBeenLastCalledWith(true);
  });

  it('calls showToastGlobal with the rate-limit warning message', async () => {
    deps.apiFetch.mockRejectedValue(makeErr(429));
    await executeSendText(asSendTextDeps(deps));
    expect(deps.showToast).toHaveBeenCalledOnce();
    expect(deps.showToast).toHaveBeenCalledWith('Slow down a little ✦', 'warning');
  });

  it('appends " Try again in Ns." to the toast when retryAfter >= 5', async () => {
    deps.apiFetch.mockRejectedValue(makeErr(429, 15));
    await executeSendText(asSendTextDeps(deps));
    expect(deps.showToast).toHaveBeenCalledWith('Slow down a little ✦ Try again in 15s.', 'warning');
  });

  it('omits the retry suffix when retryAfter < 5', async () => {
    deps.apiFetch.mockRejectedValue(makeErr(429, 3));
    await executeSendText(asSendTextDeps(deps));
    expect(deps.showToast).toHaveBeenCalledWith('Slow down a little ✦', 'warning');
  });

  it('omits the retry suffix when retryAfter is null', async () => {
    deps.apiFetch.mockRejectedValue(makeErr(429, null));
    await executeSendText(asSendTextDeps(deps));
    expect(deps.showToast).toHaveBeenCalledWith('Slow down a little ✦', 'warning');
  });

  it('still calls setSending(false) in finally after a 429', async () => {
    deps.apiFetch.mockRejectedValue(makeErr(429));
    await executeSendText(asSendTextDeps(deps));
    expect(deps.setSending).toHaveBeenLastCalledWith(false);
  });
});

describe('executeSendText — non-429 error path', () => {
  it('shows a toast for a 500 error', async () => {
    const deps = makeDeps({ apiFetch: vi.fn().mockRejectedValue(makeErr(500)) });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.showToast).toHaveBeenCalledOnce();
    expect(deps.showToast).toHaveBeenCalledWith("Message couldn't be sent", 'error');
  });

  it('restores the original text after a 500 error', async () => {
    const deps = makeDeps({ apiFetch: vi.fn().mockRejectedValue(makeErr(500)) });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.setText).toHaveBeenLastCalledWith('Hello campfire');
  });

  it('sets showInput to true after a 500 error so the input bar reappears', async () => {
    const deps = makeDeps({ apiFetch: vi.fn().mockRejectedValue(makeErr(500)) });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.setShowInput).toHaveBeenLastCalledWith(true);
  });

  it('still calls setSending(false) in finally for a 500', async () => {
    const deps = makeDeps({ apiFetch: vi.fn().mockRejectedValue(makeErr(500)) });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.setSending).toHaveBeenLastCalledWith(false);
  });

  it('shows a toast for a network-level error (no status property)', async () => {
    const deps = makeDeps({ apiFetch: vi.fn().mockRejectedValue(new Error('Network request failed')) });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.showToast).toHaveBeenCalledOnce();
    expect(deps.showToast).toHaveBeenCalledWith("Message couldn't be sent", 'error');
  });

  it('restores text after a network-level error', async () => {
    const deps = makeDeps({ apiFetch: vi.fn().mockRejectedValue(new Error('Network request failed')) });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.setText).toHaveBeenLastCalledWith('Hello campfire');
  });
});

describe('executeSendText — happy path', () => {
  it('calls appendOwnMessage with the returned message', async () => {
    const fakeMsg = { id: 'msg-1', userId: 'u1', authorName: 'Wanderer', content: 'Hello campfire', expression: null, createdAt: '2026-08-04T00:00:00Z', isMine: true };
    const deps = makeDeps({ apiFetch: vi.fn().mockResolvedValue(fakeMsg) });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.appendOwnMessage).toHaveBeenCalledWith(fakeMsg);
  });

  it('clears the text field before sending', async () => {
    const deps = makeDeps({ apiFetch: vi.fn().mockResolvedValue({ id: 'x' }) });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.setText).toHaveBeenCalledWith('');
  });

  it('hides the input bar before sending', async () => {
    const deps = makeDeps({ apiFetch: vi.fn().mockResolvedValue({ id: 'x' }) });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.setShowInput).toHaveBeenCalledWith(false);
  });
});

describe('executeSendText — early-exit guards', () => {
  it('does nothing when text is empty', async () => {
    const deps = makeDeps({ text: '   ' });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.apiFetch).not.toHaveBeenCalled();
    expect(deps.setSending).not.toHaveBeenCalled();
  });

  it('does nothing when already sending', async () => {
    const deps = makeDeps({ sending: true });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.apiFetch).not.toHaveBeenCalled();
  });

  it('does nothing when roomId is undefined', async () => {
    const deps = makeDeps({ roomId: undefined });
    await executeSendText(asSendTextDeps(deps));
    expect(deps.apiFetch).not.toHaveBeenCalled();
  });
});

// ── Helpers for room-data tests ────────────────────────────────────────────

type RoomData = Parameters<typeof applyDeletedMessage>[0] & object;

function makeRoom(messageIds: string[]): NonNullable<RoomData> {
  return {
    room:      { id: 'room-1', name: 'Test Room', mood: 'Peaceful', isPreset: true },
    soulCount: 3,
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

// ── applyDeletedMessage — SSE deleted_message event ────────────────────────

describe('applyDeletedMessage — SSE deleted_message event', () => {
  it('removes the matching message from the list', () => {
    const prev = makeRoom(['msg-1', 'msg-2', 'msg-3']);
    const next = applyDeletedMessage(prev, 'msg-2');
    expect(next?.messages.map(m => m.id)).toEqual(['msg-1', 'msg-3']);
  });

  it('removes a message that is the only one in the list', () => {
    const prev = makeRoom(['msg-1']);
    const next = applyDeletedMessage(prev, 'msg-1');
    expect(next?.messages).toHaveLength(0);
  });

  it('removes the first message correctly', () => {
    const prev = makeRoom(['msg-1', 'msg-2', 'msg-3']);
    const next = applyDeletedMessage(prev, 'msg-1');
    expect(next?.messages.map(m => m.id)).toEqual(['msg-2', 'msg-3']);
  });

  it('removes the last message correctly', () => {
    const prev = makeRoom(['msg-1', 'msg-2', 'msg-3']);
    const next = applyDeletedMessage(prev, 'msg-3');
    expect(next?.messages.map(m => m.id)).toEqual(['msg-1', 'msg-2']);
  });

  it('returns the same reference when the id is not found (no re-render)', () => {
    const prev = makeRoom(['msg-1', 'msg-2']);
    const next = applyDeletedMessage(prev, 'msg-unknown');
    expect(next).toBe(prev); // reference equality — React skips re-render
  });

  it('returns null unchanged when prev is null', () => {
    expect(applyDeletedMessage(null, 'msg-1')).toBeNull();
  });

  it('preserves room metadata (name, mood, soulCount) after deletion', () => {
    const prev = makeRoom(['msg-1', 'msg-2']);
    const next = applyDeletedMessage(prev, 'msg-1');
    expect(next?.room).toEqual(prev.room);
    expect(next?.soulCount).toBe(prev.soulCount);
  });
});

// ── applyPollResult — poll re-fetch replaces entire message list ───────────

describe('applyPollResult — poll re-fetch removes deleted messages', () => {
  it('replaces messages with the server response, dropping the deleted one', () => {
    const prev    = makeRoom(['msg-1', 'msg-2', 'msg-3']);
    // Server no longer returns msg-2 (deleted)
    const fetched = makeRoom(['msg-1', 'msg-3']);
    const next = applyPollResult(prev, fetched);
    expect(next.messages.map(m => m.id)).toEqual(['msg-1', 'msg-3']);
  });

  it('results in an empty message list when the server returns no messages', () => {
    const prev    = makeRoom(['msg-1', 'msg-2']);
    const fetched = makeRoom([]);
    const next = applyPollResult(prev, fetched);
    expect(next.messages).toHaveLength(0);
  });

  it('returns the fetched object directly (full replacement, not a merge)', () => {
    const prev    = makeRoom(['msg-1']);
    const fetched = makeRoom(['msg-2', 'msg-3']);
    const next = applyPollResult(prev, fetched);
    // The returned value IS the fetched object — no old messages survive
    expect(next).toBe(fetched);
  });

  it('works correctly when prev is null (initial load)', () => {
    const fetched = makeRoom(['msg-1', 'msg-2']);
    const next = applyPollResult(null, fetched);
    expect(next.messages.map(m => m.id)).toEqual(['msg-1', 'msg-2']);
  });
});
