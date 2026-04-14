import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      exclude: ['node_modules/', 'dist/', 'client/'],
    },
  },
});
