/**
 * CLI E2E test helper — spawns the CLI as a real subprocess using execFile.
 * All file I/O uses temp directories that are cleaned up in afterAll hooks.
 */

import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';

const execFileAsync = promisify(execFile);

/** Absolute path to the CLI entry point binary. */
export const CLI_PATH = join(process.cwd(), 'packages/cli/bin/fhirbridge.js');

/** Absolute path to the CSV test fixtures directory. */
export const FIXTURES_CSV = join(process.cwd(), 'tests/fixtures/csv');

/** Absolute path to the Excel test fixtures directory. */
export const FIXTURES_EXCEL = join(process.cwd(), 'tests/fixtures/excel');

export interface CliResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Run the CLI as a subprocess.
 * @param args - CLI arguments passed after the binary path
 * @param env  - Additional environment variables merged over process.env
 */
export async function runCli(args: string[], env?: Record<string, string>): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFileAsync('node', [CLI_PATH, ...args], {
      timeout: 30_000,
      env: { ...process.env, ...env, NO_COLOR: '1' },
      cwd: process.cwd(),
    });
    return { stdout, stderr, exitCode: 0 };
  } catch (err: unknown) {
    const e = err as NodeJS.ErrnoException & {
      stdout?: string;
      stderr?: string;
      code?: number | string;
    };
    return {
      stdout: e.stdout ?? '',
      stderr: e.stderr ?? '',
      exitCode: typeof e.code === 'number' ? e.code : 1,
    };
  }
}

/**
 * Create a temporary directory prefixed with "fhirbridge-test-".
 * Caller is responsible for cleanup via cleanTempDir.
 */
export async function createTempDir(): Promise<string> {
  return mkdtemp(join(tmpdir(), 'fhirbridge-test-'));
}

/**
 * Remove a temp directory and all its contents.
 */
export async function cleanTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}
