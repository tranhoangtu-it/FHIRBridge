import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/perf/**/*.test.ts'],
    testTimeout: 120_000,
  },
});
