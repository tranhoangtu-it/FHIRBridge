/**
 * Tests for table-formatter — aligned CLI tables via cli-table3.
 */

import { describe, it, expect } from 'vitest';
import { formatTable, formatKeyValue } from '../table-formatter.js';
import type { ColumnDef } from '../table-formatter.js';

const COLUMNS: ColumnDef[] = [
  { header: 'Name', key: 'name', width: 20 },
  { header: 'Type', key: 'type', width: 15 },
  { header: 'URL', key: 'url', width: 40 },
];

describe('formatTable', () => {
  it('returns a non-empty string', () => {
    const rows = [{ name: 'local-hapi', type: 'fhir-endpoint', url: 'http://localhost:8080' }];
    const result = formatTable(rows, COLUMNS);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes column headers in output', () => {
    const rows = [{ name: 'test', type: 'csv', url: '' }];
    const result = formatTable(rows, COLUMNS);
    // Headers may contain chalk escape codes, check for base text
    expect(result).toMatch(/Name/);
    expect(result).toMatch(/Type/);
    expect(result).toMatch(/URL/);
  });

  it('includes row data in output', () => {
    const rows = [{ name: 'my-server', type: 'fhir-endpoint', url: 'http://hapi.fhir.org' }];
    const result = formatTable(rows, COLUMNS);
    expect(result).toContain('my-server');
    expect(result).toContain('fhir-endpoint');
    expect(result).toContain('http://hapi.fhir.org');
  });

  it('handles empty rows array without error', () => {
    const result = formatTable([], COLUMNS);
    expect(typeof result).toBe('string');
    // Still has headers
    expect(result).toMatch(/Name/);
  });

  it('handles multiple rows', () => {
    const rows = [
      { name: 'alpha', type: 'fhir-endpoint', url: 'http://alpha.org' },
      { name: 'beta', type: 'csv', url: '' },
      { name: 'gamma', type: 'epic', url: 'http://epic.org' },
    ];
    const result = formatTable(rows, COLUMNS);
    expect(result).toContain('alpha');
    expect(result).toContain('beta');
    expect(result).toContain('gamma');
  });

  it('handles missing row fields gracefully', () => {
    const rows = [{ name: 'sparse' }] as Record<string, unknown>[];
    const result = formatTable(rows, COLUMNS);
    expect(result).toContain('sparse');
    // Missing fields rendered as empty string
    expect(typeof result).toBe('string');
  });
});

describe('formatKeyValue', () => {
  it('returns a non-empty string', () => {
    const result = formatKeyValue({ defaultProvider: 'claude', defaultLanguage: 'en' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });

  it('includes key names in output', () => {
    const result = formatKeyValue({ defaultProvider: 'claude', defaultLanguage: 'vi' });
    expect(result).toMatch(/defaultProvider/);
    expect(result).toMatch(/defaultLanguage/);
  });

  it('includes values in output', () => {
    const result = formatKeyValue({ defaultProvider: 'openai', defaultLanguage: 'ja' });
    expect(result).toContain('openai');
    expect(result).toContain('ja');
  });

  it('handles empty record without error', () => {
    const result = formatKeyValue({});
    expect(typeof result).toBe('string');
  });

  it('handles numeric and boolean values', () => {
    const result = formatKeyValue({ count: 42, enabled: true });
    expect(result).toContain('42');
    expect(result).toContain('true');
  });
});
