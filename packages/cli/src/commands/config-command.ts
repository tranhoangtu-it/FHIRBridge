/**
 * Config command — manage ~/.fhirbridgerc.json settings and connection profiles.
 * Subcommands: set, get, list, add-profile, remove-profile
 */

import { Command } from 'commander';
import { input, select } from '@inquirer/prompts';
import {
  loadConfig,
  setConfigValue,
  getConfigValue,
  CONFIG_PATH,
} from '../config/config-manager.js';
import {
  setProfile,
  removeProfile,
  listProfiles,
  getProfile,
} from '../config/profile-store.js';
import { formatKeyValue, formatTable } from '../formatters/table-formatter.js';
import { formatJson } from '../formatters/json-formatter.js';
import { info, success, error, warn, print } from '../utils/logger.js';
import type { ConnectorProfile } from '../config/config-manager.js';

export function registerConfigCommand(program: Command): void {
  const config = program.command('config').description('Manage FHIRBridge configuration');

  // config set <key> <value>
  config
    .command('set <key> <value>')
    .description('Set a configuration value (defaultProvider, defaultLanguage)')
    .action((key: string, value: string) => {
      const allowed = ['defaultProvider', 'defaultLanguage'];
      if (!allowed.includes(key)) {
        error(`Unknown config key: ${key}. Allowed: ${allowed.join(', ')}`);
        process.exit(1);
      }
      setConfigValue(key as 'defaultProvider' | 'defaultLanguage', value);
      success(`Set ${key} = ${value}`);
    });

  // config get <key>
  config
    .command('get <key>')
    .description('Get a configuration value')
    .action((key: string) => {
      const value = getConfigValue(key as keyof ReturnType<typeof loadConfig>);
      if (value === undefined) {
        error(`Key not found: ${key}`);
        process.exit(1);
      }
      print(typeof value === 'object' ? formatJson(value) : String(value));
    });

  // config list
  config
    .command('list')
    .description('Show all configuration')
    .option('--format <json|table>', 'Output format', 'table')
    .action((opts: { format: string }) => {
      const cfg = loadConfig();
      info(`Config file: ${CONFIG_PATH}`);
      if (opts.format === 'json') {
        print(formatJson(cfg));
      } else {
        print(formatKeyValue({
          defaultProvider: cfg.defaultProvider,
          defaultLanguage: cfg.defaultLanguage,
          profiles: listProfiles().join(', ') || '(none)',
        }));
      }
    });

  // config add-profile <name>
  config
    .command('add-profile <name>')
    .description('Add a named connection profile interactively')
    .action(async (name: string) => {
      try {
        await addProfileInteractive(name);
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });

  // config remove-profile <name>
  config
    .command('remove-profile <name>')
    .description('Remove a named connection profile')
    .action((name: string) => {
      try {
        removeProfile(name);
        success(`Removed profile: ${name}`);
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });

  // config profiles (list profiles)
  config
    .command('profiles')
    .description('List all connection profiles')
    .action(() => {
      const names = listProfiles();
      if (names.length === 0) {
        info('No profiles configured. Run: fhirbridge config add-profile <name>');
        return;
      }
      const rows = names.map((n) => {
        const p = getProfile(n) as ConnectorProfile;
        return { name: n, type: p.type, baseUrl: p.baseUrl ?? '' };
      });
      print(formatTable(rows as Record<string, unknown>[], [
        { header: 'Name', key: 'name', width: 20 },
        { header: 'Type', key: 'type', width: 20 },
        { header: 'Base URL', key: 'baseUrl', width: 50 },
      ]));
    });
}

async function addProfileInteractive(name: string): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error('Interactive profile creation requires a TTY. Use --help for non-interactive options.');
  }

  const type = await select<ConnectorProfile['type']>({
    message: 'Connection type:',
    choices: [
      { name: 'FHIR Endpoint (R4)', value: 'fhir-endpoint' },
      { name: 'Epic SMART on FHIR', value: 'epic' },
      { name: 'Cerner SMART on FHIR', value: 'cerner' },
      { name: 'CSV Import', value: 'csv' },
    ],
  });

  const baseUrl = await input({
    message: 'Base URL:',
    validate: (v) => (v.startsWith('http') ? true : 'Must start with http/https'),
  });

  const apiKey = await input({
    message: 'API Key (leave blank to skip / use env var):',
    default: '',
  });

  const profile: ConnectorProfile = { type, baseUrl };
  if (apiKey) {
    profile.apiKey = apiKey;
    warn('Storing API key in config file. Consider FHIRBRIDGE_API_KEY env var instead.');
  }

  setProfile(name, profile);
  success(`Profile "${name}" saved to ${CONFIG_PATH}`);
}
