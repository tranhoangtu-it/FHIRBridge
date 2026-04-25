/**
 * FHIR R4 Immunization resource validator.
 * Validates Immunization-specific required and must-support fields.
 * Does NOT log PHI — only field paths are included in error messages.
 * Spec: https://hl7.org/fhir/R4/immunization.html
 */

import type { ValidationResult, ValidationError } from '@fhirbridge/types';
import { validateResource } from './resource-validator.js';

/** Giá trị hợp lệ cho Immunization.status (FHIR R4 §Immunization.status ValueSet) */
const VALID_STATUSES = new Set(['completed', 'entered-in-error', 'not-done']);

/**
 * Hệ thống mã vaccine được hỗ trợ.
 * CVX: tiêu chuẩn US của CDC; SNOMED CT: quốc tế / Việt Nam / Nhật Bản
 */
const SUPPORTED_VACCINE_SYSTEMS = new Set([
  'http://hl7.org/fhir/sid/cvx', // CDC CVX (US)
  'http://snomed.info/sct', // SNOMED CT (quốc tế)
  'urn:oid:2.16.840.1.113883.12.292', // CVX OID
]);

/**
 * Kiểm tra reference có hợp lệ không (relative hoặc urn:uuid).
 * Chỉ kiểm tra nếu reference.reference được cung cấp.
 */
function hasValidReference(ref: unknown): boolean {
  if (!ref || typeof ref !== 'object') return false;
  const r = ref as Record<string, unknown>;
  // Phải có ít nhất một trong: reference, identifier, display
  if (r['reference'] === undefined && r['identifier'] === undefined && r['display'] === undefined) {
    return false;
  }
  if (r['reference'] !== undefined && typeof r['reference'] !== 'string') {
    return false;
  }
  return true;
}

/**
 * Validate a FHIR R4 Immunization resource.
 *
 * Required fields:
 *   - status (FHIR R4 §Immunization.status)
 *   - vaccineCode (FHIR R4 §Immunization.vaccineCode)
 *   - patient (FHIR R4 §Immunization.patient)
 *   - occurrence[x]: exactly one of occurrenceDateTime | occurrenceString
 */
export function validateImmunization(resource: unknown): ValidationResult {
  const baseResult = validateResource(resource);
  const errors: ValidationError[] = [...baseResult.errors];

  if (!resource || typeof resource !== 'object') {
    return { valid: false, errors };
  }

  const r = resource as Record<string, unknown>;

  // ── resourceType ──────────────────────────────────────────────────────────
  if (r['resourceType'] !== 'Immunization') {
    errors.push({
      path: 'resourceType',
      message: 'resourceType must be "Immunization"',
      severity: 'error',
    });
  }

  // ── status (required) ─────────────────────────────────────────────────────
  if (r['status'] === undefined || r['status'] === null) {
    errors.push({
      path: 'status',
      message: 'Immunization.status is required (FHIR R4 §Immunization.status)',
      severity: 'error',
    });
  } else if (!VALID_STATUSES.has(r['status'] as string)) {
    errors.push({
      path: 'status',
      message: 'Immunization.status must be one of: completed, entered-in-error, not-done',
      severity: 'error',
    });
  }

  // ── vaccineCode (required) ────────────────────────────────────────────────
  if (r['vaccineCode'] === undefined || r['vaccineCode'] === null) {
    errors.push({
      path: 'vaccineCode',
      message: 'Immunization.vaccineCode is required (FHIR R4 §Immunization.vaccineCode)',
      severity: 'error',
    });
  } else if (typeof r['vaccineCode'] !== 'object' || Array.isArray(r['vaccineCode'])) {
    errors.push({
      path: 'vaccineCode',
      message: 'Immunization.vaccineCode must be a CodeableConcept object',
      severity: 'error',
    });
  } else {
    const vc = r['vaccineCode'] as Record<string, unknown>;
    const hasCoding = Array.isArray(vc['coding']) && vc['coding'].length > 0;
    const hasText = typeof vc['text'] === 'string' && vc['text'].trim() !== '';

    if (!hasCoding && !hasText) {
      errors.push({
        path: 'vaccineCode',
        message: 'Immunization.vaccineCode must have at least one coding or a text value',
        severity: 'error',
      });
    }

    // Khuyến nghị dùng CVX hoặc SNOMED CT
    if (hasCoding) {
      const codings = vc['coding'] as Record<string, unknown>[];
      const hasKnownSystem = codings.some(
        (c) => c && typeof c['system'] === 'string' && SUPPORTED_VACCINE_SYSTEMS.has(c['system']),
      );
      if (!hasKnownSystem) {
        errors.push({
          path: 'vaccineCode.coding[].system',
          message:
            'Immunization.vaccineCode.coding should use CVX (http://hl7.org/fhir/sid/cvx) or SNOMED CT system',
          severity: 'warning',
        });
      }
    }
  }

  // ── patient (required) ────────────────────────────────────────────────────
  if (r['patient'] === undefined || r['patient'] === null) {
    errors.push({
      path: 'patient',
      message: 'Immunization.patient is required (FHIR R4 §Immunization.patient)',
      severity: 'error',
    });
  } else if (!hasValidReference(r['patient'])) {
    errors.push({
      path: 'patient',
      message: 'Immunization.patient must be a valid Reference object',
      severity: 'error',
    });
  }

  // ── occurrence[x] choice enforcement (FHIR R4 §Immunization.occurrence[x]) ─
  // Phải có đúng một trong: occurrenceDateTime hoặc occurrenceString
  const hasDateTime = r['occurrenceDateTime'] !== undefined && r['occurrenceDateTime'] !== null;
  const hasString = r['occurrenceString'] !== undefined && r['occurrenceString'] !== null;

  if (hasDateTime && hasString) {
    errors.push({
      path: 'occurrence[x]',
      message:
        'Immunization.occurrence[x] violates choice: both occurrenceDateTime and occurrenceString present ' +
        '(FHIR R4 §Immunization.occurrence[x] — exactly one required)',
      severity: 'error',
    });
  } else if (!hasDateTime && !hasString) {
    errors.push({
      path: 'occurrence[x]',
      message:
        'Immunization.occurrence[x] is required: exactly one of occurrenceDateTime or occurrenceString must be present',
      severity: 'error',
    });
  }

  // ── performer (optional) — mỗi entry cần actor ───────────────────────────
  if (r['performer'] !== undefined) {
    if (!Array.isArray(r['performer'])) {
      errors.push({
        path: 'performer',
        message: 'Immunization.performer must be an array',
        severity: 'error',
      });
    } else {
      const performers = r['performer'] as unknown[];
      performers.forEach((p, i) => {
        if (!p || typeof p !== 'object') {
          errors.push({
            path: `performer[${i}]`,
            message: 'Each performer entry must be an object',
            severity: 'error',
          });
          return;
        }
        const perf = p as Record<string, unknown>;
        // actor là required trong performer
        if (perf['actor'] === undefined || perf['actor'] === null) {
          errors.push({
            path: `performer[${i}].actor`,
            message: 'Immunization.performer[].actor is required',
            severity: 'error',
          });
        } else if (!hasValidReference(perf['actor'])) {
          errors.push({
            path: `performer[${i}].actor`,
            message: 'Immunization.performer[].actor must be a valid Reference',
            severity: 'error',
          });
        }
      });
    }
  }

  // ── protocolApplied (optional) — kiểm tra cơ bản ─────────────────────────
  if (r['protocolApplied'] !== undefined) {
    if (!Array.isArray(r['protocolApplied'])) {
      errors.push({
        path: 'protocolApplied',
        message: 'Immunization.protocolApplied must be an array',
        severity: 'error',
      });
    } else {
      const protocols = r['protocolApplied'] as unknown[];
      protocols.forEach((proto, i) => {
        if (!proto || typeof proto !== 'object') {
          errors.push({
            path: `protocolApplied[${i}]`,
            message: 'Each protocolApplied entry must be an object',
            severity: 'error',
          });
          return;
        }
        const p = proto as Record<string, unknown>;
        // doseNumberPositiveInt phải là số nguyên dương nếu có
        if (p['doseNumberPositiveInt'] !== undefined) {
          const dose = p['doseNumberPositiveInt'];
          if (typeof dose !== 'number' || !Number.isInteger(dose) || dose < 1) {
            errors.push({
              path: `protocolApplied[${i}].doseNumberPositiveInt`,
              message: 'protocolApplied[].doseNumberPositiveInt must be a positive integer',
              severity: 'error',
            });
          }
        }
      });
    }
  }

  const hasErrors = errors.some((e) => e.severity === 'error');
  return { valid: !hasErrors, errors };
}
