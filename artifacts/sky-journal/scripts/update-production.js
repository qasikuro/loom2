const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { parseArgs } = require('node:util');
const profile = require('../eas.json').build.production;

function createProductionUpdateCommand(message, environment = {}) {
  if (typeof message !== 'string' || !message.trim()) {
    throw new Error('Provide a release description with --message.');
  }

  return {
    args: [
      'exec', 'eas', 'update',
      '--channel', profile.channel,
      '--platform', 'all',
      '--message', message.trim(),
      '--non-interactive',
    ],
    env: { ...environment, ...profile.env },
  };
}

if (require.main === module) {
  try {
    const { values } = parseArgs({
      options: { message: { type: 'string' } },
      allowPositionals: false,
    });
    const command = createProductionUpdateCommand(values.message, process.env);
    const result = spawnSync('pnpm', command.args, {
      cwd: path.resolve(__dirname, '..'),
      env: command.env,
      stdio: 'inherit',
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}

module.exports = { createProductionUpdateCommand };