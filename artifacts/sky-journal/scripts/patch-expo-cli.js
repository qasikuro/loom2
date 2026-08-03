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
const { execSync } = require('child_process');

// Find the actions.js file inside the pnpm store
let actionsFile;
try {
  actionsFile = execSync(
    'find node_modules/.pnpm -path "*/@expo/cli/build/src/api/user/actions.js" -not -path "*/node_modules/*/node_modules/*" 2>/dev/null | head -1',
    { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
  ).trim();
} catch (e) {
  // Fallback: search from workspace root
}

if (!actionsFile) {
  try {
    actionsFile = execSync(
      'find ../../node_modules/.pnpm -path "*/@expo/cli/build/src/api/user/actions.js" 2>/dev/null | head -1',
      { cwd: path.resolve(__dirname, '..'), encoding: 'utf8' }
    ).trim();
  } catch (e) {}
}

if (!actionsFile) {
  console.log('[patch-expo-cli] Could not locate actions.js — skipping patch');
  process.exit(0);
}

const fullPath = path.resolve(__dirname, '..', actionsFile);
if (!fs.existsSync(fullPath)) {
  console.log('[patch-expo-cli] File not found at', fullPath, '— skipping');
  process.exit(0);
}

const content = fs.readFileSync(fullPath, 'utf8');

// Already patched
if (content.includes('// Replit: skip interactive prompt')) {
  console.log('[patch-expo-cli] Already patched ✅');
  process.exit(0);
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
  console.log('[patch-expo-cli] tryGetUserAsync not found — skipping');
  process.exit(0);
}

// Find the closing brace of the function
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
console.log('[patch-expo-cli] Patched successfully ✅');
