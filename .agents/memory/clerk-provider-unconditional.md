---
name: ClerkProvider must be unconditional in Expo
description: @clerk/expo v3 / @clerk/react v6 uses useClerkSignal internally; any conditional rendering of ClerkProvider causes a crash.
---

## Rule
`<ClerkProvider>` must be rendered unconditionally — never gated behind `fontsReady`, `isLoaded`, or any other boolean — in the Expo app's root layout.

**Why:** `@clerk/expo` v3.2.7 depends on `@clerk/react` v6.5.0 which introduced `useClerkSignal`, a signal-based context hook called internally by `useSignIn`, `useSSO`, `useAuth`, and other hooks. If `ClerkProvider` is not mounted when any of these hooks run, React throws: `@clerk/react: useClerkSignal can only be used within the <ClerkProvider /> component`. Expo Router can render route components (e.g. sign-in.tsx) before font loading or other async setup finishes, putting the hooks outside the provider tree.

**How to apply:**
- In `app/_layout.tsx`, render `<ClerkProvider>` as the outermost provider in `ThemedRoot`, before any async gate.
- Loading states (`fontsReady`, Clerk initialising) go INSIDE the ClerkProvider using `ClerkLoading`/`ClerkLoaded` and a ternary.
- The `AppSplashScreen` overlay covers the brief spinner while fonts load, so the user never sees it.
