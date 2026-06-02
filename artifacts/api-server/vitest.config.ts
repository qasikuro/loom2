import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    pool:        'forks',
    singleFork:  true,
    testTimeout: 30_000,
    hookTimeout: 30_000,
    env: {
      LOG_LEVEL: 'silent',
      NODE_ENV:  'test',
    },
  },
});
