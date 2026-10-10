const assert = require('node:assert/strict');
const { test } = require('node:test');
const { createRequire } = require('node:module');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const root = path.resolve(__dirname, '..');
const api = createRequire(path.join(root, 'artifacts/api-server/package.json'));
const mobile = createRequire(path.join(root, 'artifacts/sky-journal/package.json'));
const proxy = createRequire(api.resolve('http-proxy-middleware'));
const micromatch = createRequire(proxy.resolve('micromatch'));
const braces = micromatch('braces');
const expo = createRequire(mobile.resolve('expo/package.json'));
const cli = createRequire(expo.resolve('@expo/cli/package.json'));
const forge = cli('node-forge');
const expoMetro = createRequire(cli.resolve('@expo/metro/package.json'));
const metro = createRequire(expoMetro.resolve('metro/package.json'));
const imageSizePath = metro.resolve('image-size');

test('authentication diagnostics do not log decoded JWT claims or session IDs', () => {
  const files = ['artifacts/api-server/src/app.ts', 'artifacts/api-server/src/middleware/auth.ts'];
  for (const file of files) {
    const source = fs.readFileSync(path.join(root, file), 'utf8');
    assert.doesNotMatch(source, /jwtPayload|jwtHeader|CLERK-TRACE/);
  }
});

test('braces preserves normal patterns and rejects deep patterns before stack exhaustion', () => {
  assert.deepEqual(braces.expand('a{b,c}d'), ['abd', 'acd']);
  assert.match(braces.compile('a{b,c}d'), /\(b\|c\)/);
  const pattern = '{'.repeat(4000) + 'x' + '}'.repeat(4000);
  for (const method of ['parse', 'compile', 'expand']) {
    assert.throws(() => braces[method](pattern), /safe depth limit/);
  }
});

test('braces AST entry points also have depth guards', () => {
  for (const method of ['compile', 'expand', 'stringify']) {
    const ast = { type: 'root', nodes: [] };
    ast.nodes.push(ast);
    assert.throws(() => braces[method](ast), /safe depth limit/);
  }
});

test('RSA accepts valid signatures but rejects extra nested DigestAlgorithm elements', () => {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 1024, e: 3 });
  const md = forge.md.sha256.create().update('security regression');
  const digest = md.digest().getBytes();
  assert.equal(keys.publicKey.verify(digest, keys.privateKey.sign(md)), true);
  const { asn1 } = forge;
  const primitive = (type, value) => asn1.create(asn1.Class.UNIVERSAL, type, false, value);
  const sequence = nodes => asn1.create(asn1.Class.UNIVERSAL, asn1.Type.SEQUENCE, true, nodes);
  const oid = () => primitive(asn1.Type.OID, asn1.oidToDer(forge.pki.oids.sha256).getBytes());
  const verify = elements => {
    const info = sequence([sequence(elements), primitive(asn1.Type.OCTETSTRING, digest)]);
    const signature = keys.privateKey.sign(asn1.toDer(info).getBytes(), 'NONE');
    return keys.publicKey.verify(digest, signature);
  };
  assert.equal(verify([oid()]), true); // Optional absent NULL stays supported.
  assert.throws(() => verify([
    oid(), primitive(asn1.Type.NULL, ''), primitive(asn1.Type.OCTETSTRING, 'garbage'),
  ]), /valid RSASSA/);
  assert.throws(() => verify([oid(), primitive(asn1.Type.NULL, 'garbage')]), /valid RSASSA/);
});

test('Metro uses the upgraded image-size API correctly for real image assets', async () => {
  const assets = metro('./src/Assets.js');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'storigam-image-test-'));
  try {
    const file = path.join(dir, 'pixel.png');
    fs.writeFileSync(file, Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aQp0AAAAASUVORK5CYII=',
      'base64',
    ));
    const data = await assets.getAssetData(file, 'pixel.png', [], null, '/assets');
    assert.equal(data.width, 1);
    assert.equal(data.height, 1);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('malformed zero-length ICNS boxes do not hang image parsing', () => {
  const result = spawnSync(process.execPath, ['-e', `
    const { imageSize } = require(${JSON.stringify(imageSizePath)});
    const b = Buffer.alloc(16);
    b.write('icns', 0); b.writeUInt32BE(16, 4); b.write('icp4', 8);
    try { imageSize(b); process.exit(2); } catch { process.exit(0); }
  `], { timeout: 3000 });
  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
});

test('UUID callers retain named v4/v5 APIs and reject invalid output bounds', () => {
  const storage = createRequire(api.resolve('@google-cloud/storage'));
  const uuid = storage('uuid');
  assert.match(uuid.v4(), /^[0-9a-f-]{36}$/);
  assert.equal(uuid.v5('test', uuid.v5.DNS), '4be0643f-1d98-573b-97cd-ca98a65347dd');
  assert.throws(() => uuid.v5('test', uuid.v5.DNS, new Uint8Array(8), 4), RangeError);
});
