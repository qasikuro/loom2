#!/usr/bin/env node
/**
 * Patches the local @expo/cli install to skip the interactive
 * "Log in / Proceed anonymously" prompt when running in Expo Go mode
 * on Replit (where there's no TTY for interactive input).
 *
 * This runs automatically via `postinstall` in package.json.
 * Safe to re-run — it's idempotent.
 */

const fs = require('fs');
const path = require('path');

// Expo can resolve a peer-specific CLI copy that is not the first one in
// pnpm's store. Inspect only the store's top-level package directories and
// patch every installed copy so `pnpm exec expo` cannot prompt interactively.
const cwd = path.resolve(__dirname, '..');
const storeRoots = [
  path.resolve(cwd, 'node_modules/.pnpm'),
  path.resolve(cwd, '../../node_modules/.pnpm'),
];
const fullPaths = new Set();

for (const storeRoot of storeRoots) {
  let entries;
  try {
    entries = fs.readdirSync(storeRoot, { withFileTypes: true });
  } catch (e) {
    continue;
  }
  for (const entry of entries) {
    if (!entry.isDirectory() || !entry.name.startsWith('@expo+cli@')) continue;
    const actionsPath = path.join(
      storeRoot,
      entry.name,
      'node_modules/@expo/cli/build/src/api/user/actions.js'
    );
    if (fs.existsSync(actionsPath)) fullPaths.add(actionsPath);
  }
}

if (fullPaths.size === 0) {
  console.log('[patch-expo-cli] Could not locate actions.js — skipping patch');
  process.exit(0);
}

let patchedCount = 0;
let alreadyPatchedCount = 0;
let unsupportedCount = 0;

for (const fullPath of fullPaths) {
  const content = fs.readFileSync(fullPath, 'utf8');

  if (content.includes('// Replit: skip interactive prompt')) {
    alreadyPatchedCount++;
    continue;
  }

  const lines = content.split('\n');
  let start = -1;
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('async function tryGetUserAsync()')) {
      start = i;
      break;
    }
  }

  if (start === -1) {
    unsupportedCount++;
    continue;
  }

  let depth = 0;
  let end = start;
  for (let i = start; i < lines.length; i++) {
    depth += (lines[i].match(/\{/g) || []).length;
    depth -= (lines[i].match(/\}/g) || []).length;
    if (i > start && depth === 0) {
      end = i;
      break;
    }
  }

  const newFunc = [
    'async function tryGetUserAsync() {',
    '    const user = await (0, _user.getUserAsync)().catch(()=>null);',
    '    if (user) { return user; }',
    '    // Replit: skip interactive prompt, always proceed anonymously',
    '    return null;',
    '}',
  ];

  lines.splice(start, end - start + 1, ...newFunc);
  fs.writeFileSync(fullPath, lines.join('\n'), 'utf8');
  patchedCount++;
}

console.log(
  `[patch-expo-cli] Patched ${patchedCount}; already patched ${alreadyPatchedCount}; unsupported ${unsupportedCount} of ${fullPaths.size} CLI copies`
);
