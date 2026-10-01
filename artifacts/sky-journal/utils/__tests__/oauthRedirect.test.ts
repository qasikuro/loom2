import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const linking = vi.hoisted(() => ({
  createURL: vi.fn((path: string, options?: { scheme?: string }) =>
    options?.scheme ? `${options.scheme}://${path}` : `exp://example/${path}`,
  ),
}));

vi.mock('expo-linking', () => linking);

import { createOAuthRedirectUrl } from '../oauthRedirect';

describe('createOAuthRedirectUrl', () => {
  beforeEach(() => {
    linking.createURL.mockClear();
    vi.stubEnv('EXPO_PUBLIC_PHONE_DEV', '');
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

  it('keeps the normal Expo-generated redirect for all other environments', () => {
    expect(createOAuthRedirectUrl()).toBe('exp://example/oauth-native-callback');
    expect(linking.createURL).toHaveBeenCalledWith('oauth-native-callback');
  });
});