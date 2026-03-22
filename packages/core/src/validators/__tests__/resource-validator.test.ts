/**
 * Tests for the base FHIR resource validator.
 * Uses realistic FHIR R4 resource shapes (no PHI).
 */

import { describe, it, expect } from 'vitest';
import { validateResource } from '../resource-validator.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const validPatientResource = {
  resourceType: 'Patient',
  id: 'test-patient-001',
  meta: {
    versionId: '1',
    lastUpdated: '2024-01-15T10:30:00Z',
  },
  name: [{ family: 'Smith', given: ['John'] }],
};

const validObservationResource = {
  resourceType: 'Observation',
  id: 'obs-001',
  status: 'final',
  code: { coding: [{ system: 'http://loinc.org', code: '8310-5', display: 'Body temperature' }] },
  subject: { reference: 'urn:uuid:a7e3f001-1234-4321-abcd-fedcba987654' },
};

// ── Test: Valid resources ─────────────────────────────────────────────────────

describe('validateResource', () => {
  it('returns valid for a well-formed Patient resource', () => {
    const result = validateResource(validPatientResource);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid for a well-formed Observation resource', () => {
    const result = validateResource(validObservationResource);
    expect(result.valid).toBe(true);
  });

  it('returns valid for resource with no id (id is optional)', () => {
    const result = validateResource({ resourceType: 'Condition' });
    expect(result.valid).toBe(true);
  });

  // ── Test: Missing required fields ─────────────────────────────────────────

  it('returns invalid when resource is null', () => {
    const result = validateResource(null);
    expect(result.valid).toBe(false);
    expect(result.errors[0]?.severity).toBe('error');
  });

  it('returns invalid when resource is not an object', () => {
    const result = validateResource('not-an-object');
    expect(result.valid).toBe(false);
  });

  it('returns error when resourceType is missing', () => {
    const result = validateResource({ id: 'test' });
    const errors = result.errors.filter((e) => e.path === 'resourceType' && e.severity === 'error');
    expect(errors).toHaveLength(1);
    expect(result.valid).toBe(false);
  });

  it('returns error when resourceType is not a string', () => {
    const result = validateResource({ resourceType: 42 });
    expect(result.valid).toBe(false);
  });

  it('returns warning for unknown resourceType', () => {
    const result = validateResource({ resourceType: 'UnknownFhirResource' });
    const warnings = result.errors.filter((e) => e.severity === 'warning' && e.path === 'resourceType');
    expect(warnings.length).toBeGreaterThan(0);
    // Should still be valid (only errors invalidate)
    expect(result.valid).toBe(true);
  });

  // ── Test: id validation ───────────────────────────────────────────────────

  it('returns error when id is not a string', () => {
    const result = validateResource({ resourceType: 'Patient', id: 123 });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'id')).toBe(true);
  });

  it('returns error when id is empty string', () => {
    const result = validateResource({ resourceType: 'Patient', id: '' });
    expect(result.valid).toBe(false);
  });

  // ── Test: meta validation ─────────────────────────────────────────────────

  it('returns error when meta is not an object', () => {
    const result = validateResource({ resourceType: 'Patient', meta: 'invalid' });
    expect(result.valid).toBe(false);
  });

  it('returns warning when meta.lastUpdated is not a valid datetime', () => {
    const result = validateResource({ resourceType: 'Patient', meta: { lastUpdated: 'not-a-date' } });
    const warnings = result.errors.filter((e) => e.path === 'meta.lastUpdated' && e.severity === 'warning');
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('accepts valid ISO 8601 datetime in meta.lastUpdated', () => {
    const result = validateResource({
      resourceType: 'Patient',
      meta: { lastUpdated: '2024-03-15T14:22:33+05:30' },
    });
    expect(result.errors.filter((e) => e.path === 'meta.lastUpdated')).toHaveLength(0);
  });
});
