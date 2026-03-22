/**
 * Validate command — validate a FHIR bundle JSON file.
 * Exit code 0 if valid, 1 if any errors found.
 */

import { Command } from 'commander';
import { readFileSync, existsSync } from 'fs';
import { validateResource } from '@fhirbridge/core';
import type { Bundle, Resource } from '@fhirbridge/core';
import { formatTable } from '../formatters/table-formatter.js';
import { formatJson } from '../formatters/json-formatter.js';
import { info, success, error, print } from '../utils/logger.js';

interface ValidationRow {
  resourceType: string;
  id: string;
  status: string;
  errors: string;
}

export function registerValidateCommand(program: Command): void {
  program
    .command('validate')
    .description('Validate a FHIR bundle JSON file')
    .requiredOption('--input <path>', 'Path to FHIR bundle JSON file')
    .option('--format <json|table>', 'Output format', 'table')
    .action(async (opts: { input: string; format: string }) => {
      try {
        await runValidate(opts.input, opts.format as 'json' | 'table');
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });
}

async function runValidate(inputPath: string, format: 'json' | 'table'): Promise<void> {
  if (!existsSync(inputPath)) {
    throw new Error(`File not found: ${inputPath}`);
  }

  info(`Validating: ${inputPath}`);

  let bundle: Bundle;
  try {
    const raw = readFileSync(inputPath, 'utf8');
    bundle = JSON.parse(raw) as Bundle;
  } catch {
    throw new Error(`Failed to parse JSON from: ${inputPath}`);
  }

  if (bundle.resourceType !== 'Bundle') {
    throw new Error(`Expected Bundle, got: ${bundle.resourceType}`);
  }

  const entries = bundle.entry ?? [];
  const rows: ValidationRow[] = [];
  let hasErrors = false;

  for (const entry of entries) {
    const resource = entry.resource as Resource | undefined;
    if (!resource) continue;

    const result = validateResource(resource);
    const isValid = result.valid;
    if (!isValid) hasErrors = true;

    rows.push({
      resourceType: resource.resourceType,
      id: resource.id ?? '(no id)',
      status: isValid ? '✔ valid' : '✖ invalid',
      errors: result.errors.map((e) => e.message).join('; ') || '',
    });
  }

  if (format === 'json') {
    print(formatJson({ total: rows.length, valid: rows.filter((r) => r.status.includes('valid')).length, results: rows }));
  } else {
    print(formatTable(rows as unknown as Record<string, unknown>[], [
      { header: 'Resource Type', key: 'resourceType', width: 22 },
      { header: 'ID', key: 'id', width: 30 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Errors', key: 'errors', width: 50 },
    ]));
  }

  const validCount = rows.filter((r) => !r.errors).length;
  if (hasErrors) {
    error(`Validation failed: ${rows.length - validCount} of ${rows.length} resources have errors`);
    process.exit(1);
  } else {
    success(`All ${rows.length} resources valid`);
  }
}
