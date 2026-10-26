export type AuthStartupRouteDecision = 'waiting' | 'reels' | 'sign-in' | 'ready';

export function getAuthStartupRouteDecision({
  isLoaded,
  isSignedIn,
  pathname,
  segments,
  startupRouteChecked,
}: {
  isLoaded: boolean;
  isSignedIn: boolean;
  pathname: string;
  segments: readonly string[];
  startupRouteChecked: boolean;
}): AuthStartupRouteDecision {
  if (!isLoaded) return 'waiting';

  const firstSegment = segments[0];
  if (!startupRouteChecked && !firstSegment) return 'waiting';

  // On a cold start, "/" is the tabs index route. Move authenticated users to
  // Reels once; do not repeat this when they later choose the Home tab.
  if (!startupRouteChecked && isSignedIn && pathname === '/') return 'reels';
  if (isSignedIn && firstSegment === '(auth)') return 'reels';
  if (!isSignedIn && firstSegment === '(tabs)') return 'sign-in';

  return 'ready';
}
