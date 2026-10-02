import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const linking = vi.hoisted(() => ({
  createURL: vi.fn((path: string, options?: { scheme?: string }) =>
    options?.scheme ? `${options.scheme}://${path}` : `exp://example/${path}`,
  ),
}));
const runtime = vi.hoisted(() => ({
  constants: { executionEnvironment: 'storeClient' },
  platform: { OS: 'android' },
}));

vi.mock('expo-linking', () => linking);
vi.mock('expo-constants', () => ({
  default: runtime.constants,
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));
vi.mock('react-native', () => ({ Platform: runtime.platform }));

import { createOAuthRedirectUrl } from '../oauthRedirect';

describe('createOAuthRedirectUrl', () => {
  beforeEach(() => {
    linking.createURL.mockClear();
    vi.stubEnv('EXPO_PUBLIC_PHONE_DEV', '');
    vi.stubEnv('EXPO_PUBLIC_CLERK_REDIRECT_SCHEME', '');
    runtime.constants.executionEnvironment = 'storeClient';
    runtime.platform.OS = 'android';
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the installed legacy native scheme for phone development builds', () => {
    vi.stubEnv('EXPO_PUBLIC_PHONE_DEV', 'true');

    expect(createOAuthRedirectUrl()).toBe('sky-journal://oauth-native-callback');
    expect(linking.createURL).toHaveBeenCalledWith('oauth-native-callback', {
      scheme: 'sky-journal',
    });
  });

  it('uses the previously deployed callback scheme for production builds', () => {
    vi.stubEnv('EXPO_PUBLIC_CLERK_REDIRECT_SCHEME', 'sky-journal');

    expect(createOAuthRedirectUrl()).toBe('sky-journal://oauth-native-callback');
    expect(linking.createURL).toHaveBeenCalledWith('oauth-native-callback', {
      scheme: 'sky-journal',
    });
  });

  it.each([
    ['android', 'standalone'],
    ['ios', 'standalone'],
    ['android', 'bare'],
    ['ios', 'bare'],
  ])('preserves the compatible callback on %s %s without build env', (os, executionEnvironment) => {
    runtime.platform.OS = os;
    runtime.constants.executionEnvironment = executionEnvironment;

    expect(createOAuthRedirectUrl()).toBe('sky-journal://oauth-native-callback');
    expect(linking.createURL).toHaveBeenCalledWith('oauth-native-callback', {
      scheme: 'sky-journal',
    });
  });

  it('honors an explicitly configured callback scheme in native builds', () => {
    runtime.constants.executionEnvironment = 'standalone';
    vi.stubEnv('EXPO_PUBLIC_CLERK_REDIRECT_SCHEME', 'storigam');

    expect(createOAuthRedirectUrl()).toBe('storigam://oauth-native-callback');
  });

  it('keeps the normal Expo-generated redirect for Expo Go', () => {
    expect(createOAuthRedirectUrl()).toBe('exp://example/oauth-native-callback');
    expect(linking.createURL).toHaveBeenCalledWith('oauth-native-callback');
  });

  it('keeps browser redirect generation unchanged', () => {
    runtime.platform.OS = 'web';
    runtime.constants.executionEnvironment = 'bare';

    expect(createOAuthRedirectUrl()).toBe('exp://example/oauth-native-callback');
    expect(linking.createURL).toHaveBeenCalledWith('oauth-native-callback');
  });
});