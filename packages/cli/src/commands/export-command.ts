/**
 * Export command — fetch patient data from a FHIR endpoint and produce a bundle.
 * Connectors are optional dependencies; gracefully handles their absence.
 */

import { Command } from 'commander';
import { BundleBuilder, serializeToJson, serializeToNdjson } from '@fhirbridge/core';
import type { Resource } from '@fhirbridge/core';
import { promptExportOptions } from '../prompts/export-prompts.js';
import { createProgress } from '../formatters/progress-display.js';
import { writeOutput } from '../utils/file-writer.js';
import { info, success, error, debug } from '../utils/logger.js';
import { requireProfile } from '../config/profile-store.js';

export function registerExportCommand(program: Command): void {
  program
    .command('export')
    .description('Export patient data from a FHIR endpoint')
    .option('--patient-id <id>', 'Patient identifier')
    .option('--endpoint <url>', 'FHIR server base URL')
    .option('--profile <name>', 'Connection profile name from config')
    .option('--output <path>', 'Output file path (default: stdout)')
    .option('--format <json|ndjson>', 'Output format', 'json')
    .option('--include-summary', 'Include AI summary in output')
    .option('--summary-provider <provider>', 'AI provider for summary (claude|openai)')
    .action(async (opts: ExportOptions) => {
      try {
        await runExport(opts);
      } catch (err) {
        error((err as Error).message);
        process.exit(1);
      }
    });
}

interface ExportOptions {
  patientId?: string;
  endpoint?: string;
  profile?: string;
  output?: string;
  format?: string;
  includeSummary?: boolean;
  summaryProvider?: string;
}

async function runExport(opts: ExportOptions): Promise<void> {
  // Resolve endpoint from profile if provided
  let endpoint = opts.endpoint;
  if (opts.profile && !endpoint) {
    const profileData = requireProfile(opts.profile);
    endpoint = profileData.baseUrl;
  }

  // Interactive prompts for missing required args.
  // Pass empty string for outputPath (meaning stdout) to avoid requiring TTY in non-interactive mode.
  const resolved = await promptExportOptions({
    endpoint,
    patientId: opts.patientId,
    format: opts.format as 'json' | 'ndjson' | undefined,
    outputPath: opts.output ?? '',
  });

  info(`Connecting to ${resolved.endpoint}`);
  debug(`Patient ID: ${resolved.patientId} | Format: ${resolved.format}`);

  const progress = createProgress(5, 'Exporting');
  let resources: Resource[] = [];

  try {
    progress.update(1);
    info('Fetching patient data...');

    // Dynamic import — connector package may not exist in all environments
    // Use unknown cast to avoid missing module type errors
    const connectorModule = (await import('@fhirbridge/connectors' as string).catch(
      () => null,
    )) as Record<string, unknown> | null;
    if (connectorModule && 'FhirEndpointConnector' in connectorModule) {
      const ConnectorClass = connectorModule['FhirEndpointConnector'] as new (cfg: {
        baseUrl: string;
      }) => {
        fetchPatientBundle(id: string): Promise<Resource[]>;
      };
      const connector = new ConnectorClass({ baseUrl: resolved.endpoint });
      resources = await connector.fetchPatientBundle(resolved.patientId);
    } else {
      info('Connector module not available. Building empty bundle.');
    }
    progress.update(2);
  } catch (fetchErr) {
    error(`Fetch failed: ${(fetchErr as Error).message}`);
    progress.stop();
    throw fetchErr;
  }

  progress.update(3);
  info('Building FHIR bundle...');

  const builder = new BundleBuilder();
  for (const resource of resources) {
    builder.addResource(resource);
  }
  const bundle = builder.build();

  progress.update(4);
  info('Serializing...');

  const output = resolved.format === 'ndjson' ? serializeToNdjson(bundle) : serializeToJson(bundle);

  progress.update(5);
  progress.stop();

  writeOutput(output, resolved.outputPath || undefined);

  success(
    `Exported ${resources.length} resources` +
      (resolved.outputPath ? ` → ${resolved.outputPath}` : ' → stdout'),
  );
}
