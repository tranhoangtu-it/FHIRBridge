import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  test: {
    name: 'api',
    environment: 'node',
    globals: true,
    include: ['src/**/*.{test,spec}.ts'],
    passWithNoTests: true,
    coverage: {
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.d.ts'],
    },
  },
  resolve: {
    alias: {
      '@fhirbridge/types': resolve(__dirname, '../types/src/index.ts'),
      '@fhirbridge/core': resolve(__dirname, '../core/src/index.ts'),
    },
  },
});
