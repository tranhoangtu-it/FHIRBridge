/**
 * Tests for import-command — imports CSV/Excel files and produces FHIR bundles.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

// Mutable mock so each test can configure filePath
const mockPromptImportOptions = vi.fn();
vi.mock('../../prompts/import-prompts.js', () => ({
  promptImportOptions: (...args: unknown[]) => mockPromptImportOptions(...args),
}));

// Mock progress display
vi.mock('../../formatters/progress-display.js', () => ({
  createProgress: vi.fn(() => ({
    update: vi.fn(),
    increment: vi.fn(),
    stop: vi.fn(),
  })),
}));

// Mock file writer
vi.mock('../../utils/file-writer.js', () => ({
  writeOutput: vi.fn(),
}));

describe('import-command registration', () => {
  it('registers the import subcommand', () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('import');
  });

  it('import command has --file option', () => {
    const program = buildProgram();
    const importCmd = program.commands.find((c) => c.name() === 'import');
    expect(importCmd).toBeDefined();
    const optionNames = importCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--file');
  });

  it('import command has --mapping option', () => {
    const program = buildProgram();
    const importCmd = program.commands.find((c) => c.name() === 'import');
    const optionNames = importCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--mapping');
  });

  it('import command has --format option defaulting to json', () => {
    const program = buildProgram();
    const importCmd = program.commands.find((c) => c.name() === 'import');
    const formatOpt = importCmd!.options.find((o) => o.long === '--format');
    expect(formatOpt).toBeDefined();
    expect(formatOpt!.defaultValue).toBe('json');
  });

  it('import command has --resource-type option defaulting to Patient', () => {
    const program = buildProgram();
    const importCmd = program.commands.find((c) => c.name() === 'import');
    const resourceTypeOpt = importCmd!.options.find((o) => o.long === '--resource-type');
    expect(resourceTypeOpt).toBeDefined();
    expect(resourceTypeOpt!.defaultValue).toBe('Patient');
  });

  it('import command has --output option', () => {
    const program = buildProgram();
    const importCmd = program.commands.find((c) => c.name() === 'import');
    const optionNames = importCmd!.options.map((o) => o.long);
    expect(optionNames).toContain('--output');
  });
});

describe('import-command file extension detection', () => {
  let csvFile: string;
  let xlsxFile: string;
  let mappingFile: string;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create actual temp files so existsSync inside runImport passes
    csvFile = join(tmpdir(), `test-import-${Date.now()}.csv`);
    xlsxFile = join(tmpdir(), `test-import-${Date.now()}.xlsx`);
    mappingFile = join(tmpdir(), `test-mapping-${Date.now()}.json`);
    writeFileSync(csvFile, 'name,dob\nJohn,1980-01-01', 'utf8');
    writeFileSync(xlsxFile, 'xlsx placeholder', 'utf8');
    writeFileSync(mappingFile, JSON.stringify({ fields: [] }), 'utf8');
  });

  afterEach(() => {
    try {
      unlinkSync(csvFile);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(xlsxFile);
    } catch {
      /* ignore */
    }
    try {
      unlinkSync(mappingFile);
    } catch {
      /* ignore */
    }
  });

  it('accepts .csv extension — prompt resolves with csv path', async () => {
    mockPromptImportOptions.mockResolvedValue({
      filePath: csvFile,
      mappingPath: null,
      outputPath: null,
      format: 'json',
    });

    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(['node', 'fhirbridge', 'import', '--file', csvFile]),
    ).resolves.toBeDefined();
  });

  it('accepts .xlsx extension — prompt resolves with xlsx path', async () => {
    mockPromptImportOptions.mockResolvedValue({
      filePath: xlsxFile,
      mappingPath: null,
      outputPath: null,
      format: 'json',
    });

    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(['node', 'fhirbridge', 'import', '--file', xlsxFile]),
    ).resolves.toBeDefined();
  });

  it('parses --mapping option — prompt resolves with mapping path', async () => {
    mockPromptImportOptions.mockResolvedValue({
      filePath: csvFile,
      mappingPath: mappingFile,
      outputPath: null,
      format: 'json',
    });

    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync([
        'node',
        'fhirbridge',
        'import',
        '--file',
        csvFile,
        '--mapping',
        mappingFile,
      ]),
    ).resolves.toBeDefined();
  });

  it('parses --format ndjson', async () => {
    mockPromptImportOptions.mockResolvedValue({
      filePath: csvFile,
      mappingPath: null,
      outputPath: null,
      format: 'ndjson',
    });

    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(['node', 'fhirbridge', 'import', '--file', csvFile, '--format', 'ndjson']),
    ).resolves.toBeDefined();
  });
});
