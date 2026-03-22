import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/security/**/*.test.ts'],
    testTimeout: 30_000,
  },
});
