/**
 * E2E tests for `fhirbridge config` command.
 * Uses an isolated temp HOME directory so tests do not pollute user config.
 * Runs CLI as a real subprocess — no mocks.
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { runCli, createTempDir, cleanTempDir } from './cli-test-helper.js';

let tempDir: string;

/** Environment override — points HOME to an isolated temp directory. */
function isolatedEnv(): Record<string, string> {
  return { HOME: tempDir };
}

beforeAll(async () => {
  tempDir = await createTempDir();
});

afterAll(async () => {
  await cleanTempDir(tempDir);
});

describe('fhirbridge config', () => {
  it('sets a config value and reads it back', async () => {
    const setResult = await runCli(['config', 'set', 'defaultProvider', 'claude'], isolatedEnv());
    expect(setResult.exitCode).toBe(0);

    const getResult = await runCli(['config', 'get', 'defaultProvider'], isolatedEnv());
    expect(getResult.exitCode).toBe(0);
    expect(getResult.stdout).toMatch(/claude/);
  });

  it('config list shows defaultProvider', async () => {
    // Ensure a value is set first
    await runCli(['config', 'set', 'defaultProvider', 'openai'], isolatedEnv());

    const listResult = await runCli(['config', 'list'], isolatedEnv());
    expect(listResult.exitCode).toBe(0);
    expect(listResult.stdout).toMatch(/defaultProvider/i);
  });

  it('config list shows defaultLanguage', async () => {
    const listResult = await runCli(['config', 'list'], isolatedEnv());
    expect(listResult.exitCode).toBe(0);
    expect(listResult.stdout).toMatch(/defaultLanguage/i);
  });

  it('exits 1 for an unknown config key', async () => {
    const result = await runCli(['config', 'set', 'unknownKey', 'value'], isolatedEnv());
    expect(result.exitCode).toBe(1);
    expect(result.stderr).toMatch(/unknown config key/i);
  });

  it('exits 1 when getting a nonexistent key', async () => {
    const result = await runCli(['config', 'get', 'nonExistentKey'], isolatedEnv());
    expect(result.exitCode).toBe(1);
  });

  it('config set defaultLanguage persists correctly', async () => {
    const setResult = await runCli(['config', 'set', 'defaultLanguage', 'vi'], isolatedEnv());
    expect(setResult.exitCode).toBe(0);

    const getResult = await runCli(['config', 'get', 'defaultLanguage'], isolatedEnv());
    expect(getResult.exitCode).toBe(0);
    expect(getResult.stdout).toMatch(/vi/);
  });
});
