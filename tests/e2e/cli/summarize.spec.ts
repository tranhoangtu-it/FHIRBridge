/**
 * E2E tests for `fhirbridge summarize` command.
 * Runs CLI as a real subprocess — no mocks.
 * AI provider calls are expected to fail (no API key) — tests verify graceful error handling.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { runCli, createTempDir, cleanTempDir } from './cli-test-helper.js';

const SAMPLE_BUNDLE = JSON.stringify({
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        id: 'summarize-test-1',
        name: [{ family: 'Smith', given: ['Jane'] }],
      },
    },
  ],
});

let tempDir: string;
let bundlePath: string;

beforeAll(async () => {
  tempDir = await createTempDir();
  bundlePath = join(tempDir, 'bundle.json');
  await writeFile(bundlePath, SAMPLE_BUNDLE, 'utf8');
});

afterAll(async () => {
  await cleanTempDir(tempDir);
});

describe('fhirbridge summarize', () => {
  it('exits 0 and shows --provider in --help output', async () => {
    const result = await runCli(['summarize', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/--provider/);
  });

  it('--help output includes --input and --language flags', async () => {
    const result = await runCli(['summarize', '--help']);
    expect(result.exitCode).toBe(0);
    expect(result.stdout).toMatch(/--input/);
    expect(result.stdout).toMatch(/--language/);
  });

  it('exits non-zero or outputs placeholder when API module is absent', async () => {
    // AI module (@fhirbridge/ai) is optional. Without it, command generates a placeholder summary.
    // Without any API key env vars, real AI providers fail — but since the module is absent,
    // we expect either exit 0 with placeholder text or exit 1 with graceful error.
    const result = await runCli(
      [
        'summarize',
        '--input',
        bundlePath,
        '--provider',
        'claude',
        '--language',
        'en',
        '--detail',
        'brief',
      ],
      {
        // Explicitly unset API keys to ensure no accidental real call
        ANTHROPIC_API_KEY: '',
        OPENAI_API_KEY: '',
      },
    );

    // Should not hang; must terminate with 0 (placeholder) or 1 (graceful fail)
    expect([0, 1]).toContain(result.exitCode);

    if (result.exitCode === 0) {
      // Placeholder summary should contain recognizable content
      expect(result.stdout).toBeTruthy();
    } else {
      // Graceful error message must appear
      expect(result.stderr).toBeTruthy();
    }
  });

  it('exits 1 when --input is not provided', async () => {
    const result = await runCli([
      'summarize',
      '--provider',
      'claude',
      '--language',
      'en',
      '--detail',
      'brief',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/--input.*required|required.*--input/i);
  });

  it('exits 1 for a nonexistent input bundle file', async () => {
    const result = await runCli([
      'summarize',
      '--input',
      join(tempDir, 'does-not-exist.json'),
      '--provider',
      'claude',
      '--language',
      'en',
      '--detail',
      'brief',
    ]);
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/not found|error/i);
  });
});
