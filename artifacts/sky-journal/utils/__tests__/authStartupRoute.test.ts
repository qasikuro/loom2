import { describe, expect, it } from 'vitest';
import { getAuthStartupRouteDecision } from '../authStartupRoute';

const base = {
  isLoaded: true,
  isSignedIn: true,
  pathname: '/',
  segments: ['(tabs)'],
  startupRouteChecked: false,
} as const;

describe('getAuthStartupRouteDecision', () => {
  it('waits for Expo Router to resolve a non-root deep link before consuming the startup check', () => {
    expect(getAuthStartupRouteDecision({
      ...base,
      pathname: '/profile',
      segments: [],
    })).toBe('waiting');
  });

  it('resolves a signed-in browser root even while route segments are temporarily empty', () => {
    expect(getAuthStartupRouteDecision({ ...base, segments: [] })).toBe('reels');
  });

  it('sends a signed-out browser root to sign-in when route segments are temporarily empty', () => {
    expect(getAuthStartupRouteDecision({
      ...base,
      isSignedIn: false,
      segments: [],
    })).toBe('sign-in');
  });

  it('marks the redirected root destination ready even if segments remain empty', () => {
    expect(getAuthStartupRouteDecision({
      ...base,
      pathname: '/sign-in',
      isSignedIn: false,
      segments: [],
      startupRouteChecked: true,
    })).toBe('ready');
  });

  it('routes a signed-in cold start from the root index to Reels', () => {
    expect(getAuthStartupRouteDecision(base)).toBe('reels');
  });

  it('does not redirect Home tab visits after the initial route check', () => {
    expect(getAuthStartupRouteDecision({ ...base, startupRouteChecked: true })).toBe('ready');
  });

  it('sends signed-out users away from the tabs group', () => {
    expect(getAuthStartupRouteDecision({
      ...base,
      isSignedIn: false,
      startupRouteChecked: true,
    })).toBe('sign-in');
  });

  it('sends signed-in users away from authentication screens', () => {
    expect(getAuthStartupRouteDecision({
      ...base,
      pathname: '/sign-in',
      segments: ['(auth)', 'sign-in'],
      startupRouteChecked: true,
    })).toBe('reels');
  });
});
