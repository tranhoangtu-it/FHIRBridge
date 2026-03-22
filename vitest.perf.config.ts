import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    name: 'perf',
    environment: 'node',
    include: ['tests/perf/**/*.test.ts'],
    testTimeout: 120_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@fhirbridge/types': resolve(__dirname, 'packages/types/src/index.ts'),
      '@fhirbridge/core': resolve(__dirname, 'packages/core/src/index.ts'),
      // Resolve fastify and friends through the api package that declares them as deps
      fastify: resolve(__dirname, 'packages/api/node_modules/fastify'),
    },
  },
});
