---
name: Expo Go on Replit setup
description: How to get Expo Go working on Replit when expo-dev-client is installed; covers the --go flag, CLI patch, and compilation timing.
---

## Problem
Once `expo-dev-client` is installed, Metro defaults to dev-client mode (`exp+sky-journal://expo-development-client/...` URL) which only opens in the custom APK, not Expo Go. Expo Go needs `exp://...` URLs and the classic startup path.

## Fixes applied

### 1. `--go` flag in dev script
Add `--go` to the `expo start` command in `package.json`:
```
pnpm exec expo start --localhost --port $PORT --go
```
Metro then says "Using Expo Go" and serves `exp://` URLs.

### 2. Login prompt bypass
With `--go` and an EAS `projectId` present, Metro shows an interactive "Log in / Proceed anonymously" prompt that blocks startup on Replit (no TTY). Fix by patching `@expo/cli/build/src/api/user/actions.js` — the `tryGetUserAsync` function — to return `null` immediately when no user session exists, skipping the prompt.

Script: `artifacts/sky-journal/scripts/patch-expo-cli.js`  
Wired via `"postinstall": "node scripts/patch-expo-cli.js"` in package.json so it re-applies after every `pnpm install`.

### 3. React Compiler disabled in dev
`"reactCompiler": false` in `app.json experiments` — significantly speeds up bundle compilation (still slow on Replit but less slow).

### 4. Bundle compilation time
First bundle compilation takes 10+ minutes on Replit's shared compute. Expo Go has a ~30-60s download timeout. Pre-warming via `curl` in the background triggers Metro to compile and cache the bundle — subsequent Expo Go connections then download the cached bundle quickly.

Pre-warm URL:
```
http://localhost:20450/index.bundle?platform=android&dev=true&hot=false&transform.routerRoot=app
```

**Why:** Replit's shared CPU is too slow to compile the full bundle within Expo Go's download timeout on first request. Pre-warming eliminates the timeout.

**How to apply:** After each Metro restart (e.g. after code changes that require restart), run the pre-warm curl before telling the user to scan the QR code.

## APK builds unaffected
The `--go` flag only changes the local dev server mode. EAS Build (`eas build`) is independent and uses the project config + slug/owner to identify the project — not the dev server mode. APK builds continue to work normally.

## Authenticated preview screenshots
The Replit screenshot browser may not carry a Clerk session. Protected Expo routes can remain on the Ximo splash screen even when Metro has bundled the app successfully.

**Why:** The screenshot browser is separate from the user's signed-in app session and reports Clerk's `dev-browser-missing` state.

**How to apply:** Check Metro and typecheck results before treating a splash-only screenshot as a code failure. Verify protected screens in a signed-in session.
