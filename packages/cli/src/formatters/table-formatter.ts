/**
 * Table formatter — aligned CLI tables via cli-table3.
 */

import Table from 'cli-table3';
import chalk from 'chalk';

export interface ColumnDef {
  header: string;
  key: string;
  width?: number;
}

/**
 * Format an array of objects as a CLI table string.
 * @param rows - data rows
 * @param columns - column definitions (header + key into row object)
 */
export function formatTable(rows: Record<string, unknown>[], columns: ColumnDef[]): string {
  const table = new Table({
    head: columns.map((c) => chalk.bold(c.header)),
    colWidths: columns.map((c) => c.width ?? null),
    style: { head: [], border: [] },
    wordWrap: true,
  });

  for (const row of rows) {
    table.push(columns.map((c) => String(row[c.key] ?? '')));
  }

  return table.toString();
}

/**
 * Format a simple key-value record as a two-column table.
 */
export function formatKeyValue(record: Record<string, unknown>): string {
  const table = new Table({
    style: { head: [], border: [] },
  });

  for (const [key, value] of Object.entries(record)) {
    table.push({ [chalk.bold(key)]: String(value) });
  }

  return table.toString();
}
