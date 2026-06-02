---
name: ClerkProvider must be unconditional + expo-notifications crash
description: Two interacting bugs that cause "useClerkSignal not within ClerkProvider" in Expo Go.
---

## Rule
In `app/_layout.tsx` for this Expo project:
1. `expo-notifications` must be lazy-required (never static imported)
2. `ClerkProvider` must be rendered unconditionally (never gated behind any boolean)

## Bug 1 — expo-notifications throws at import time (PRIMARY CAUSE)
`expo-notifications` throws at module initialisation in Expo Go SDK 53+ because Android push notifications were removed. A static `import * as Notifications from 'expo-notifications'` on line 8 crashes the module before `RootLayout` is defined → Expo Router logs "missing required default export" → ClerkProvider is never mounted → `useClerkSignal` throws.

**Fix:** Replace the static import with a try-catch lazy require:
```typescript
let Notifications: typeof import('expo-notifications') | null = null;
try { Notifications = require('expo-notifications'); } catch { /* Expo Go */ }
```
Then guard every usage: `if (Platform.OS !== 'web' && Notifications)` etc.

## Bug 2 — ClerkProvider conditionally rendered (SECONDARY CAUSE)
`@clerk/expo` v3 uses `@clerk/react` v6 internally, which introduced `useClerkSignal` — a signal-based context hook called by `useSignIn`, `useSSO`, `useAuth`. If ClerkProvider is wrapped in `{fontsReady && (...)}` and Expo Router renders a route before fonts load, the hooks fire outside the provider.

**Fix:** Render `ClerkProvider` unconditionally at the top of the JSX tree. Show a loading spinner inside it while fonts or Clerk are initialising.

**Why they interact:** Bug 1 causes the layout to fail entirely, making Bug 2 a red herring. Always check for "missing required default export" + module-level errors before chasing context errors.
