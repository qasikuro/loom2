---
name: HMR resets _getToken → 401 on writes
description: Expo Go Fast Refresh re-evaluates AppContext.tsx but may not re-run the useEffect in _layout.tsx that calls setAuthTokenGetter — leaving _getToken as the no-op null getter, so PUT/POST requests silently get 401 and data is never saved to DB.
---

## The Rule
Use `globalThis` (not a plain `let` variable) as the backing store for `_getToken` in AppContext.tsx.

**Why:** Expo Go HMR re-evaluates module code on every hot-reload, resetting `let _getToken = async () => null`. The `useEffect` in `_layout.tsx` that calls `setAuthTokenGetter` has deps `[isLoaded, isSignedIn, getToken]` — if those don't change, the effect does NOT re-fire, so `_getToken` stays null. All subsequent PUT/POST calls have no auth header → server returns 401 → `.catch()` fires a toast → user dismisses → mutation never queued → data silently lost.

**How to apply:** The fix is already in place — `_TOKEN_GETTER_KEY` on `globalThis` persists across HMR. Any change to the token-getter pattern must preserve this globalThis-based storage.

## Corollary: Auto-queue mutations, don't require toast tap
Profile/character save failures should automatically retry once and then call `enqueueMutation()` — never rely on the user tapping a toast to trigger the retry queue. A tap-gated retry means data is permanently lost if the user doesn't notice the toast.
