import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const expoConfig = vi.hoisted(() => ({ legacyUrl: '' }));

vi.mock('expo-constants', () => ({
  default: {
    get expoConfig() {
      return { extra: { apiUrl: expoConfig.legacyUrl } };
    },
  },
}));

import { getApiBase, getApiOrigin } from '../apiBase';

describe('getApiBase phone tunnel override', () => {
  beforeEach(() => {
    expoConfig.legacyUrl = 'https://embedded.example/api';
    vi.stubEnv('EXPO_PUBLIC_PHONE_DEV', '');
    vi.stubEnv('EXPO_PUBLIC_API_URL', '');
    vi.stubEnv('EXPO_PUBLIC_DOMAIN', '');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses the phone tunnel API URL ahead of a legacy embedded URL only in phone mode', () => {
    vi.stubEnv('EXPO_PUBLIC_PHONE_DEV', 'true');
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://fresh.trycloudflare.com/api/');
    expect(getApiBase()).toBe('https://fresh.trycloudflare.com/api');
  });

  it('retains the legacy URL precedence when phone mode is disabled', () => {
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://published.example/api');
    expect(getApiBase()).toBe('https://embedded.example/api');
  });

  it('uses the public API URL when no legacy value is configured', () => {
    expoConfig.legacyUrl = '';
    vi.stubEnv('EXPO_PUBLIC_API_URL', 'https://published.example/api/');
    expect(getApiBase()).toBe('https://published.example/api');
  });

  it('retains the domain-based fallback when no API URL is configured', () => {
    expoConfig.legacyUrl = '';
    vi.stubEnv('EXPO_PUBLIC_DOMAIN', 'published.example');
    expect(getApiBase()).toBe('https://published.example/api');
  });

  it('gives generated API routes the origin root rather than a duplicate /api prefix', () => {
    expect(getApiOrigin('https://published.example/api')).toBe('https://published.example');
    expect(getApiOrigin('https://phone-tunnel.example/api/', 'unused.example')).toBe('https://phone-tunnel.example');
  });

  it('uses the configured app domain when the API base is relative', () => {
    expect(getApiOrigin('/api', 'published.example')).toBe('https://published.example');
    expect(getApiOrigin('/api', undefined)).toBeNull();
  });
});