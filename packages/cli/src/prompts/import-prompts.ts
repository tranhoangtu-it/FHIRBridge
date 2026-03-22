/**
 * Import prompts — file picker and column mapping wizard for CSV/Excel import.
 */

import { input, select, confirm } from '@inquirer/prompts';
import { existsSync } from 'fs';

export interface ImportPromptResult {
  filePath: string;
  mappingPath?: string;
  outputPath: string;
  format: 'json' | 'ndjson';
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
 * Prompt for all missing import options interactively.
 */
export async function promptImportOptions(
  existing: Partial<ImportPromptResult>,
): Promise<ImportPromptResult> {
  requireTTY();

  const filePath = existing.filePath ?? (await input({
    message: 'Path to CSV or Excel file:',
    validate: (v) => {
      if (!v.trim()) return 'File path is required';
      if (!existsSync(v.trim())) return `File not found: ${v}`;
      return true;
    },
  }));

  let mappingPath = existing.mappingPath;
  if (!mappingPath) {
    const hasMappingFile = await confirm({
      message: 'Do you have a column mapping file?',
      default: false,
    });

    if (hasMappingFile) {
      mappingPath = await input({
        message: 'Path to mapping JSON file:',
        validate: (v) => {
          if (!v.trim()) return 'Mapping file path is required';
          if (!existsSync(v.trim())) return `File not found: ${v}`;
          return true;
        },
      });
    }
  }

  const format = (existing.format ?? (await select<'json' | 'ndjson'>({
    message: 'Output format:',
    choices: [
      { name: 'JSON (pretty bundle)', value: 'json' },
      { name: 'NDJSON (newline-delimited)', value: 'ndjson' },
    ],
  }))) as 'json' | 'ndjson';

  const outputPath = existing.outputPath ?? (await input({
    message: 'Output file path (leave blank for stdout):',
    default: '',
  }));

  return { filePath, mappingPath, outputPath, format };
}
