const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const { test } = require('node:test');
const ts = require('typescript');

const appRoot = path.resolve(__dirname, '..');
const apiRoot = path.resolve(appRoot, '../api-server');
const platform = { OS: 'android' };

function load(file, requireModule = () => { throw new Error('Unexpected dependency'); }) {
  const module = { exports: {} };
  const output = ts.transpileModule(readFileSync(file, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.React, esModuleInterop: true,
    },
  });
  vm.runInNewContext(output.outputText, {
    module, exports: module.exports, require: requireModule,
  }, { filename: file });
  return module.exports;
}

const text = load(path.join(appRoot, 'components/PanelOverlayText.tsx'), name => {
  if (name === 'react') return require('react');
  if (name === 'react-native') return { Text: 'Text', Platform: platform };
  throw new Error(`Unexpected dependency: ${name}`);
});
const mappers = load(path.join(appRoot, 'context/mappers.ts'));
const { DraftStore } = load(path.join(appRoot, 'features/story-studio/utils/draftStore.ts'));
const formatted = {
  id: 'formatted', type: 'bubble', content: 'Hello world', xPct: 0.2, yPct: 0.3,
  fontFamily: 'serif', fontSize: 20, fontStyle: 'italic',
  textTransform: 'uppercase', textColor: '#F87171', color: '#F87171',
};

test('seven fonts have unique persisted keys and valid translations in every locale', () => {
  assert.equal(text.PANEL_FONT_OPTIONS.length, 7);
  assert.equal(new Set(text.PANEL_FONT_OPTIONS.map(option => option.key)).size, 7);
  const { studioEditorTranslations } = load(path.join(appRoot, 'i18n/studioEditorTranslations.ts'));
  for (const locale of Object.values(studioEditorTranslations)) {
    for (const option of [...text.PANEL_FONT_OPTIONS, ...text.PANEL_FONT_STYLES, ...text.PANEL_TEXT_CASES]) {
      assert.ok(locale.studioEditor[option.label], option.label);
    }
    assert.ok(locale.studioEditor.textColor);
  }
});

test('platform font names resolve without changing saved font keys', () => {
  assert.equal(text.resolvePanelFontFamily('serif'), 'serif');
  assert.equal(text.resolvePanelFontFamily('monospace'), 'monospace');
  platform.OS = 'ios';
  assert.equal(text.resolvePanelFontFamily('serif'), 'Georgia');
  assert.equal(text.resolvePanelFontFamily('monospace'), 'Courier');
  platform.OS = 'android';
});

test('legacy white bubble metadata remains dark while new choices are respected', () => {
  assert.equal(text.panelOverlayColor({ ...formatted, textColor: undefined, color: '#ffffff' }), '#1A1530');
  assert.equal(text.panelOverlayColor({ ...formatted, textColor: '#ffffff' }), '#ffffff');
  assert.equal(text.panelOverlayColor({ ...formatted, type: 'text', textColor: undefined, color: '#60A5FA' }), '#60A5FA');
  assert.equal(text.panelOverlayColor({ type: 'text' }), '#ffffff');
});

test('shared renderer uses all formatting and accepts reader-scaled sizes', () => {
  const rendered = text.PanelOverlayText({ overlay: formatted, fontSize: 12, style: { color: '#000' } });
  const style = rendered.props.style[1];
  assert.equal(style.fontFamily, 'serif');
  assert.equal(style.fontStyle, 'italic');
  assert.equal(style.textTransform, 'uppercase');
  assert.equal(style.color, '#F87171');
  assert.equal(style.fontSize, 12);
  assert.equal(rendered.props.children, 'Hello world');
});

test('API validation preserves styling and rejects invalid style values', () => {
  const source = readFileSync(path.join(apiRoot, 'src/routes/stories.ts'), 'utf8');
  const schemaSource = source.slice(source.indexOf('const OverlaySchema ='), source.indexOf('const PanelSchema ='));
  const z = require(require.resolve('zod', { paths: [apiRoot] })).z;
  const schema = vm.runInNewContext(`${schemaSource}\nOverlaySchema`, { z });
  assert.deepEqual(schema.parse(formatted), formatted);
  assert.equal(schema.safeParse({ ...formatted, fontStyle: 'broken' }).success, false);
  assert.equal(schema.safeParse({ ...formatted, textTransform: 'broken' }).success, false);
  assert.equal(schema.safeParse({ ...formatted, textColor: 'broken' }).success, false);
});

test('draft saving and reopened story/discovery mappings preserve formatting', () => {
  const panel = { id: 'panel', text: '', overlays: [formatted] };
  let saved;
  DraftStore.set({ panels: [panel], activePanelIndex: 0, onSave: panels => { saved = panels; } });
  DraftStore.updatePanel(0, { overlays: [{ ...formatted, fontFamily: 'Satoshi-Black' }] });
  DraftStore.save('1');
  const reopened = JSON.parse(JSON.stringify(saved));
  const raw = { id: 'story', date: '2026-10-04', mood: 'Hopeful', panels: reopened, pages: [{ id: 'page', layoutKey: '1', panels: reopened }] };
  for (const mapped of [mappers.toAppStory(raw), mappers.toRawDiscoverPost(raw)]) {
    assert.equal(mapped.panels[0].overlays[0].textColor, '#F87171');
    assert.equal(mapped.pages[0].panels[0].overlays[0].fontStyle, 'italic');
    assert.equal(mapped.pages[0].panels[0].overlays[0].textTransform, 'uppercase');
    assert.equal(mapped.pages[0].panels[0].overlays[0].fontFamily, 'Satoshi-Black');
  }
});