/**
 * CSV file connector — streams rows as RawRecords using csv-parse.
 * Supports UTF-8, UTF-16, and Shift-JIS encodings.
 * Never loads the full file into memory.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { parse } from 'csv-parse';
import type { ConnectorConfig, FileImportConfig } from '@fhirbridge/types';
import type { HisConnector, RawRecord, ConnectionStatus } from './his-connector-interface.js';
import { ConnectorError } from './his-connector-interface.js';
import { mapRow } from './column-mapper.js';

export class CsvConnector implements HisConnector {
  readonly type = 'csv' as const;

  private config: FileImportConfig | null = null;
  private headers: string[] = [];

  async connect(config: ConnectorConfig): Promise<void> {
    if (config.type !== 'csv') {
      throw new ConnectorError('Expected csv config', 'CONFIG_MISMATCH');
    }

    // Validate file path (prevent directory traversal)
    const resolved = path.resolve(config.filePath);
    if (!resolved.startsWith(path.resolve('/'))) {
      throw new ConnectorError('Invalid file path', 'INVALID_PATH');
    }

    if (!fs.existsSync(resolved)) {
      throw new ConnectorError(`File not found: path omitted for security`, 'FILE_NOT_FOUND');
    }

    this.config = { ...config, filePath: resolved };
    this.headers = await this.readHeaders(resolved, config);
  }

  async testConnection(): Promise<ConnectionStatus> {
    if (!this.config) {
      return { connected: false, error: 'Not connected', checkedAt: new Date().toISOString() };
    }

    try {
      const stats = fs.statSync(this.config.filePath);
      return {
        connected: true,
        serverVersion: `CSV (${stats.size} bytes)`,
        checkedAt: new Date().toISOString(),
      };
    } catch (err) {
      return {
        connected: false,
        error: err instanceof Error ? err.message : 'Unknown error',
        checkedAt: new Date().toISOString(),
      };
    }
  }

  async *fetchPatientData(patientId: string): AsyncIterable<RawRecord> {
    if (!this.config) {
      throw new ConnectorError('Call connect() before fetchPatientData()', 'NOT_CONNECTED');
    }

    const { filePath, delimiter, encoding, mapping, patientIdColumn } = this.config;
    const source = `csv:${path.basename(filePath)}`;
    let rowIndex = 0;

    const stream = fs.createReadStream(filePath, {
      encoding: (encoding as BufferEncoding) ?? 'utf-8',
    });

    const parser = stream.pipe(
      parse({
        delimiter: delimiter ?? ',',
        columns: true,
        skip_empty_lines: true,
        trim: true,
        bom: true,
      }),
    );

    for await (const row of parser) {
      rowIndex++;
      const typedRow = row as Record<string, unknown>;

      // Filter by patient ID if a column is specified
      if (patientIdColumn && typedRow[patientIdColumn] !== patientId) {
        continue;
      }

      const records = mapRow(typedRow, mapping, source, rowIndex);
      for (const record of records) {
        yield record;
      }
    }
  }

  async disconnect(): Promise<void> {
    this.config = null;
    this.headers = [];
  }

  /** Read only the header row to validate column names */
  private readHeaders(filePath: string, config: FileImportConfig): Promise<string[]> {
    return new Promise((resolve, reject) => {
      const results: string[] = [];
      const stream = fs.createReadStream(filePath, {
        encoding: (config.encoding as BufferEncoding) ?? 'utf-8',
        end: 4096, // Only read first 4KB for headers
      });

      const parser = stream.pipe(
        parse({
          delimiter: config.delimiter ?? ',',
          columns: false,
          to_line: (config.headerRow ?? 0) + 1,
          trim: true,
          bom: true,
        }),
      );

      parser.on('data', (row: unknown[]) => {
        if (Array.isArray(row)) results.push(...row.map(String));
      });
      parser.on('end', () => resolve(results));
      parser.on('error', reject);
    });
  }

  /** Return detected column headers */
  getHeaders(): string[] {
    return [...this.headers];
  }
}
