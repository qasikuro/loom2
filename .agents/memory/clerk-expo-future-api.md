---
name: Clerk Expo Future API
description: Correct API for @clerk/expo v3.2.7 sign-in/sign-up flows — which methods exist and which do not
---

# Clerk Expo v3 Future API

## What useSignIn / useSignUp return
```ts
const { signIn, errors, fetchStatus } = useSignIn();  // SignInSignalValue
const { signUp, errors, fetchStatus } = useSignUp();  // SignUpSignalValue
```
- NO `setActive` or `isLoaded` from these hooks
- `fetchStatus === 'fetching'` replaces `isLoaded`

## SignInFutureResource methods
- `signIn.password({ emailAddress, password })` → `{ error }` — sets `signIn.status` and `signIn.createdSessionId`
- `signIn.finalize({ navigate?: SetActiveNavigate })` → `{ error }` — activates session
- `signIn.status` / `signIn.createdSessionId` — read after calling password()

## SignUpFutureResource methods
- `signUp.password({ emailAddress, password })` → `{ error }`
- `signUp.verifications.sendEmailCode()` — sends OTP
- `signUp.verifications.verifyEmailCode({ code })` — verifies OTP
- `signUp.finalize({ navigate?: SetActiveNavigate })` → `{ error }`
- `signUp.reset()` → `{ error }`
- `signUp.status`, `signUp.unverifiedFields`, `signUp.missingFields` — readable after password()

## CRITICAL: finalize() does NOT update useAuth()
`signIn.finalize()` and `signUp.finalize()` (Future API) only update signal-based state.
They do NOT update `useAuth().isSignedIn` or make `getToken()` return a valid JWT.
Always use `useClerk().setActive({ session: createdSessionId })` after email sign-in/sign-up
to properly activate the session through the traditional path.

**Why it matters:** The AuthTokenBridge in _layout.tsx checks `isSignedIn` from `useAuth()`.
If that stays false, every `apiFetch` call returns 401 — including all onboarding PUTs.

## Google SSO (useSSO)
```ts
const { startSSOFlow } = useSSO();
const { createdSessionId, setActive } = await startSSOFlow({
  strategy: 'oauth_google',
  redirectUrl: Linking.createURL('oauth-native-callback'),  // expo-linking, NOT react-native Linking
});
if (createdSessionId && setActive) {
  await setActive({ session: createdSessionId });  // NO navigate callback
  router.replace('/(tabs)');  // navigate manually after setActive resolves
}
```

**Why:**
- `react-native` Linking has no `createURL` method → runtime "undefined is not a function"
- Passing `navigate` callback to `setActive` causes Clerk to intercept navigation when `session.currentTask` is set, preventing the router.replace from ever firing

## Error access pattern
```ts
errors?.fields?.identifier?.message  // sign-in
errors?.fields?.emailAddress?.message  // sign-up
errors?.fields?.password?.message
errors?.fields?.code?.message
```
