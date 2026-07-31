---
name: Clerk Expo auth token in production APK
description: getToken() from useAuth() returns null in production APK even when isSignedIn=true; use useSession().session.getToken() as a dual-path fallback in AuthTokenBridge
---

## Rule
### Email/password auth
For email/password sign-in and sign-up in `@clerk/expo@3.2.7`, always import from `@clerk/expo/legacy`, NOT from `@clerk/expo` directly.

### getToken() in production APK — dual-path retrieval
`useAuth().getToken()` returns null in production APK even when `isSignedIn=true`. Root cause: in `@clerk/expo@3.2.7`, `isSignedIn` (via signals) can become `true` before `clerk.session` is populated — so `getToken()` hits a null session and returns null silently.

**Fix in `AuthTokenBridge`**: use BOTH `getToken()` AND `session?.getToken()` from `useSession()`:
```typescript
const { session } = useSession(); // from @clerk/expo
// in getter:
try { const t = await getToken(); if (t) return t; } catch {}
try { return await session?.getToken() ?? null; } catch { return null; }
// deps: [isLoaded, isSignedIn, getToken, session]
// No isSignedIn gate — just try, return null if both fail
```
This covers the window where `isSignedIn=true` but the SessionResource isn't yet available.

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

**Why:** `@clerk/expo` re-exports `useSignIn`/`useSignUp` from `@clerk/react` (Future API). These return `{signIn, errors, fetchStatus}` with no `setActive`. Using `useClerk().setActive` as a workaround bypasses the native SecureStore token cache (`@clerk/expo/token-cache`), so `getToken()` permanently returns null in production APKs → every API call returns 401. The `@clerk/expo/legacy` path re-exports from `@clerk/react/legacy` (traditional API), providing `{signIn, setActive, isLoaded}` where `setActive` correctly saves the session through the token cache.

**How to apply:** Any screen that does email/password auth must use the legacy import. SSO (`useSSO`) already handles this internally. The legacy API methods differ from Future API:
- `signIn.create({ identifier, password })` instead of `signIn.password({ emailAddress, password })`
- `signUp.create({ emailAddress, password })` instead of `signUp.password({ emailAddress, password })`
- `signUp.prepareEmailAddressVerification({ strategy: 'email_code' })` instead of `signUp.verifications.sendEmailCode()`
- `signUp.attemptEmailAddressVerification({ code })` instead of `signUp.verifications.verifyEmailCode({ code })`
- `SignUpResource` (legacy) has no `reset()` method — use `router.replace` to remount instead
- Loading state: use `useState` bool + `isLoaded` from hook (no `fetchStatus`)
- Errors come from `try/catch` — `err?.errors?.[0]?.longMessage` (no `errors.fields` on the hook)
