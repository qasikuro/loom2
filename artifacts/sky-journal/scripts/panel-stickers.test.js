const assert = require('node:assert/strict');
const { readFileSync, readdirSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const appRoot = path.resolve(__dirname, '..');
const assetRoot = path.join(appRoot, 'assets/stickers');
const loadedAssets = [];

function loadModule(file, requireModule) {
  const module = { exports: {} };
  const output = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
    },
  });
  vm.runInNewContext(output.outputText, {
    module,
    exports: module.exports,
    require: requireModule,
  }, { filename: file });
  return module.exports;
}

const catalog = loadModule(path.join(assetRoot, 'index.ts'), filename => {
  assert.ok(filename.endsWith('.png'), `Unexpected dependency: ${filename}`);
  const assetPath = path.resolve(assetRoot, filename);
  const bytes = readFileSync(assetPath);
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  loadedAssets.push(path.basename(assetPath));
  // Metro assigns an asset number at bundle time; it is not a persistence key.
  return loadedAssets.length;
});

const { PanelSticker } = loadModule(
  path.join(appRoot, 'components/PanelSticker.tsx'),
  name => {
    if (name === 'react') return require('react');
    if (name === 'expo-image') return { Image: 'Image' };
    if (name === 'react-native') return { Text: 'Text' };
    if (name === '@/assets/stickers') return catalog;
    throw new Error(`Unexpected component dependency: ${name}`);
  },
);

test('all 32 supplied PNG stickers are bundled once with unique persistence keys', () => {
  assert.equal(catalog.STORIGAM_STICKERS.length, 32);
  assert.equal(new Set(catalog.STORIGAM_STICKERS.map(sticker => sticker.id)).size, 32);
  assert.equal(new Set(loadedAssets).size, 32);
  assert.deepEqual(
    loadedAssets.slice().sort(),
    readdirSync(assetRoot).filter(name => name.endsWith('.png')).sort(),
  );
});

test('a saved and reopened overlay resolves the same artwork by its string ID', () => {
  for (const sticker of catalog.STORIGAM_STICKERS) {
    const saved = JSON.parse(JSON.stringify({
      type: 'sticker', content: sticker.id, xPct: 0.2, yPct: 0.3, fontSize: 48,
    }));
    assert.equal(typeof saved.content, 'string');
    assert.equal(catalog.getStorigamSticker(saved.content), sticker);
  }
});

test('new sticker overlays render the supplied asset and honor image sizing', () => {
  const sticker = catalog.STORIGAM_STICKERS[0];
  const element = PanelSticker({ content: sticker.id, size: 48, imageSize: 72 });
  assert.equal(element.type, 'Image');
  assert.equal(element.props.source, sticker.source);
  assert.equal(element.props.contentFit, 'contain');
  assert.equal(element.props.style.width, 72);
  assert.equal(element.props.style.height, 72);
});

test('legacy emoji stickers remain readable instead of being replaced', () => {
  assert.equal(catalog.getStorigamSticker('✨'), undefined);
  const element = PanelSticker({ content: '✨', size: 30 });
  assert.equal(element.type, 'Text');
  assert.equal(element.props.children, '✨');
  assert.equal(element.props.style.fontSize, 30);
});