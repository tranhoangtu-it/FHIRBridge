/**
 * Tests for config-command — manages ~/.fhirbridgerc.json settings and connection profiles.
 */

import { describe, it, expect, vi } from 'vitest';
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

// Mock config manager to avoid file system access
vi.mock('../../config/config-manager.js', () => ({
  loadConfig: vi.fn(() => ({
    defaultProvider: 'claude',
    defaultLanguage: 'en',
    profiles: {},
  })),
  saveConfig: vi.fn(),
  setConfigValue: vi.fn(),
  getConfigValue: vi.fn((key: string) => {
    const map: Record<string, string> = { defaultProvider: 'claude', defaultLanguage: 'en' };
    return map[key];
  }),
  CONFIG_PATH: '/tmp/.fhirbridgerc.json',
  warnIfApiKeyInConfig: vi.fn(),
}));

// Mock profile store
vi.mock('../../config/profile-store.js', () => ({
  listProfiles: vi.fn(() => []),
  getProfile: vi.fn(() => undefined),
  setProfile: vi.fn(),
  removeProfile: vi.fn(),
  requireProfile: vi.fn(),
}));

// Mock formatters
vi.mock('../../formatters/table-formatter.js', () => ({
  formatTable: vi.fn(() => 'table-output'),
  formatKeyValue: vi.fn(() => 'key-value-output'),
}));

vi.mock('../../formatters/json-formatter.js', () => ({
  formatJson: vi.fn(() => '{}'),
}));

describe('config-command registration', () => {
  it('registers the config subcommand', () => {
    const program = buildProgram();
    const names = program.commands.map((c) => c.name());
    expect(names).toContain('config');
  });

  it('config command has "set" subcommand', () => {
    const program = buildProgram();
    const configCmd = program.commands.find((c) => c.name() === 'config');
    expect(configCmd).toBeDefined();
    const subNames = configCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('set');
  });

  it('config command has "get" subcommand', () => {
    const program = buildProgram();
    const configCmd = program.commands.find((c) => c.name() === 'config');
    const subNames = configCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('get');
  });

  it('config command has "list" subcommand', () => {
    const program = buildProgram();
    const configCmd = program.commands.find((c) => c.name() === 'config');
    const subNames = configCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('list');
  });

  it('config command has "add-profile" subcommand', () => {
    const program = buildProgram();
    const configCmd = program.commands.find((c) => c.name() === 'config');
    const subNames = configCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('add-profile');
  });

  it('config command has "remove-profile" subcommand', () => {
    const program = buildProgram();
    const configCmd = program.commands.find((c) => c.name() === 'config');
    const subNames = configCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('remove-profile');
  });

  it('config command has "profiles" subcommand', () => {
    const program = buildProgram();
    const configCmd = program.commands.find((c) => c.name() === 'config');
    const subNames = configCmd!.commands.map((c) => c.name());
    expect(subNames).toContain('profiles');
  });
});

describe('config subcommand parseAsync', () => {
  it('config list runs without error', async () => {
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(['node', 'fhirbridge', 'config', 'list']),
    ).resolves.toBeDefined();
  });

  it('config list --format json runs without error', async () => {
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(['node', 'fhirbridge', 'config', 'list', '--format', 'json']),
    ).resolves.toBeDefined();
  });

  it('config get defaultProvider runs without error', async () => {
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(['node', 'fhirbridge', 'config', 'get', 'defaultProvider']),
    ).resolves.toBeDefined();
  });

  it('config set defaultProvider openai runs without error', async () => {
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(['node', 'fhirbridge', 'config', 'set', 'defaultProvider', 'openai']),
    ).resolves.toBeDefined();
  });

  it('config set with unknown key exits with error', async () => {
    const program = buildProgram();
    program.exitOverride();

    const exitSpy = vi.spyOn(process, 'exit').mockImplementation((_code) => {
      throw new Error(`process.exit(${_code})`);
    });

    await expect(
      program.parseAsync(['node', 'fhirbridge', 'config', 'set', 'unknownKey', 'value']),
    ).rejects.toThrow();

    exitSpy.mockRestore();
  });

  it('config profiles runs without error', async () => {
    const program = buildProgram();
    program.exitOverride();

    await expect(
      program.parseAsync(['node', 'fhirbridge', 'config', 'profiles']),
    ).resolves.toBeDefined();
  });
});
