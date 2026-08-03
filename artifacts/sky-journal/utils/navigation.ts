import { router } from 'expo-router';

/**
 * Safe wrapper around router.back().
 * When the screen is the root of the navigator (no history to pop),
 * falls back to the main tabs so the user is never stranded.
 */
export function safeBack(fallback = '/(tabs)' as const) {
  if (router.canGoBack()) {
    router.back();
  } else {
    router.replace(fallback);
  }
}
