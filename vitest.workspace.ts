import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/types/vitest.config.ts',
  'packages/core/vitest.config.ts',
  'packages/api/vitest.config.ts',
  'packages/cli/vitest.config.ts',
  'packages/web/vitest.config.ts',
]);
