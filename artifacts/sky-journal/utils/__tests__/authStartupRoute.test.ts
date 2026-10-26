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
  it('waits for Expo Router to resolve the initial route instead of consuming the startup check early', () => {
    expect(getAuthStartupRouteDecision({ ...base, segments: [] })).toBe('waiting');
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
