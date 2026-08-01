---
name: Clerk APK auth fix — proxy URL + publishableKeyFromHost
description: Root cause and fix for EAS APK Google Sign-In producing tokens the production server silently rejects (userId=null, no error).
---

## Root Cause

EAS APK builds hardcode `pk_test_*` in `eas.json`. Replit-managed Clerk auto-swaps
`CLERK_PUBLISHABLE_KEY` to `pk_live_*` in production deployments. Tokens issued by
the test Clerk instance cannot be verified with the live secret key (`sk_live_*`) the
server uses in production.

Clerk's `clerkMiddleware()` silently returns `userId: null, clerkStateErr: null` (no
exception) when JWT issuer doesn't match the expected instance — this is the diagnostic
signature.

**Why:** Replit-managed Clerk has completely separate user stores and signing keys for
dev (`pk_test_*` / `sk_test_*`) and production (`pk_live_*` / `sk_live_*`). EAS builds
run outside Replit's deployment context so the auto-swap never happens.

## Fix

1. **Server `app.ts`**: Use `publishableKeyFromHost` from `@clerk/shared/keys` in the
   `clerkMiddleware()` callback so the server resolves the correct key from the incoming
   request host (dev = test key, prod = live key).

2. **`eas.json`**: Add `EXPO_PUBLIC_CLERK_PROXY_URL: "https://<prod-domain>/api/__clerk"`
   to all EAS build profiles so the APK routes all Clerk requests through the production
   proxy. The proxy adds `Clerk-Secret-Key: sk_live_*`, so Clerk issues live-instance
   tokens even though the APK's `publishableKey` is `pk_test_*`.

3. **`CLERK_PROXY_URL=/api/__clerk` env var**: Set in shared env so `build.js`
   constructs the proxy URL for the Replit-served deployment.

## How to Apply

- After any `eas.json` change to the proxy URL, a new APK build is required.
- After any `app.ts` `clerkMiddleware` change, the server must be redeployed.
- Users must sign out and sign back in after this fix — cached test tokens are stale.
- CLERK-TRACE middleware can be removed from `app.ts` and `auth.ts` once fix is confirmed.
