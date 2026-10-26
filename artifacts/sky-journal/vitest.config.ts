import path from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    // Mirror tsconfig "@/*" so modules using the app alias load in tests.
    alias: [{ find: /^@\//, replacement: `${path.resolve(__dirname)}/` }],
  },
  test: {
    globals:     true,
    environment: 'node',
    include:     [
      'app/__tests__/**/*.test.ts',
      'context/__tests__/**/*.test.ts',
      'hooks/__tests__/**/*.test.ts',
      'utils/__tests__/**/*.test.ts',
    ],
  },
});
