/**
 * Column mapping configuration types.
 * Defines how CSV/Excel columns map to FHIR resource fields.
 */

/** Supported transform operations applied to a column value before FHIR mapping */
export type TransformType = 'date' | 'code' | 'string' | 'number';

/**
 * Maps a single source column to a FHIR resource field.
 * Supports optional transforms and code system resolution.
 */
export interface ColumnMapping {
  /** Source column header name */
  sourceColumn: string;
  /** Dot-notation FHIR path (e.g., 'name[0].family', 'birthDate') */
  fhirPath: string;
  /** Target FHIR resource type this mapping belongs to (e.g., 'Patient') */
  resourceType: string;
  /** URI of the code system for coded fields (e.g., 'http://loinc.org') */
  codeSystem?: string;
  /**
   * Transform to apply to the raw value before mapping:
   * - date: parse and normalize to ISO 8601
   * - code: lookup in valueMappings for standardized code
   * - string: trim whitespace
   * - number: parse as float
   */
  transform?: TransformType;
  /** Code value mappings for 'code' transform type */
  valueMappings?: CodeMapping[];
}

/**
 * Maps a source system value to a standardized FHIR code.
 * Used for normalizing local codes to standard terminology.
 */
export interface CodeMapping {
  /** Raw value from the source file */
  sourceValue: string;
  /** Code system URI (e.g., 'http://snomed.info/sct') */
  system: string;
  /** Standardized code value */
  code: string;
  /** Human-readable display text */
  display: string;
}

/** A row after column mapping — groups mapped fields by resource type */
export interface MappedRecord {
  /** FHIR resource type this record maps to */
  resourceType: string;
  /** Mapped field values keyed by FHIR path */
  fields: Record<string, unknown>;
  /** Original source data for debugging (no PHI in logs) */
  sourceRow?: number;
}
