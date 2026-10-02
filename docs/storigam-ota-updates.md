# Storigam over-the-air updates

## One-time activation

Install an Android APK built after OTA was enabled. Previously installed APKs
with updates disabled cannot receive this change over the air.

The replacement APK includes the compatible OAuth callback and the native
`expo-updates` module.

## Sending a later update

1. Sync and verify the intended JavaScript or asset changes on GitHub `main`.
2. Open the **EAS Update — Production** GitHub Actions workflow.
3. Choose **Run workflow** on `main` and provide a short update description.
4. Confirm the run succeeds and inspect the EAS update it links to.

The workflow uses the existing GitHub `EXPO_TOKEN` secret and loads the same
public API, Clerk, and callback configuration as production native builds.
Updates are manual; pushing a commit alone does not send it to installed apps.

## What users see

The app checks for compatible updates when it starts, downloads them in the
background, and applies a downloaded update on a later launch. It does not force
a restart during editing, messaging, or another active session. Offline startup
continues using the cached or embedded application.

## Compatibility and channels

- Production APKs and store releases use the `production` channel.
- Preview and development builds use separate channels.
- The `fingerprint` runtime policy prevents an update built for different native
  dependencies/configuration from being delivered to an incompatible app.
- Native-library, permission, or native-configuration changes require a new APK.
  JavaScript and assets can be updated without another APK when the runtime matches.

## Verification limits

Configuration and callback regression tests verify the setup locally. Actual
download/application of an EAS update must be verified on an OTA-enabled release
build; Expo Go is not a substitute for that native release check.