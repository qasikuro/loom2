const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { test } = require('node:test');

const root = path.resolve(__dirname, '..');
const source = fs.readFileSync(path.join(root, 'components/Icon.tsx'), 'utf8');
const names = new Set([...source.matchAll(/^\s*'([^']+)'\s*:/gm)].map(match => match[1]));

test('all literal Icon names used by app screens have a rendering', () => {
  const missing = [];
  function check(dir) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const file = path.join(dir, entry.name);
      if (entry.isDirectory()) check(file);
      else if (entry.name.endsWith('.tsx')) {
        const text = fs.readFileSync(file, 'utf8');
        for (const match of text.matchAll(/<Icon\b[^>]*?\bname\s*=\s*["']([^"']+)["']/gs)) {
          if (!names.has(match[1])) missing.push(`${path.relative(root, file)}: ${match[1]}`);
        }
      }
    }
  }
  check(path.join(root, 'app'));
  check(path.join(root, 'components'));
  assert.deepEqual(missing, []);
});

test('settings artwork references exist and are nonempty PNGs', () => {
  const file = path.join(root, 'components/profile/SettingsArtworkIcon.tsx');
  const text = fs.readFileSync(file, 'utf8');
  const assets = [...text.matchAll(/require\('([^']+\.png)'\)/g)];
  assert.equal(assets.length, 19);
  for (const [, asset] of assets) {
    const bytes = fs.readFileSync(path.resolve(path.dirname(file), asset));
    assert.equal(bytes.subarray(1, 4).toString(), 'PNG');
    assert.ok(bytes.length > 100);
  }
});
