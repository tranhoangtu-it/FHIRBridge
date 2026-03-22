import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/types/vitest.config.ts',
  'packages/core/vitest.config.ts',
  'packages/api/vitest.config.ts',
  'packages/cli/vitest.config.ts',
  'packages/web/vitest.config.ts',
  // Integration tests — run via `pnpm test:integration` (uses --project integration)
  'tests/integration/vitest.config.ts',
  // CLI E2E tests — run via `pnpm test:e2e:cli` (uses --project cli-e2e)
  'tests/e2e/cli/vitest.config.ts',
]);
