/**
 * Tests for reference-validator: FHIR Reference format and bundle resolution.
 */

import { describe, it, expect } from 'vitest';
import { validateReference, validateReferenceInBundle } from '../reference-validator.js';
import type { Bundle } from '@fhirbridge/types';

// ── Helpers ────────────────────────────────────────────────────────────────────

function makeBundle(entries: Bundle['entry'] = []): Bundle {
  return {
    resourceType: 'Bundle',
    type: 'collection',
    entry: entries,
  };
}

describe('validateReference', () => {
  describe('valid reference formats', () => {
    it('accepts urn:uuid format', () => {
      const result = validateReference({
        reference: 'urn:uuid:550e8400-e29b-41d4-a716-446655440000',
      });
      expect(result.valid).toBe(true);
      expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
    });

    it('accepts relative reference (ResourceType/id)', () => {
      const result = validateReference({ reference: 'Patient/123' });
      expect(result.valid).toBe(true);
    });

    it('accepts absolute URL with http://', () => {
      const result = validateReference({
        reference: 'http://hapi.fhir.org/baseR4/Patient/123',
      });
      expect(result.valid).toBe(true);
    });

    it('accepts absolute URL with https://', () => {
      const result = validateReference({
        reference: 'https://hapi.fhir.org/baseR4/Observation/obs-001',
      });
      expect(result.valid).toBe(true);
    });

    it('accepts reference with identifier only (no reference string)', () => {
      const result = validateReference({ identifier: { value: 'MRN-12345' } });
      expect(result.valid).toBe(true);
    });

    it('accepts reference with display only', () => {
      const result = validateReference({ display: 'Dr. Jane Smith' });
      expect(result.valid).toBe(true);
    });
  });

  describe('invalid reference formats', () => {
    it('fails for empty reference string', () => {
      const result = validateReference({ reference: '' });
      expect(result.valid).toBe(false);
      const errors = result.errors.filter((e) => e.severity === 'error');
      expect(errors.some((e) => e.path.includes('.reference'))).toBe(true);
    });

    it('fails when reference object is null', () => {
      const result = validateReference(null);
      expect(result.valid).toBe(false);
    });

    it('fails for non-object input', () => {
      const result = validateReference('Patient/123');
      expect(result.valid).toBe(false);
    });

    it('fails when no fields provided at all', () => {
      const result = validateReference({});
      expect(result.valid).toBe(false);
      const errors = result.errors.filter((e) => e.severity === 'error');
      expect(errors.some((e) => e.message.includes('at least one of'))).toBe(true);
    });

    it('fails for malformed reference (missing ResourceType)', () => {
      const result = validateReference({ reference: '/123' });
      expect(result.valid).toBe(false);
    });
  });
});

describe('validateReferenceInBundle', () => {
  it('passes when urn:uuid reference found in bundle fullUrl', () => {
    const uuid = 'urn:uuid:550e8400-e29b-41d4-a716-446655440000';
    const bundle = makeBundle([
      {
        fullUrl: uuid,
        resource: {
          resourceType: 'Patient',
          id: 'p-001',
        } as unknown as Bundle['entry'] extends (infer E)[]
          ? E extends { resource?: infer R }
            ? R
            : never
          : never,
      },
    ]);

    const result = validateReferenceInBundle({ reference: uuid }, bundle);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('passes when relative reference resolved by resourceType and id', () => {
    const bundle = makeBundle([
      {
        fullUrl: 'urn:uuid:abc',
        resource: {
          resourceType: 'Patient',
          id: 'p-001',
        } as unknown as Bundle['entry'] extends (infer E)[]
          ? E extends { resource?: infer R }
            ? R
            : never
          : never,
      },
    ]);

    const result = validateReferenceInBundle({ reference: 'Patient/p-001' }, bundle);
    expect(result.valid).toBe(true);
    const warnings = result.errors.filter((e) => e.severity === 'warning');
    // No unresolved warning — resource found
    expect(warnings.some((w) => w.message.includes('could not be resolved'))).toBe(false);
  });

  it('adds warning for urn:uuid not found in bundle', () => {
    const bundle = makeBundle([]);
    const uuid = 'urn:uuid:550e8400-e29b-41d4-a716-446655440000';

    const result = validateReferenceInBundle({ reference: uuid }, bundle);
    expect(result.valid).toBe(true); // still valid — unresolved is a warning
    const warnings = result.errors.filter((e) => e.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('could not be resolved'))).toBe(true);
  });

  it('adds warning for relative reference not found in bundle', () => {
    const bundle = makeBundle([
      {
        fullUrl: 'urn:uuid:abc',
        resource: {
          resourceType: 'Patient',
          id: 'other-id',
        } as unknown as Bundle['entry'] extends (infer E)[]
          ? E extends { resource?: infer R }
            ? R
            : never
          : never,
      },
    ]);

    const result = validateReferenceInBundle({ reference: 'Patient/missing-id' }, bundle);
    const warnings = result.errors.filter((e) => e.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('could not be resolved'))).toBe(true);
  });

  it('does not attempt bundle resolution for absolute URL references', () => {
    const bundle = makeBundle([]);
    const result = validateReferenceInBundle(
      { reference: 'https://hapi.fhir.org/baseR4/Patient/123' },
      bundle,
    );

    // Absolute URLs skip resolution — no "not found" warning
    const warnings = result.errors.filter((e) => e.severity === 'warning');
    expect(warnings.some((w) => w.message.includes('could not be resolved'))).toBe(false);
  });

  it('propagates errors from validateReference for invalid input', () => {
    const bundle = makeBundle([]);
    const result = validateReferenceInBundle({ reference: '' }, bundle);
    expect(result.valid).toBe(false);
  });
});
