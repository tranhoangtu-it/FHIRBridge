/**
 * Tests for summarize-command — generates AI clinical summaries from FHIR bundles.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { writeFileSync, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { buildProgram } from '../../index.js';

// Silence logger output in tests
vi.mock('../../utils/logger.js', () => ({
  info: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  print: vi.fn(),
  configureLogger: vi.fn(),
}));

// Mock prompts to avoid interactive TTY
vi.mock('../../prompts/provider-prompts.js', () => ({
  promptProviderOptions: vi.fn(async (opts: Record<string, unknown>) => ({
    provider: opts['provider'] ?? 'claude',
    language: opts['language'] ?? 'en',
    detail: opts['detail'] ?? 'standard',
  })),
}));

// Mock file writer
vi.mock('../../utils/file-writer.js', () => ({
  writeOutput: vi.fn(),
}));

// Mock config manager to return stable defaults
vi.mock('../../config/config-manager.js', () => ({
  loadConfig: vi.fn(() => ({
    defaultProvider: 'claude',
    defaultLanguage: 'en',
    profiles: {},
  })),
  CONFIG_PATH: '/tmp/.fhirbridgerc.json',
  saveConfig: vi.fn(),
  getConfigValue: vi.fn(),
  setConfigValue: vi.fn(),
  warnIfApiKeyInConfig: vi.fn(),
}));

const VALID_BUNDLE = JSON.stringify({
  resourceType: 'Bundle',
  type: 'collection',
  entry: [{ resource: { resourceType: 'Patient', id: 'p1' } }],
});

describe('summarize-command registration', () => {
  it('registers the summarize subcommand', () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('summarize');
  });

  it('has --provider option', () => {
    const program = buildProgram();
    const cmd = program.commands.find((c) => c.name() === 'summarize');
    expect(cmd).toBeDefined();
    const optionNames = cmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--provider');
  });

  it('has --language option', () => {
    const program = buildProgram();
    const cmd = program.commands.find((c) => c.name() === 'summarize');
    const optionNames = cmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--language');
  });

  it('has --detail option with default standard', () => {
    const program = buildProgram();
    const cmd = program.commands.find((c) => c.name() === 'summarize');
    const detailOpt = cmd!.options.find((o) => o.long === '--detail');
    expect(detailOpt).toBeDefined();
    expect(detailOpt!.defaultValue).toBe('standard');
  });

  it('has --format option with default markdown', () => {
    const program = buildProgram();
    const cmd = program.commands.find((c) => c.name() === 'summarize');
    const formatOpt = cmd!.options.find((o) => o.long === '--format');
    expect(formatOpt).toBeDefined();
    expect(formatOpt!.defaultValue).toBe('markdown');
  });

  it('has --input option', () => {
    const program = buildProgram();
    const cmd = program.commands.find((c) => c.name() === 'summarize');
    const optionNames = cmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--input');
  });
});

describe('summarize-command parseAsync', () => {
  let tmpFile: string;

  beforeEach(() => {
    vi.clearAllMocks();
    tmpFile = join(tmpdir(), `test-bundle-sum-${Date.now()}.json`);
    writeFileSync(tmpFile, VALID_BUNDLE);
  });

  afterEach(() => {
    try {
      unlinkSync(tmpFile);
    } catch {
      /* ignore */
    }
  });

  it('parses --provider claude without error', async () => {
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync([
        'node',
        'fhirbridge',
        'summarize',
        '--input',
        tmpFile,
        '--provider',
        'claude',
      ]),
    ).resolves.toBeDefined();
  });

  it('parses --language vi without error', async () => {
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync([
        'node',
        'fhirbridge',
        'summarize',
        '--input',
        tmpFile,
        '--language',
        'vi',
      ]),
    ).resolves.toBeDefined();
  });

  it('parses --detail brief without error', async () => {
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync([
        'node',
        'fhirbridge',
        'summarize',
        '--input',
        tmpFile,
        '--detail',
        'brief',
      ]),
    ).resolves.toBeDefined();
  });

  it('parses --format composition without error', async () => {
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync([
        'node',
        'fhirbridge',
        'summarize',
        '--input',
        tmpFile,
        '--format',
        'composition',
      ]),
    ).resolves.toBeDefined();
  });

  it('exits with error for missing --input', async () => {
    const program = buildProgram();
    program.exitOverride();

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code})`);
    });

    await expect(program.parseAsync(['node', 'fhirbridge', 'summarize'])).rejects.toThrow();

    exitSpy.mockRestore();
  });
});
