/**
 * Export prompts — interactive prompts for FHIR endpoint export configuration.
 * Guards against non-TTY environments (CI).
 */

import { input, select } from '@inquirer/prompts';
import { listProfiles } from '../config/profile-store.js';

export interface ExportPromptResult {
  endpoint: string;
  patientId: string;
  format: 'json' | 'ndjson';
  outputPath: string;
}

/** Require TTY before running interactive prompts. */
function requireTTY(): void {
  if (!process.stdin.isTTY) {
    throw new Error(
      'Interactive mode requires a TTY. In CI/non-TTY, provide all arguments explicitly.',
    );
  }
}

/**
 * Prompt for all missing export options interactively.
 * Only prompts for fields that are undefined.
 * Only calls requireTTY when interactive input is actually needed.
 */
export async function promptExportOptions(
  existing: Partial<ExportPromptResult>,
): Promise<ExportPromptResult> {
  const needsInteraction =
    !existing.endpoint ||
    !existing.patientId ||
    !existing.format ||
    existing.outputPath === undefined;
  if (needsInteraction) requireTTY();

  const profiles = listProfiles();
  let endpoint = existing.endpoint;

  if (!endpoint) {
    if (profiles.length > 0) {
      const choice = await select<string>({
        message: 'Select a connection profile or enter a custom endpoint:',
        choices: [
          ...profiles.map((p) => ({ name: p, value: p })),
          { name: 'Enter custom endpoint URL', value: '__custom__' },
        ],
      });

      if (choice === '__custom__') {
        endpoint = await input({
          message: 'FHIR server base URL:',
          validate: (v) => (v.startsWith('http') ? true : 'Must be a valid URL (http/https)'),
        });
      } else {
        endpoint = choice;
      }
    } else {
      endpoint = await input({
        message: 'FHIR server base URL:',
        validate: (v) => (v.startsWith('http') ? true : 'Must be a valid URL (http/https)'),
      });
    }
  }

  const patientId =
    existing.patientId ??
    (await input({
      message: 'Patient ID:',
      validate: (v) => (v.trim().length > 0 ? true : 'Patient ID is required'),
    }));

  const format = (existing.format ??
    (await select<'json' | 'ndjson'>({
      message: 'Output format:',
      choices: [
        { name: 'JSON (pretty bundle)', value: 'json' },
        { name: 'NDJSON (newline-delimited)', value: 'ndjson' },
      ],
    }))) as 'json' | 'ndjson';

  const outputPath =
    existing.outputPath ??
    (await input({
      message: 'Output file path (leave blank for stdout):',
      default: '',
    }));

  return { endpoint, patientId, format, outputPath };
}
