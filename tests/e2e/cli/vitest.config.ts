import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    name: 'cli-e2e',
    // Pattern relative to this config file's directory
    include: ['./**/*.spec.ts'],
    testTimeout: 30_000,
    hookTimeout: 15_000,
  },
});
