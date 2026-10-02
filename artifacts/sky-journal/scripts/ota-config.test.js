const assert = require('node:assert/strict');
const { test } = require('node:test');
const config = require('../app.json').expo;
const profiles = require('../eas.json').build;
const manifest = require('../package.json');

test('OTA is enabled for the existing Expo project', () => {
  assert.equal(config.updates.enabled, true);
  assert.equal(
    config.updates.url,
    `https://u.expo.dev/${config.extra.eas.projectId}`,
  );
  assert.ok(manifest.devDependencies['expo-updates'] || manifest.dependencies['expo-updates']);
});

test('native fingerprint protects against incompatible updates', () => {
  assert.deepEqual(config.runtimeVersion, { policy: 'fingerprint' });
  assert.notEqual(config.updates.disableAntiBrickingMeasures, true);
});

test('updates download on launch without blocking offline or cached startup', () => {
  assert.equal(config.updates.checkAutomatically, 'ON_LOAD');
  assert.equal(config.updates.fallbackToCacheTimeout, 0);
});

test('production APK and store release receive the same update channel and environment', () => {
  assert.equal(profiles.production.channel, 'production');
  assert.equal(profiles['production-apk'].channel, 'production');
  assert.deepEqual(profiles.production.env, profiles['production-apk'].env);
  assert.equal(profiles.preview.channel, 'preview');
  assert.equal(profiles.development.channel, 'development');
});

test('native builds retain the compatible OAuth scheme', () => {
  const schemes = Array.isArray(config.scheme) ? config.scheme : [config.scheme];
  for (const name of ['production', 'production-apk']) {
    assert.equal(profiles[name].env.EXPO_PUBLIC_CLERK_REDIRECT_SCHEME, 'sky-journal');
    assert.ok(schemes.includes(profiles[name].env.EXPO_PUBLIC_CLERK_REDIRECT_SCHEME));
  }
});