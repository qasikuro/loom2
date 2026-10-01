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

### Pre-warm failure after workflow restart

On 2026-10-01, the documented localhost URL returned HTTP 404 with `UnableToResolveError` for `./index` under `/home/runner/workspace`, even though the managed Expo workflow had started from `artifacts/sky-journal`.

**Why:** The cached pre-warm URL can stop matching Metro's current entry resolution in this monorepo; a 404 is not a successful warm-up.

**How to apply:** Check the HTTP status and response before treating a restart as pre-warmed. If Metro resolves `./index` from the workspace root, do not keep retrying the same URL or change app entry code to hide it; inspect the current Expo entry URL or let the device request the bundle.

## APK builds unaffected
The `--go` flag only changes the local dev server mode. EAS Build (`eas build`) is independent and uses the project config + slug/owner to identify the project — not the dev server mode. APK builds continue to work normally.

## Authenticated preview screenshots
The Replit screenshot browser may not carry a Clerk session. Protected Expo routes can remain on the Ximo splash screen even when Metro has bundled the app successfully.

**Why:** The screenshot browser is separate from the user's signed-in app session and reports Clerk's `dev-browser-missing` state.

**How to apply:** Check Metro and typecheck results before treating a splash-only screenshot as a code failure. Verify protected screens in a signed-in session.

### Phone-only hostname failures

When Android reports that it cannot resolve the Expo host, compare the hostname in the current workflow QR with the landing page's copied address. Then check that hostname using a public DNS resolver and request the Android manifest and its exact launch-asset URL through the public edge. If those succeed while the phone still reports a lookup failure, the remaining fault is on that phone's DNS/network path, before the app's JavaScript starts. Do not diagnose it as an app bundle error.

**Why:** The Replit workspace may resolve a preview domain through internal routing that a physical phone does not use; a workspace-only request does not prove public-device reachability.

**How to apply:** Confirm public DNS and the manifest/bundle first. If they work, direct the user to scan the current QR in the official Expo Go app and check another network, VPN, or Private DNS on the device. Never use `localhost:8081` as a remote phone address.
