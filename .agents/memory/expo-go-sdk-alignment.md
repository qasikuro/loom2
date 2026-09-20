---
name: Expo Go SDK alignment
description: A project-specific Expo Go failure mode caused by native package versions drifting ahead of the installed Expo SDK.
---

When Expo Go reports a Java I/O error while downloading the remote update, first verify that every Expo native package matches the app's installed Expo SDK. A custom development build may still work while Expo Go fails because the custom build contains its own native module versions.

**Why:** Expo Go and Metro must agree on the SDK/native module contract; a mismatched package can fail during bundle loading before the application UI appears.

**How to apply:** Run `CI=1 pnpm exec expo install --check` from `artifacts/sky-journal`. If it reports mismatches, use `CI=1 pnpm exec expo install --fix`, restart the Expo workflow, and rerun the check before changing application code.