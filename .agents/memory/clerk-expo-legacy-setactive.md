---
name: Clerk Expo auth token in production APK
description: getToken() from useAuth() returns null in production APK even when isSignedIn=true; use sessionRef pattern in AuthTokenBridge to fix stale closure; email auth requires @clerk/expo/legacy
---

## Rule

### Email/password auth
For email/password sign-in and sign-up in `@clerk/expo@3.2.7`, always import from `@clerk/expo/legacy`, NOT from `@clerk/expo` directly.

### getToken() in production APK — sessionRef pattern in AuthTokenBridge

`useAuth().getToken()` returns null in production APK even when `isSignedIn=true`. Root cause: in `@clerk/expo@3.2.7`, `isSignedIn` (via signals) can become `true` before `clerk.session` is populated — so `getToken()` hits a null session and returns null silently.

**Original attempted fix:** dual-path getter — try `getToken()`, fall back to `session?.getToken()` from `useSession()`. Session was added to effect deps so the getter re-registered when session became available.

**Problem with that approach:** `session` captured in the getter closure was stale (null) at the time the effect first ran. Even though the effect re-ran when `session` changed (populating `_getToken` with the new getter), there was a window where `waitForToken` polled the OLD getter. More importantly, for Google/OAuth flows where `session` arrives mid-`waitForToken`, the old getter (with `session=null`) keeps returning null until the effect re-runs.

**Correct fix — sessionRef pattern:**
```typescript
function AuthTokenBridge() {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const { session } = useSession();
  // Updated OUTSIDE useEffect on every render — never stale
  const sessionRef = useRef(session);
  sessionRef.current = session;
  ...
  useEffect(() => {
    if (!isLoaded) return;
    setAuthTokenGetter(async () => {
      try { const t = await getToken(); if (t) return t; } catch {}
      // sessionRef.current is always the latest session, no closure staleness
      try { return await sessionRef.current?.getToken() ?? null; } catch { return null; }
    });
    ...
  // session NOT in deps — sessionRef handles session changes reactively
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, isSignedIn, getToken]);
}
```

**Why:** `sessionRef.current = session` (outside useEffect) runs on every render synchronously. When React re-renders AuthTokenBridge because `session` became available after setActive(), `sessionRef.current` is immediately updated. The next `_getToken()` poll in `waitForToken()` reads `sessionRef.current?.getToken()` and gets a valid token — no effect re-run needed, no stale closure.

**Also:** Remove `session` from effect deps. This prevents spurious getter re-registrations on token rotation and prevents the effect from re-running when only `session` changes (which would have incorrectly prevented double-`reloadData()` calls via `prevSignedIn` tracking).

### Retry on token timeout in loadData()

Added `retry=true` parameter to `loadData()`. When `waitForToken(6000)` returns null:
- Show cached data, set `apiOnline=false`
- If `retry=true`: `setTimeout(() => loadData(false), 3000)` — one automatic retry
- The `finally` block resets `isLoadingRef.current=false` so the retry can proceed

**Why:** OAuth/Google setActive() can take longer than 6 seconds to write to SecureStore on a slow device. The retry gives the token cache write extra time to complete.

### Email/password auth (API methods)

```typescript
// CORRECT — same path useSSO uses internally
import { useSignIn } from '@clerk/expo/legacy';
import { useSignUp } from '@clerk/expo/legacy';
// Returns { signIn, setActive, isLoaded } — setActive saves to native SecureStore cache

// WRONG — Future API, no setActive, bypasses token cache
import { useSignIn, useSignUp } from '@clerk/expo';
// Returns { signIn, errors, fetchStatus } — no setActive
```

**Why:** `@clerk/expo` re-exports `useSignIn`/`useSignUp` from `@clerk/react` (Future API). These return `{signIn, errors, fetchStatus}` with no `setActive`. Using `useClerk().setActive` as a workaround bypasses the native SecureStore token cache (`@clerk/expo/token-cache`), so `getToken()` permanently returns null in production APKs → every API call returns 401. The `@clerk/expo/legacy` path provides `{signIn, setActive, isLoaded}` where `setActive` correctly saves the session through the token cache.

**How to apply:** Any screen that does email/password auth must use the legacy import. SSO (`useSSO`) does NOT handle this internally — `startSSOFlow` returns its own `setActive` that also bypasses the token cache. Always use the hook-level `setActive` (from `useSignIn()`/`useSignUp()` legacy) and **ignore** the `setActive` returned by `startSSOFlow`. The legacy API methods differ from Future API:
- `signIn.create({ identifier, password })` instead of `signIn.password({ emailAddress, password })`
- `signUp.create({ emailAddress, password })` instead of `signUp.password({ emailAddress, password })`
- `signUp.prepareEmailAddressVerification({ strategy: 'email_code' })` instead of `signUp.verifications.sendEmailCode()`
- `signUp.attemptEmailAddressVerification({ code })` instead of `signUp.verifications.verifyEmailCode({ code })`
- `SignUpResource` (legacy) has no `reset()` method — use `router.replace` to remount instead
- Loading state: use `useState` bool + `isLoaded` from hook (no `fetchStatus`)
- Errors come from `try/catch` — `err?.errors?.[0]?.longMessage` (no `errors.fields` on the hook)
