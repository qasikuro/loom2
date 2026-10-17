const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const config = require('../app.json').expo;
const profiles = require('../eas.json').build;
const manifest = require('../package.json');
const { createProductionUpdateCommand } = require('./update-production');

test('guide screens ship with every API client export they import', () => {
  const root = path.resolve(__dirname, '../../..');
  const client = [
    'lib/api-client-react/src/generated/api.ts',
    'lib/api-client-react/src/generated/api.schemas.ts',
  ].map(file => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  const exported = new Set([...client.matchAll(/export\s+(?:async\s+)?(?:const|function|type|interface|class|enum)\s+(\w+)/g)].map(match => match[1]));
  const sources = [
    'app/guide', 'app/guide-session', 'app/guide-tutorial',
    'app/create-guide-session.tsx', 'app/create-guide-tutorial.tsx',
    'app/guide-tutorials.tsx', 'components/guide-session',
    'components/profile/GuideSessionsManagementSection.tsx',
  ];
  function check(file) {
    if (fs.statSync(file).isDirectory()) {
      for (const name of fs.readdirSync(file)) check(path.join(file, name));
      return;
    }
    if (!/\.[jt]sx?$/.test(file)) return;
    const source = fs.readFileSync(file, 'utf8');
    for (const match of source.matchAll(/import\s*\{([^}]+)\}\s*from\s*['"]@workspace\/api-client-react['"]/g)) {
      for (const item of match[1].split(',')) {
        const name = item.trim().replace(/^type\s+/, '').split(/\s+as\s+/)[0];
        if (name) assert.ok(exported.has(name), `${path.relative(root, file)} imports missing API export ${name}`);
      }
    }
  }
  for (const source of sources) check(path.resolve(__dirname, '..', source));
});

test('OTA is enabled for the existing Expo project', () => {
  assert.equal(config.updates.enabled, true);
  assert.equal(
    config.updates.url,
    `https://u.expo.dev/${config.extra.eas.projectId}`,
  );
  assert.ok(manifest.dependencies['expo-updates']);
  assert.equal(manifest.devDependencies['expo-updates'], undefined);
});

test('production EAS profiles retain the managed workflow override', () => {
  assert.equal(profiles.production.env.EXPO_UPDATES_WORKFLOW_OVERRIDE, 'managed');
  assert.equal(profiles['production-apk'].env.EXPO_UPDATES_WORKFLOW_OVERRIDE, 'managed');
});

test('OTA runtime version follows the app version', () => {
  assert.deepEqual(config.runtimeVersion, { policy: 'appVersion' });
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

test('manual OTA publishing uses the production build environment and channel', () => {
  const command = createProductionUpdateCommand(' Callback fix ', {
    EXPO_PUBLIC_API_URL: 'https://wrong.example/api',
    EXPO_PUBLIC_CLERK_REDIRECT_SCHEME: 'wrong-scheme',
    CI: 'true',
  });
  assert.deepEqual(command.args, [
    'exec', 'eas', 'update',
    '--channel', 'production',
    '--platform', 'all',
    '--message', 'Callback fix',
    '--non-interactive',
  ]);
  for (const [key, value] of Object.entries(profiles.production.env)) {
    assert.equal(command.env[key], value);
  }
  assert.equal(command.env.CI, 'true');
});

test('manual OTA publishing requires a nonempty release description', () => {
  for (const message of [undefined, '', '   ']) {
    assert.throws(() => createProductionUpdateCommand(message), /--message/);
  }
});