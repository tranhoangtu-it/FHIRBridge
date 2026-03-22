/**
 * Column mapper: transforms flat CSV/Excel rows into RawRecords
 * grouped by FHIR resource type using a ColumnMapping configuration.
 */

import type { ColumnMapping, CodeMapping, MappedRecord } from '@fhirbridge/types';
import type { RawRecord } from './his-connector-interface.js';

/** Apply all transforms and group mapped fields by resourceType */
export function mapRow(
  row: Record<string, unknown>,
  mappings: ColumnMapping[],
  source: string,
  rowIndex?: number,
): RawRecord[] {
  // Group mappings by resource type
  const byResourceType = new Map<string, MappedRecord>();

  for (const mapping of mappings) {
    const rawValue = row[mapping.sourceColumn];
    if (rawValue === undefined || rawValue === null || rawValue === '') continue;

    const transformed = applyTransform(rawValue, mapping);
    if (transformed === undefined) continue;

    const { resourceType, fhirPath, codeSystem } = mapping;

    if (!byResourceType.has(resourceType)) {
      byResourceType.set(resourceType, {
        resourceType,
        fields: {},
        sourceRow: rowIndex,
      });
    }

    const record = byResourceType.get(resourceType)!;

    // Wrap coded value in CodeableConcept when codeSystem is specified
    const finalValue = codeSystem
      ? wrapInCodeableConcept(transformed, codeSystem)
      : transformed;

    record.fields[fhirPath] = finalValue;
  }

  // Convert grouped records to RawRecords
  return Array.from(byResourceType.values()).map((mapped) => ({
    resourceType: mapped.resourceType,
    data: mapped.fields,
    source,
  }));
}

/** Apply the configured transform to a raw column value */
function applyTransform(value: unknown, mapping: ColumnMapping): unknown {
  const str = String(value).trim();

  switch (mapping.transform) {
    case 'date':
      return normalizeDate(str);

    case 'code':
      return resolveCode(str, mapping.valueMappings ?? []);

    case 'number': {
      const num = parseFloat(str);
      return isNaN(num) ? undefined : num;
    }

    case 'string':
      return str;

    default:
      // No transform — return as-is (trim strings)
      return typeof value === 'string' ? value.trim() : value;
  }
}

/** Normalize a date string to ISO 8601 YYYY-MM-DD */
function normalizeDate(dateStr: string): string {
  // Already ISO 8601
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;

  // MM/DD/YYYY
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }

  // YYYYMMDD compact
  const compactMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, y, m, d] = compactMatch;
    return `${y}-${m}-${d}`;
  }

  // DD-MM-YYYY
  const dmyMatch = dateStr.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmyMatch) {
    const [, d, m, y] = dmyMatch;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }

  return dateStr;
}

/** Look up a source value in the code mappings list */
function resolveCode(
  sourceValue: string,
  mappings: CodeMapping[],
): { system: string; code: string; display: string } | string {
  const match = mappings.find(
    (m) => m.sourceValue.toLowerCase() === sourceValue.toLowerCase(),
  );

  if (match) {
    return { system: match.system, code: match.code, display: match.display };
  }

  // Return raw value if no mapping found
  return sourceValue;
}

/** Wrap a code value in a FHIR CodeableConcept */
function wrapInCodeableConcept(
  value: unknown,
  codeSystem: string,
): Record<string, unknown> {
  if (typeof value === 'object' && value !== null && 'system' in value) {
    // Already a coded object from resolveCode
    const coded = value as { system: string; code: string; display: string };
    return {
      coding: [{ system: coded.system, code: coded.code, display: coded.display }],
      text: coded.display,
    };
  }

  return {
    coding: [{ system: codeSystem, code: String(value) }],
    text: String(value),
  };
}
