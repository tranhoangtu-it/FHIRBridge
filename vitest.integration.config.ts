import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

/**
 * Integration test runner config.
 * Runs only tests/integration/**\/*.integration.test.ts — no Docker needed.
 * Uses in-memory stores and ConsoleAuditSink.
 *
 * Note: Pass --project=integration when running from workspace context to
 * target only this project, or run standalone: vitest run --config vitest.integration.config.ts
 */
export default defineConfig({
  test: {
    name: 'integration',
    environment: 'node',
    include: ['tests/integration/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 15_000,
  },
  resolve: {
    alias: {
      '@fhirbridge/types': resolve(__dirname, 'packages/types/src/index.ts'),
      '@fhirbridge/core': resolve(__dirname, 'packages/core/src/index.ts'),
    },
  },
});
