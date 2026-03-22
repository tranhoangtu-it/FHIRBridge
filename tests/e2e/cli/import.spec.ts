/**
 * E2E tests for `fhirbridge import` command.
 * Runs CLI as a real subprocess — no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli, createTempDir, cleanTempDir, FIXTURES_CSV } from './cli-test-helper.js';

const CSV_FILE = join(FIXTURES_CSV, 'sample-patients.csv');
const MAPPING_FILE = join(FIXTURES_CSV, 'mapping-config.json');

let tempDir: string;

beforeAll(async () => {
  tempDir = await createTempDir();
});

afterAll(async () => {
  await cleanTempDir(tempDir);
});

describe('fhirbridge import', () => {
  it('exits 0 and produces a FHIR Bundle JSON file', async () => {
    const outputFile = join(tempDir, 'output-bundle.json');
    const result = await runCli([
      'import',
      '--file',
      CSV_FILE,
      '--mapping',
      MAPPING_FILE,
      '--output',
      outputFile,
      '--format',
      'json',
    ]);

    expect(result.exitCode).toBe(0);

    // Output file must exist and contain a Bundle
    const content = await readFile(outputFile, 'utf8');
    expect(content).toBeTruthy();
    // Bundle resourceType must be present
    expect(content).toMatch(/"resourceType"\s*:\s*"Bundle"/);
  });

  it('exits 1 and reports error when --file is omitted (non-TTY mode)', async () => {
    // Without --file, promptImportOptions will try TTY and fail (no TTY in subprocess)
    const result = await runCli([
      'import',
      '--mapping',
      MAPPING_FILE,
      '--output',
      join(tempDir, 'no-file-output.json'),
      '--format',
      'json',
    ]);
    expect(result.exitCode).toBe(1);
  });

  it('exits 1 for a nonexistent input file', async () => {
    const result = await runCli([
      'import',
      '--file',
      join(tempDir, 'nonexistent.csv'),
      '--mapping',
      MAPPING_FILE,
      '--output',
      join(tempDir, 'output2.json'),
      '--format',
      'json',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found|error/i);
  });

  it('exits 1 for a nonexistent mapping file', async () => {
    const result = await runCli([
      'import',
      '--file',
      CSV_FILE,
      '--mapping',
      join(tempDir, 'nonexistent-mapping.json'),
      '--output',
      join(tempDir, 'output3.json'),
      '--format',
      'json',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found|error/i);
  });
});
