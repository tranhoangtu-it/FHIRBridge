#!/usr/bin/env node
/**
 * FHIRBridge CLI entry point.
 * Delegates to compiled TypeScript in ../dist/index.js
 */

import('../dist/index.js')
  .then(({ main }) => main())
  .catch((err) => {
    process.stderr.write(`Fatal: ${err.message}\n`);
    process.exit(1);
  });
