/**
 * E2E tests for `fhirbridge validate` command.
 * Runs CLI as a real subprocess — no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile, join as pathJoin } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli, createTempDir, cleanTempDir } from './cli-test-helper.js';

// Valid minimal FHIR Bundle with one Patient resource
const VALID_BUNDLE = JSON.stringify({
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        id: 'test-patient-1',
        name: [{ family: 'Doe', given: ['John'] }],
      },
    },
  ],
});

// Bundle missing resourceType — validator should reject it
const INVALID_BUNDLE = JSON.stringify({
  type: 'collection',
  entry: [{ resource: { id: 'no-type' } }],
});

let tempDir: string;
let validBundlePath: string;
let invalidBundlePath: string;

beforeAll(async () => {
  tempDir = await createTempDir();
  validBundlePath = join(tempDir, 'valid-bundle.json');
  invalidBundlePath = join(tempDir, 'invalid-bundle.json');
  await writeFile(validBundlePath, VALID_BUNDLE, 'utf8');
  await writeFile(invalidBundlePath, INVALID_BUNDLE, 'utf8');
});

afterAll(async () => {
  await cleanTempDir(tempDir);
});

describe('fhirbridge validate', () => {
  it('exits 0 and reports valid for a correct bundle', async () => {
    const result = await runCli(['validate', '--input', validBundlePath]);
    expect(result.exitCode).toBe(0);
    // stdout or stderr should mention "valid"
    const combined = result.stdout + result.stderr;
    expect(combined.toLowerCase()).toMatch(/valid/);
  });

  it('exits 1 for a bundle missing resourceType', async () => {
    const result = await runCli(['validate', '--input', invalidBundlePath]);
    expect(result.exitCode).toBe(1);
  });

  it('exits 1 and reports error for a nonexistent file', async () => {
    const result = await runCli(['validate', '--input', join(tempDir, 'does-not-exist.json')]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found|error/i);
  });

  it('exits 1 when --input is omitted (required option)', async () => {
    const result = await runCli(['validate']);
    expect(result.exitCode).toBe(1);
  });

  it('outputs JSON format when --format json is passed', async () => {
    const result = await runCli(['validate', '--input', validBundlePath, '--format', 'json']);
    expect(result.exitCode).toBe(0);
    // stdout contains JSON object with total and valid fields
    expect(result.stdout).toMatch(/"total"/);
    expect(result.stdout).toMatch(/"valid"/);
  });
});
