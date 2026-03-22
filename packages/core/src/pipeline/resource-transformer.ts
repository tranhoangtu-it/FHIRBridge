/**
 * Raw data to FHIR resource transformer.
 * Maps arbitrary key-value records to typed FHIR R4 resources.
 */

import type { Resource } from '@fhirbridge/types';

/** A raw record from a source system (HIS, CSV, etc.) */
export type RawRecord = Record<string, unknown>;

/**
 * Custom field mapping config.
 * Keys are source field names; values are FHIR paths (dot notation).
 * Example: { 'pt_name_family': 'name[0].family', 'dob': 'birthDate' }
 */
export type MappingConfig = Record<string, string>;

/**
 * Transform raw HIS data into a FHIR Resource.
 *
 * Default behavior: direct field-name match.
 * Custom mapping: use mappingConfig to rename fields and flatten paths.
 *
 * @param rawData - Source record from HIS or CSV
 * @param resourceType - Target FHIR resource type (e.g., 'Patient')
 * @param mappingConfig - Optional field remapping
 */
export function transformToFhir(
  rawData: RawRecord,
  resourceType: string,
  mappingConfig?: MappingConfig,
): Resource {
  const result: RawRecord = { resourceType };

  if (!mappingConfig) {
    // Default: direct field-name copy with date normalization
    for (const [key, value] of Object.entries(rawData)) {
      result[key] = normalizeValue(key, value);
    }
    return result as unknown as Resource;
  }

  // Custom mapping: apply the mapping config
  for (const [sourceField, fhirPath] of Object.entries(mappingConfig)) {
    if (!(sourceField in rawData)) continue;

    const value = normalizeValue(fhirPath, rawData[sourceField]);
    setNestedValue(result, fhirPath, value);
  }

  return result as unknown as Resource;
}

/**
 * Normalize a field value based on its FHIR path.
 * Handles date format normalization and boolean coercion.
 */
function normalizeValue(fieldPath: string, value: unknown): unknown {
  if (value === null || value === undefined) return undefined;

  // Normalize date fields to ISO 8601
  const dateFields = ['birthDate', 'recordedDate', 'onsetDateTime', 'authoredOn'];
  if (dateFields.some((f) => fieldPath.endsWith(f)) && typeof value === 'string') {
    return normalizeDate(value);
  }

  // Coerce boolean strings
  if (value === 'true') return true;
  if (value === 'false') return false;

  return value;
}

/**
 * Normalize a date string to ISO 8601 YYYY-MM-DD.
 * Handles common formats: MM/DD/YYYY, DD-MM-YYYY, YYYYMMDD.
 */
function normalizeDate(dateStr: string): string {
  // Already ISO 8601
  if (/^\d{4}-\d{2}-\d{2}/.test(dateStr)) return dateStr;

  // MM/DD/YYYY
  const mdyMatch = dateStr.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdyMatch) {
    const [, m, d, y] = mdyMatch;
    return `${y}-${m!.padStart(2, '0')}-${d!.padStart(2, '0')}`;
  }

  // YYYYMMDD
  const compactMatch = dateStr.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (compactMatch) {
    const [, y, m, d] = compactMatch;
    return `${y}-${m}-${d}`;
  }

  // Return as-is if unrecognized
  return dateStr;
}

/**
 * Set a value at a dot-notation path on an object.
 * Supports simple paths like 'name[0].family'.
 */
function setNestedValue(obj: RawRecord, path: string, value: unknown): void {
  // Split on dots, handling array notation like name[0]
  const segments = path.split('.');
  let current: RawRecord = obj;

  for (let i = 0; i < segments.length - 1; i++) {
    const segment = segments[i]!;
    const { key, index } = parseSegment(segment);

    if (index !== undefined) {
      if (!Array.isArray(current[key])) current[key] = [];
      const arr = current[key] as RawRecord[];
      if (!arr[index]) arr[index] = {};
      current = arr[index]!;
    } else {
      if (!current[key] || typeof current[key] !== 'object') current[key] = {};
      current = current[key] as RawRecord;
    }
  }

  const lastSegment = segments[segments.length - 1]!;
  const { key, index } = parseSegment(lastSegment);

  if (index !== undefined) {
    if (!Array.isArray(current[key])) current[key] = [];
    (current[key] as unknown[])[index] = value;
  } else {
    current[key] = value;
  }
}

/** Parse a path segment like 'name[0]' into { key: 'name', index: 0 } */
function parseSegment(segment: string): { key: string; index?: number } {
  const match = segment.match(/^([^[]+)\[(\d+)\]$/);
  if (match) {
    return { key: match[1]!, index: parseInt(match[2]!, 10) };
  }
  return { key: segment };
}
