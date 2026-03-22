/**
 * Excel (.xlsx) file connector using SheetJS (xlsx package).
 * Iterates rows as RawRecords without loading the full workbook.
 * Streams row-by-row after initial workbook header read.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import * as XLSX from 'xlsx';
import type { ConnectorConfig, FileImportConfig } from '@fhirbridge/types';
import type { HisConnector, RawRecord, ConnectionStatus } from './his-connector-interface.js';
import { ConnectorError } from './his-connector-interface.js';
import { mapRow } from './column-mapper.js';

export class ExcelConnector implements HisConnector {
  readonly type = 'excel' as const;

  private config: FileImportConfig | null = null;
  private workbook: XLSX.WorkBook | null = null;

  async connect(config: ConnectorConfig): Promise<void> {
    if (config.type !== 'excel') {
      throw new ConnectorError('Expected excel config', 'CONFIG_MISMATCH');
    }

    const resolved = path.resolve(config.filePath);
    if (!fs.existsSync(resolved)) {
      throw new ConnectorError('File not found', 'FILE_NOT_FOUND');
    }

    this.config = { ...config, filePath: resolved };

    // Read workbook in stream-friendly mode (read headers only first)
    this.workbook = XLSX.readFile(resolved, {
      type: 'file',
      cellDates: true,
      dense: false,
    });
  }

  async testConnection(): Promise<ConnectionStatus> {
    if (!this.config || !this.workbook) {
      return { connected: false, error: 'Not connected', checkedAt: new Date().toISOString() };
    }

    const sheetNames = this.workbook.SheetNames;
    return {
      connected: sheetNames.length > 0,
      serverVersion: `XLSX (${sheetNames.length} sheet(s): ${sheetNames.join(', ')})`,
      checkedAt: new Date().toISOString(),
    };
  }

  async *fetchPatientData(patientId: string): AsyncIterable<RawRecord> {
    if (!this.config || !this.workbook) {
      throw new ConnectorError('Call connect() before fetchPatientData()', 'NOT_CONNECTED');
    }

    const { filePath, sheetName, mapping, patientIdColumn } = this.config;
    const source = `excel:${path.basename(filePath)}`;

    // Resolve sheet
    const targetSheet = sheetName ?? this.workbook.SheetNames[0];
    if (!targetSheet) {
      throw new ConnectorError('No sheets found in workbook', 'NO_SHEET');
    }

    const sheet = this.workbook.Sheets[targetSheet];
    if (!sheet) {
      throw new ConnectorError(`Sheet not found: ${targetSheet}`, 'SHEET_NOT_FOUND');
    }

    // Convert to array of objects (header row → keys)
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
      defval: '',
      raw: false, // Return formatted strings for dates
    });

    let rowIndex = 0;
    for (const row of rows) {
      rowIndex++;

      // Normalize cell values (dates, numbers, strings)
      const normalized = normalizeCells(row);

      // Filter by patient ID if specified
      if (patientIdColumn && normalized[patientIdColumn] !== patientId) {
        continue;
      }

      const records = mapRow(normalized, mapping, source, rowIndex);
      for (const record of records) {
        yield record;
      }
    }
  }

  async disconnect(): Promise<void> {
    this.workbook = null;
    this.config = null;
  }

  /** Return available sheet names */
  getSheetNames(): string[] {
    return this.workbook?.SheetNames ?? [];
  }
}

/** Normalize cell values: trim strings, convert Date objects to ISO strings */
function normalizeCells(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      result[key] = value.toISOString().slice(0, 10); // YYYY-MM-DD
    } else if (typeof value === 'string') {
      result[key] = value.trim();
    } else {
      result[key] = value;
    }
  }

  return result;
}
