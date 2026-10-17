import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Exercise the connection lifecycle without requiring a native renderer.
const harness = vi.hoisted(() => ({
  focus: null as null | (() => (() => void) | undefined),
  token: vi.fn(),
  nativeFetch: vi.fn(),
  state: vi.fn(),
  platform: { OS: 'android' },
}));
vi.mock('react', () => ({
  useCallback: (callback: unknown) => callback,
  useEffect: () => {},
  useRef: (current: unknown) => ({ current }),
  useState: (initial: unknown) => [initial, harness.state],
}));
vi.mock('expo-router', () => ({
  useFocusEffect: (callback: () => (() => void) | undefined) => { harness.focus = callback; },
}));
vi.mock('react-native', () => ({
  Platform: harness.platform,
  AppState: { addEventListener: () => ({ remove: vi.fn() }) },
}));
vi.mock('expo/fetch', () => ({ fetch: harness.nativeFetch }));
vi.mock('@/context/AppContext', () => ({ getAuthToken: harness.token }));
vi.mock('@/utils/apiBase', () => ({ getApiBase: () => 'https://test.invalid/api' }));

import { useSSE } from '../useSSE';

const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const streamResponse = () => ({
  ok: true,
  body: { getReader: () => ({ read: () => new Promise(() => {}) }) },
});

describe('session live streaming lifecycle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    harness.platform.OS = 'android';
    harness.token.mockResolvedValue('development-test-token');
    harness.nativeFetch.mockResolvedValue(streamResponse());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(streamResponse()));
  });
  afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

  it('uses Expo streaming for native discussion, not the buffered global transport', async () => {
    useSSE(['campfire:room'], vi.fn(), true, true);
    const cleanup = harness.focus?.();
    await flush();
    expect(harness.nativeFetch).toHaveBeenCalledOnce();
    expect(fetch).not.toHaveBeenCalled();
    expect(harness.state).toHaveBeenCalledWith(true);
    cleanup?.();
    expect(harness.nativeFetch.mock.calls[0][1].signal.aborted).toBe(true);
  });
  it('keeps browser streaming on the browser fetch implementation', async () => {
    harness.platform.OS = 'web';
    useSSE(['campfire:room'], vi.fn(), true, true);
    const cleanup = harness.focus?.();
    await flush();
    expect(fetch).toHaveBeenCalledOnce();
    expect(harness.nativeFetch).not.toHaveBeenCalled();
    cleanup?.();
  });
  it('does not open a stale connection when authentication finishes after blur', async () => {
    let resolveToken!: (value: string) => void;
    harness.token.mockReturnValue(new Promise<string>(resolve => { resolveToken = resolve; }));
    useSSE(['campfire:room'], vi.fn(), true, true);
    const cleanup = harness.focus?.();
    cleanup?.();
    resolveToken('development-test-token');
    await flush();
    expect(harness.nativeFetch).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });
  it('delivers native events without waiting for the polling interval', async () => {
    const callback = vi.fn();
    const event = { channel: 'campfire:room', data: { type: 'new_message', message: { id: 'message-1' } } };
    const chunk = new TextEncoder().encode(`data: ${JSON.stringify(event)}\n\n`);
    const read = vi.fn().mockResolvedValueOnce({ done: false, value: chunk })
      .mockImplementation(() => new Promise(() => {}));
    harness.nativeFetch.mockResolvedValue({ ok: true, body: { getReader: () => ({ read }) } });
    useSSE(['campfire:room'], callback, true, true);
    const cleanup = harness.focus?.();
    await flush();
    expect(callback).toHaveBeenCalledWith(event.channel, event.data);
    expect(vi.getTimerCount()).toBe(0);
    cleanup?.();
  });
  it('does not reconnect after a pending connection is closed by tab switching', async () => {
    let resolveResponse!: (value: { ok: boolean; body: null }) => void;
    harness.nativeFetch.mockReturnValue(new Promise(resolve => { resolveResponse = resolve; }));
    useSSE(['campfire:room'], vi.fn(), true, true);
    const cleanup = harness.focus?.();
    await flush();
    cleanup?.();
    resolveResponse({ ok: false, body: null });
    await flush();
    expect(vi.getTimerCount()).toBe(0);
  });
});
