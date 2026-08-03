import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals:     true,
    environment: 'node',
    include:     [
      'app/__tests__/**/*.test.ts',
      'context/__tests__/**/*.test.ts',
      'hooks/__tests__/**/*.test.ts',
    ],
  },
});
