/**
 * Unit tests for useNavigationGuard.
 *
 * Strategy: mock every external dependency so the hook runs in pure Node.js
 * without a React DOM or native runtime.  usePreventRemove is mocked to
 * capture the callback it receives; we then drive the callback directly.
 *
 * vi.hoisted() is required so that variables referenced inside vi.mock()
 * factory functions are available before Vitest hoists those calls to the
 * top of the module.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Hoisted shared state (must precede vi.mock calls) ─────────────────────────

const {
  mockDispatch,
  mockAlertAlert,
  capturedState,
} = vi.hoisted(() => {
  return {
    mockDispatch:   vi.fn(),
    mockAlertAlert: vi.fn(),
    /** Mutable container so mock factories can write into it. */
    capturedState: {
      preventCallback: null as ((data: { data: { action: unknown } }) => void) | null,
      preventEnabled:  false,
    },
  };
});

// ── Module mocks ──────────────────────────────────────────────────────────────

// Minimal React hook stubs — enough for useRef / useCallback semantics.
vi.mock('react', () => ({
  useRef:      (initial: unknown) => ({ current: initial }),
  useCallback: (fn: (...args: unknown[]) => unknown) => fn,
}));

// Capture the callback and enabled flag passed to usePreventRemove.
vi.mock('@react-navigation/native', () => ({
  usePreventRemove: (enabled: boolean, cb: (data: { data: { action: unknown } }) => void) => {
    capturedState.preventEnabled  = enabled;
    capturedState.preventCallback = cb;
  },
}));

// Mock navigation dispatch.
vi.mock('expo-router', () => ({
  useNavigation: () => ({ dispatch: mockDispatch }),
}));

// Spy on Alert.alert.
vi.mock('react-native', () => ({
  Alert: { alert: mockAlertAlert },
}));

// ── Import after mocks ────────────────────────────────────────────────────────

import { useNavigationGuard } from '../useNavigationGuard';

// ── Helpers ───────────────────────────────────────────────────────────────────

function resetAll() {
  capturedState.preventCallback = null;
  capturedState.preventEnabled  = false;
  mockDispatch.mockReset();
  mockAlertAlert.mockReset();
}

// Prefixed with "use" so react-hooks/rules-of-hooks recognises it as a hook call site.
function useHookUnderTest(isDirty: boolean, onConfirmedDiscard?: () => void) {
  const markSaved = useNavigationGuard(isDirty, onConfirmedDiscard);
  return {
    markSaved,
    guardCallback: capturedState.preventCallback,
    guardEnabled:  capturedState.preventEnabled,
  };
}

const MOCK_ACTION = { type: 'GO_BACK' };
const MOCK_DATA   = { data: { action: MOCK_ACTION } };

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('useNavigationGuard — guard registration', () => {
  beforeEach(resetAll);

  it('registers usePreventRemove as disabled when the screen is clean', () => {
    useHookUnderTest(false);
    expect(capturedState.preventEnabled).toBe(false);
  });

  it('registers usePreventRemove as enabled when the screen is dirty', () => {
    useHookUnderTest(true);
    expect(capturedState.preventEnabled).toBe(true);
  });

  it('returns a markSaved function', () => {
    const { markSaved } = useHookUnderTest(true);
    expect(typeof markSaved).toBe('function');
  });
});

describe('useNavigationGuard — dirty screen: Alert behaviour', () => {
  beforeEach(resetAll);

  it('shows Alert.alert when a navigation removal is attempted on a dirty screen', () => {
    const { guardCallback } = useHookUnderTest(true);
    expect(guardCallback).not.toBeNull();

    guardCallback!(MOCK_DATA);

    expect(mockAlertAlert).toHaveBeenCalledOnce();
    expect(mockAlertAlert).toHaveBeenCalledWith(
      'Discard changes?',
      expect.any(String),
      expect.any(Array),
    );
  });

  it('Alert buttons include "Keep editing" (cancel) and "Discard" (destructive)', () => {
    const { guardCallback } = useHookUnderTest(true);
    guardCallback!(MOCK_DATA);

    const [, , buttons] = mockAlertAlert.mock.calls[0] as [
      string,
      string,
      Array<{ text: string; style?: string }>,
    ];
    const texts = buttons.map(b => b.text);
    expect(texts).toContain('Keep editing');
    expect(texts).toContain('Discard');

    const keepBtn    = buttons.find(b => b.text === 'Keep editing')!;
    const discardBtn = buttons.find(b => b.text === 'Discard')!;
    expect(keepBtn.style).toBe('cancel');
    expect(discardBtn.style).toBe('destructive');
  });

  it('"Keep editing" does NOT call navigation.dispatch', () => {
    const { guardCallback } = useHookUnderTest(true);
    guardCallback!(MOCK_DATA);

    const [, , buttons] = mockAlertAlert.mock.calls[0] as [
      string,
      string,
      Array<{ text: string; onPress?: () => void }>,
    ];
    buttons.find(b => b.text === 'Keep editing')?.onPress?.();

    expect(mockDispatch).not.toHaveBeenCalled();
  });

  it('"Discard" calls navigation.dispatch with the original action', () => {
    const { guardCallback } = useHookUnderTest(true);
    guardCallback!(MOCK_DATA);

    const [, , buttons] = mockAlertAlert.mock.calls[0] as [
      string,
      string,
      Array<{ text: string; onPress?: () => void }>,
    ];
    buttons.find(b => b.text === 'Discard')!.onPress!();

    expect(mockDispatch).toHaveBeenCalledOnce();
    expect(mockDispatch).toHaveBeenCalledWith(MOCK_ACTION);
  });

  it('"Discard" invokes the onConfirmedDiscard callback', () => {
    const onDiscard = vi.fn();
    const { guardCallback } = useHookUnderTest(true, onDiscard);
    guardCallback!(MOCK_DATA);

    const [, , buttons] = mockAlertAlert.mock.calls[0] as [
      string,
      string,
      Array<{ text: string; onPress?: () => void }>,
    ];
    buttons.find(b => b.text === 'Discard')!.onPress!();

    expect(onDiscard).toHaveBeenCalledOnce();
  });

  it('"Discard" does NOT throw when no onConfirmedDiscard is provided', () => {
    const { guardCallback } = useHookUnderTest(true);
    guardCallback!(MOCK_DATA);

    const [, , buttons] = mockAlertAlert.mock.calls[0] as [
      string,
      string,
      Array<{ text: string; onPress?: () => void }>,
    ];
    expect(() => buttons.find(b => b.text === 'Discard')!.onPress!()).not.toThrow();
  });
});

describe('useNavigationGuard — clean screen: guard bypassed', () => {
  beforeEach(resetAll);

  it('registers usePreventRemove as disabled so React Navigation never blocks removal', () => {
    // When the screen is clean, usePreventRemove receives enabled=false.
    // React Navigation will not invoke the callback at all, so no Alert fires.
    const { guardEnabled } = useHookUnderTest(false);
    expect(guardEnabled).toBe(false);
    expect(mockAlertAlert).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});

describe('useNavigationGuard — markSaved fast-path', () => {
  beforeEach(resetAll);

  it('lets navigation through immediately after markSaved() without showing an Alert', () => {
    // markSaved() and guardCallback both close over the same `confirmingRef`
    // object created by useRef(false) inside the hook.  Calling markSaved()
    // sets .current = true on that shared object so the next guardCallback
    // invocation dispatches directly instead of showing the alert.
    const { markSaved, guardCallback } = useHookUnderTest(true);

    markSaved();
    guardCallback!(MOCK_DATA);

    expect(mockAlertAlert).not.toHaveBeenCalled();
    expect(mockDispatch).toHaveBeenCalledWith(MOCK_ACTION);
  });

  it('registers guard as disabled when isDirty=false even after markSaved is called', () => {
    // markSaved() is meant to be called before a successful save navigation.
    // On a clean screen (isDirty=false), the guard is already disabled; calling
    // markSaved() is harmless and must not change the registered enabled state.
    const { markSaved, guardEnabled } = useHookUnderTest(false);
    markSaved();
    expect(guardEnabled).toBe(false);
    expect(mockAlertAlert).not.toHaveBeenCalled();
    expect(mockDispatch).not.toHaveBeenCalled();
  });
});
