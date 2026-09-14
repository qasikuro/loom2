/**
 * Unit tests for resolveNotificationRoute — the pure routing helper extracted
 * from NotificationDeepLinkHandler in _layout.tsx.
 *
 * Strategy: pass a vi.fn() as the `push` sink and assert what it was called
 * with.  No React, no native runtime required.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Module mocks (must precede the import) ────────────────────────────────────

// _layout.tsx imports several React-Native / Expo modules at the top level.
// Mock them so the module can be loaded in a pure Node environment.

vi.mock('@/polyfills', () => ({}));
vi.mock('@/i18n', () => ({}));

vi.mock('@clerk/expo', () => ({
  ClerkLoaded:   ({ children }: { children: unknown }) => children,
  ClerkLoading:  ({ children }: { children: unknown }) => children,
  ClerkProvider: ({ children }: { children: unknown }) => children,
  useAuth:    () => ({}),
  useSession: () => ({}),
  tokenCache: {},
}));
vi.mock('@clerk/expo/token-cache', () => ({ tokenCache: {} }));

vi.mock('expo-constants', () => ({ default: { expoConfig: {} } }));
vi.mock('expo-font', () => ({ loadAsync: vi.fn() }));
vi.mock('@tanstack/react-query', () => ({
  QueryClient:         class {},
  QueryClientProvider: ({ children }: { children: unknown }) => children,
}));
vi.mock('expo-router', () => ({
  Redirect:    () => null,
  Stack:       Object.assign(() => null, { Screen: () => null }),
  useRouter:   () => ({ push: vi.fn() }),
  useSegments: () => [],
}));
vi.mock('expo-splash-screen', () => ({ preventAutoHideAsync: vi.fn(), hideAsync: vi.fn() }));
vi.mock('react', async (importOriginal) => {
  // Keep real React so useCallback / useEffect work, but avoid DOM renderer.
  const real = await importOriginal<typeof import('react')>();
  return real;
});
vi.mock('react-native', () => ({
  Platform:         { OS: 'ios' },
  View:             ({ children }: { children: unknown }) => children,
  ActivityIndicator: () => null,
}));
vi.mock('react-native-gesture-handler', () => ({
  GestureHandlerRootView: ({ children }: { children: unknown }) => children,
}));
vi.mock('react-native-safe-area-context', () => ({
  SafeAreaProvider: ({ children }: { children: unknown }) => children,
}));

vi.mock('@/components/AppSplashScreen', () => ({ AppSplashScreen: () => null }));
vi.mock('@/components/SkyLoading',      () => ({ SkyLoadingOverlay: () => null }));
vi.mock('@/components/XPFlash',         () => ({ XPFlash: () => null }));
vi.mock('@/components/ErrorBoundary',   () => ({ ErrorBoundary: ({ children }: { children: unknown }) => children }));
vi.mock('@/components/Toast',           () => ({ ToastProvider: ({ children }: { children: unknown }) => children }));
vi.mock('@/components/OnboardingOverlay', () => ({
  OnboardingOverlay:      () => null,
  hasCompletedOnboarding: vi.fn(),
  markOnboardingDone:     vi.fn(),
}));
vi.mock('@/context/AppContext', () => ({
  AppProvider:      ({ children }: { children: unknown }) => children,
  setAuthTokenGetter: vi.fn(),
  useApp:           () => ({ character: {}, setCharacter: vi.fn(), reloadData: vi.fn(), clearUserData: vi.fn() }),
  apiFetch:         vi.fn(),
  getAuthToken:     vi.fn(),
}));
vi.mock('@/context/ThemeContext', () => ({
  ThemeProvider: ({ children }: { children: unknown }) => children,
  useTheme:      () => ({ isDark: false }),
}));
vi.mock('@/context/SoundContext', () => ({
  SoundProvider: ({ children }: { children: unknown }) => children,
}));

// expo-notifications: not available in this test environment
vi.mock('expo-notifications', () => ({}));

// ── Import the function under test ────────────────────────────────────────────

import { resolveNotificationRoute } from '../_layout';

// ── Helpers ───────────────────────────────────────────────────────────────────

function makePush() {
  return vi.fn<(href: string) => void>();
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('resolveNotificationRoute — data.url present (deep link takes priority)', () => {
  let push: ReturnType<typeof makePush>;
  beforeEach(() => { push = makePush(); });

  it('pushes the exact url when data.url is a non-empty string', () => {
    resolveNotificationRoute(push, { url: '/(tabs)/season' });
    expect(push).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith('/(tabs)/season');
  });

  it('pushes a story url correctly', () => {
    resolveNotificationRoute(push, { url: '/story/abc123' });
    expect(push).toHaveBeenCalledWith('/story/abc123');
  });

  it('pushes an arbitrary deep-link url without modification', () => {
    resolveNotificationRoute(push, { url: '/campfire/room-42' });
    expect(push).toHaveBeenCalledWith('/campfire/room-42');
  });

  it('does NOT call push for an empty url string', () => {
    resolveNotificationRoute(push, { url: '' });
    expect(push).not.toHaveBeenCalled();
  });

  it('does NOT call push when url is not a string', () => {
    resolveNotificationRoute(push, { url: 42 });
    expect(push).not.toHaveBeenCalled();
  });

  it('ignores data.type when data.url is present and non-empty', () => {
    // url takes priority — type-based routing must not fire
    resolveNotificationRoute(push, { url: '/(tabs)/season', type: 'follow', refId: 'user1' });
    expect(push).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith('/(tabs)/season');
  });
});

describe('resolveNotificationRoute — type-based routing (no data.url)', () => {
  let push: ReturnType<typeof makePush>;
  beforeEach(() => { push = makePush(); });

  it('routes "follow" notification to /user/<refId>', () => {
    resolveNotificationRoute(push, { type: 'follow', refId: 'user99' });
    expect(push).toHaveBeenCalledWith('/user/user99');
  });

  it('routes "witness" notification to /story/<refId>', () => {
    resolveNotificationRoute(push, { type: 'witness', refId: 'story-x' });
    expect(push).toHaveBeenCalledWith('/story/story-x');
  });

  it('routes "save" notification to /story/<refId>', () => {
    resolveNotificationRoute(push, { type: 'save', refId: 'story-y' });
    expect(push).toHaveBeenCalledWith('/story/story-y');
  });

  it('routes "new_story" notification to /story/<refId>', () => {
    resolveNotificationRoute(push, { type: 'new_story', refId: 'story-z' });
    expect(push).toHaveBeenCalledWith('/story/story-z');
  });

  it('routes "new_chapter" notification to /book-public with bookId param', () => {
    resolveNotificationRoute(push, { type: 'new_chapter', refId: 'book-uuid-1' });
    expect(push).toHaveBeenCalledOnce();
    expect(push).toHaveBeenCalledWith({ pathname: '/book-public', params: { bookId: 'book-uuid-1' } });
  });

  it('does NOT push for "new_chapter" when refId is absent', () => {
    resolveNotificationRoute(push, { type: 'new_chapter' });
    expect(push).not.toHaveBeenCalled();
  });

  it('routes "message" notification to /messages/<refId>', () => {
    resolveNotificationRoute(push, { type: 'message', refId: 'thread-5' });
    expect(push).toHaveBeenCalledWith('/messages/thread-5');
  });

  it('does NOT push for "follow" when refId is absent', () => {
    resolveNotificationRoute(push, { type: 'follow' });
    expect(push).not.toHaveBeenCalled();
  });

  it('does NOT push for "witness" when refId is absent', () => {
    resolveNotificationRoute(push, { type: 'witness' });
    expect(push).not.toHaveBeenCalled();
  });

  it('does NOT push for "message" when refId is absent', () => {
    resolveNotificationRoute(push, { type: 'message' });
    expect(push).not.toHaveBeenCalled();
  });

  it('does nothing for an unknown type', () => {
    resolveNotificationRoute(push, { type: 'unknown_event', refId: 'abc' });
    expect(push).not.toHaveBeenCalled();
  });
});

describe('resolveNotificationRoute — fallback: no url and no type', () => {
  let push: ReturnType<typeof makePush>;
  beforeEach(() => { push = makePush(); });

  it('does nothing when data is an empty object', () => {
    resolveNotificationRoute(push, {});
    expect(push).not.toHaveBeenCalled();
  });

  it('does nothing when data has only unrecognised keys', () => {
    resolveNotificationRoute(push, { foo: 'bar', baz: 123 });
    expect(push).not.toHaveBeenCalled();
  });

  it('does nothing when type is null', () => {
    resolveNotificationRoute(push, { type: null });
    expect(push).not.toHaveBeenCalled();
  });
});
