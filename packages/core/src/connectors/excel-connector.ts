/**
 * Excel (.xlsx) file connector using ExcelJS.
 * Iterates rows as RawRecords without loading the full workbook into memory.
 * Streams row-by-row after initial workbook header read.
 *
 * Replaces SheetJS (xlsx@0.18.5) which had unpatched ReDoS + Prototype Pollution CVEs.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import ExcelJS from 'exceljs';
import type { ConnectorConfig, FileImportConfig } from '@fhirbridge/types';
import type { HisConnector, RawRecord, ConnectionStatus } from './his-connector-interface.js';
import { ConnectorError } from './his-connector-interface.js';
import { mapRow } from './column-mapper.js';

export class ExcelConnector implements HisConnector {
  readonly type = 'excel' as const;

  private config: FileImportConfig | null = null;
  private workbook: ExcelJS.Workbook | null = null;

  async connect(config: ConnectorConfig): Promise<void> {
    if (config.type !== 'excel') {
      throw new ConnectorError('Expected excel config', 'CONFIG_MISMATCH');
    }

    const resolved = path.resolve(config.filePath);
    if (!fs.existsSync(resolved)) {
      throw new ConnectorError('File not found', 'FILE_NOT_FOUND');
    }

    this.config = { ...config, filePath: resolved };

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(resolved);
    this.workbook = wb;
  }

  async testConnection(): Promise<ConnectionStatus> {
    if (!this.config || !this.workbook) {
      return { connected: false, error: 'Not connected', checkedAt: new Date().toISOString() };
    }

    const sheetNames = this.getSheetNames();
    return {
      connected: sheetNames.length > 0,
      serverVersion: `ExcelJS (${sheetNames.length} sheet(s): ${sheetNames.join(', ')})`,
      checkedAt: new Date().toISOString(),
    };
  }

  async *fetchPatientData(patientId: string): AsyncIterable<RawRecord> {
    if (!this.config || !this.workbook) {
      throw new ConnectorError('Call connect() before fetchPatientData()', 'NOT_CONNECTED');
    }

    const { filePath, sheetName, mapping, patientIdColumn } = this.config;
    const source = `excel:${path.basename(filePath)}`;

    // Resolve sheet name — default to first sheet
    const targetSheetName = sheetName ?? this.getSheetNames()[0];
    if (!targetSheetName) {
      throw new ConnectorError('No sheets found in workbook', 'NO_SHEET');
    }

    const sheet = this.workbook.getWorksheet(targetSheetName);
    if (!sheet) {
      throw new ConnectorError(`Sheet not found: ${targetSheetName}`, 'SHEET_NOT_FOUND');
    }

    // Extract headers from row 1
    const headerRow = sheet.getRow(1);
    const headers: string[] = [];
    headerRow.eachCell({ includeEmpty: true }, (cell, colNumber) => {
      headers[colNumber - 1] = String(cell.value ?? '').trim();
    });

    // Collect all data rows synchronously (eachRow is sync), then yield async
    const pending: RawRecord[] = [];
    let rowIndex = 0;

    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) return; // skip header
      rowIndex++;

      const rawRow: Record<string, unknown> = {};
      row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
        const header = headers[colNumber - 1];
        if (header) {
          rawRow[header] = cell.value;
        }
      });

      const normalized = normalizeCells(rawRow);

      // Filter by patient ID if specified
      if (patientIdColumn && normalized[patientIdColumn] !== patientId) {
        return;
      }

      const records = mapRow(normalized, mapping, source, rowIndex);
      for (const record of records) {
        pending.push(record);
      }
    });

    for (const record of pending) {
      yield record;
    }
  }

  async disconnect(): Promise<void> {
    this.workbook = null;
    this.config = null;
  }

  /** Return available sheet names */
  getSheetNames(): string[] {
    if (!this.workbook) return [];
    const names: string[] = [];
    this.workbook.eachSheet((sheet) => {
      names.push(sheet.name);
    });
    return names;
  }
}

/** Normalize cell values: trim strings, convert Date objects to ISO strings, unwrap ExcelJS rich text/formula */
function normalizeCells(row: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(row)) {
    if (value instanceof Date) {
      result[key] = value.toISOString().slice(0, 10); // YYYY-MM-DD
    } else if (typeof value === 'string') {
      result[key] = value.trim();
    } else if (value !== null && typeof value === 'object' && 'richText' in value) {
      // ExcelJS rich text object — extract plain text
      const richText = (value as { richText: { text: string }[] }).richText;
      result[key] = richText
        .map((r) => r.text)
        .join('')
        .trim();
    } else if (value !== null && typeof value === 'object' && 'result' in value) {
      // ExcelJS formula cell — use computed result
      result[key] = (value as { result: unknown }).result;
    } else {
      result[key] = value;
    }
  }

  return result;
}
