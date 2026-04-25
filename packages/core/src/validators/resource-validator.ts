/**
 * Base FHIR resource validator.
 * Validates common fields present on all FHIR resources.
 * Does NOT log resource content — only field paths are referenced in errors.
 *
 * Includes FHIR R4 §MedicationRequest medication[x] choice enforcement:
 * exactly one of medicationCodeableConcept | medicationReference must be present.
 */

import type { Resource, ValidationResult, ValidationError } from '@fhirbridge/types';

/** UUID v4 pattern (with or without urn:uuid: prefix) */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** urn:uuid pattern for fullUrl references */
const URN_UUID_PATTERN =
  /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** Relative reference pattern (e.g., Patient/123) */
const RELATIVE_REF_PATTERN = /^[A-Z][a-zA-Z]+\/[^/\s]+$/;

/** ISO 8601 date pattern (YYYY-MM-DD) */
const DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;

/** ISO 8601 datetime pattern */
const DATETIME_PATTERN = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:?\d{2})?)?$/;

/** Known FHIR R4 resource types */
const KNOWN_RESOURCE_TYPES = new Set([
  'Patient',
  'Encounter',
  'Condition',
  'Observation',
  'MedicationRequest',
  'AllergyIntolerance',
  'Procedure',
  'DiagnosticReport',
  'Bundle',
  'Composition',
  'Practitioner',
  'Organization',
  'Location',
  'Device',
  'Medication',
  'Immunization',
  'CarePlan',
  'CareTeam',
  'Goal',
  'ServiceRequest',
]);

/**
 * Enforce FHIR R4 §MedicationRequest medication[x] choice constraint.
 * Exactly one of medicationCodeableConcept | medicationReference must be present.
 * @returns ValidationError nếu vi phạm, null nếu hợp lệ
 */
function validateMedicationChoice(res: Record<string, unknown>): ValidationError | null {
  const hasCC = res['medicationCodeableConcept'] != null;
  const hasRef = res['medicationReference'] != null;

  if (hasCC && hasRef) {
    return {
      path: 'medication[x]',
      message:
        'MedicationRequest.medication[x] violates choice: both medicationCodeableConcept and ' +
        'medicationReference present (FHIR R4 §MedicationRequest)',
      severity: 'error',
    };
  }
  if (!hasCC && !hasRef) {
    return {
      path: 'medication[x]',
      message:
        'MedicationRequest.medication[x] is required: either medicationCodeableConcept or ' +
        'medicationReference must be present',
      severity: 'error',
    };
  }
  return null;
}

/**
 * Validate a base FHIR resource for common structural requirements.
 * Checks: resourceType, id format, meta structure.
 */
export function validateResource(resource: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (!resource || typeof resource !== 'object') {
    errors.push({
      path: '$',
      message: 'Resource must be a non-null object',
      severity: 'error',
    });
    return { valid: false, errors };
  }

  const res = resource as Record<string, unknown>;

  // Check resourceType
  if (!res['resourceType']) {
    errors.push({ path: 'resourceType', message: 'resourceType is required', severity: 'error' });
  } else if (typeof res['resourceType'] !== 'string') {
    errors.push({
      path: 'resourceType',
      message: 'resourceType must be a string',
      severity: 'error',
    });
  } else if (!KNOWN_RESOURCE_TYPES.has(res['resourceType'] as string)) {
    errors.push({
      path: 'resourceType',
      message: `Unknown resourceType — not a recognized FHIR R4 resource`,
      severity: 'warning',
    });
  }

  // Check id format if present
  if (res['id'] !== undefined) {
    if (typeof res['id'] !== 'string') {
      errors.push({ path: 'id', message: 'id must be a string', severity: 'error' });
    } else if (res['id'].trim() === '') {
      errors.push({ path: 'id', message: 'id must not be empty', severity: 'error' });
    }
  }

  // Check meta structure if present
  if (res['meta'] !== undefined) {
    if (typeof res['meta'] !== 'object' || res['meta'] === null) {
      errors.push({ path: 'meta', message: 'meta must be an object', severity: 'error' });
    } else {
      const meta = res['meta'] as Record<string, unknown>;
      if (meta['lastUpdated'] !== undefined && typeof meta['lastUpdated'] !== 'string') {
        errors.push({
          path: 'meta.lastUpdated',
          message: 'meta.lastUpdated must be a string',
          severity: 'warning',
        });
      }
      if (meta['lastUpdated'] && typeof meta['lastUpdated'] === 'string') {
        if (!DATETIME_PATTERN.test(meta['lastUpdated'])) {
          errors.push({
            path: 'meta.lastUpdated',
            message: 'meta.lastUpdated must be a valid datetime',
            severity: 'warning',
          });
        }
      }
    }
  }

  // ── Resource-specific choice enforcement ────────────────────────────────────
  // MedicationRequest: medication[x] choice (FHIR R4 §MedicationRequest)
  if (res['resourceType'] === 'MedicationRequest') {
    const choiceError = validateMedicationChoice(res);
    if (choiceError) errors.push(choiceError);
  }

  const hasErrors = errors.some((e) => e.severity === 'error');
  return { valid: !hasErrors, errors };
}

/** Exported patterns for reuse in child validators */
export const patterns = {
  UUID: UUID_PATTERN,
  URN_UUID: URN_UUID_PATTERN,
  RELATIVE_REF: RELATIVE_REF_PATTERN,
  DATE: DATE_PATTERN,
  DATETIME: DATETIME_PATTERN,
};
