---
name: Clerk Expo legacy setActive for email auth
description: useSignIn/useSignUp from @clerk/expo use the Future API (no setActive); must use @clerk/expo/legacy for email auth so setActive saves to the native token cache
---

## Rule
For email/password sign-in and sign-up in `@clerk/expo@3.2.7`, always import from `@clerk/expo/legacy`, NOT from `@clerk/expo` directly.

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
