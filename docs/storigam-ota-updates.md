# Storigam over-the-air updates

## One-time activation

Install an Android APK built after OTA was enabled. Previously installed APKs
with updates disabled cannot receive this change over the air.

The replacement APK includes the compatible OAuth callback and the native
`expo-updates` module.

## Sending a later update

1. Sync and verify the intended JavaScript or asset changes on GitHub `main`.
2. In an environment already signed in to the Expo account for this app, run:

   ```sh
   node artifacts/sky-journal/scripts/update-production.js --message "Describe the update"
   ```

3. Confirm the command succeeds and inspect the EAS update it links to.

The command loads the same public API, Clerk, and callback configuration as
production native builds. It deliberately requires a release description.
Pushing a commit alone does not send an update to installed apps.

### Optional GitHub Actions publishing

The workflow definition is `.github/workflows/eas-update-production.yml`.
Installing it on GitHub requires permission to write workflow files, in addition
to ordinary repository content permission. Once installed, open **EAS Update —
Production**, choose **Run workflow** on `main`, and enter an update description.

That workflow runs the same publishing command using the existing GitHub
`EXPO_TOKEN` secret. Neither the command nor a native build needs a new secret.

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