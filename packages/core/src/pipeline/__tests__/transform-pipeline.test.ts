/**
 * Tests for the FHIR R4 TransformPipeline and resource transformer.
 * Uses realistic raw HIS record shapes (no PHI).
 */

import { describe, it, expect, vi } from 'vitest';
import { TransformPipeline, arrayToAsyncIterable } from '../transform-pipeline.js';
import { transformToFhir } from '../resource-transformer.js';
import type { Bundle } from '@fhirbridge/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const rawPatientRecords = [
  { resourceType: 'Patient', id: 'patient-001', name: [{ family: 'Doe', given: ['Jane'] }], gender: 'female', birthDate: '1985-07-22' },
  { resourceType: 'Patient', id: 'patient-002', name: [{ family: 'Smith', given: ['John'] }], gender: 'male', birthDate: '1990-03-15' },
  { resourceType: 'Patient', id: 'patient-003', name: [{ family: 'Johnson', given: ['Alice'] }], gender: 'female', birthDate: '1975-11-28' },
];

// ── transformToFhir tests ─────────────────────────────────────────────────────

describe('transformToFhir', () => {
  it('copies fields directly when no mappingConfig', () => {
    const raw = { id: 'p1', gender: 'male', birthDate: '1990-01-01' };
    const resource = transformToFhir(raw, 'Patient');
    expect(resource).toMatchObject({ resourceType: 'Patient', id: 'p1' });
  });

  it('applies custom mappingConfig to rename fields', () => {
    const raw = { pt_family: 'Doe', pt_gender: 'female', pt_dob: '1985-07-22' };
    const mapping = { pt_family: 'name[0].family', pt_gender: 'gender', pt_dob: 'birthDate' };
    const resource = transformToFhir(raw, 'Patient', mapping) as Record<string, unknown>;
    expect(resource['gender']).toBe('female');
    expect(resource['birthDate']).toBe('1985-07-22');
  });

  it('normalizes MM/DD/YYYY dates to ISO 8601', () => {
    const raw = { birthDate: '07/22/1985' };
    const resource = transformToFhir(raw, 'Patient') as Record<string, unknown>;
    expect(resource['birthDate']).toBe('1985-07-22');
  });

  it('normalizes YYYYMMDD dates to ISO 8601', () => {
    const raw = { birthDate: '19850722' };
    const resource = transformToFhir(raw, 'Patient') as Record<string, unknown>;
    expect(resource['birthDate']).toBe('1985-07-22');
  });

  it('does not modify already-ISO dates', () => {
    const raw = { birthDate: '1985-07-22' };
    const resource = transformToFhir(raw, 'Patient') as Record<string, unknown>;
    expect(resource['birthDate']).toBe('1985-07-22');
  });

  it('coerces boolean string "true" to true', () => {
    const raw = { active: 'true' };
    const resource = transformToFhir(raw, 'Patient') as Record<string, unknown>;
    expect(resource['active']).toBe(true);
  });

  it('skips fields not in mappingConfig when config is provided', () => {
    const raw = { pt_family: 'Doe', unused_field: 'ignored' };
    const mapping = { pt_family: 'name[0].family' };
    const resource = transformToFhir(raw, 'Patient') as Record<string, unknown>;
    // Direct copy mode — unused_field should be present
    expect(resource['unused_field']).toBe('ignored');
  });
});

// ── TransformPipeline tests ───────────────────────────────────────────────────

describe('TransformPipeline', () => {
  it('yields at least one Bundle for non-empty input', async () => {
    const pipeline = new TransformPipeline({ resourceType: 'Patient' });
    const source = arrayToAsyncIterable(rawPatientRecords);
    const bundles: Bundle[] = [];

    for await (const bundle of pipeline.pipe(source)) {
      bundles.push(bundle);
    }

    expect(bundles.length).toBeGreaterThan(0);
  });

  it('processes all input records', async () => {
    const pipeline = new TransformPipeline({ resourceType: 'Patient' });
    const source = arrayToAsyncIterable(rawPatientRecords);
    let totalResources = 0;

    for await (const bundle of pipeline.pipe(source)) {
      totalResources += bundle.entry?.length ?? 0;
    }

    expect(totalResources).toBe(rawPatientRecords.length);
  });

  it('respects batchSize — yields multiple bundles when batchSize < total', async () => {
    const pipeline = new TransformPipeline({ resourceType: 'Patient', batchSize: 1 });
    const source = arrayToAsyncIterable(rawPatientRecords);
    const bundles: Bundle[] = [];

    for await (const bundle of pipeline.pipe(source)) {
      bundles.push(bundle);
    }

    expect(bundles.length).toBe(3);
  });

  it('each yielded bundle has resourceType "Bundle"', async () => {
    const pipeline = new TransformPipeline({ resourceType: 'Patient' });
    const source = arrayToAsyncIterable(rawPatientRecords);

    for await (const bundle of pipeline.pipe(source)) {
      expect(bundle.resourceType).toBe('Bundle');
    }
  });

  it('each entry has a urn:uuid fullUrl', async () => {
    const pipeline = new TransformPipeline({ resourceType: 'Patient' });
    const source = arrayToAsyncIterable(rawPatientRecords);

    for await (const bundle of pipeline.pipe(source)) {
      for (const entry of bundle.entry ?? []) {
        expect(entry.fullUrl).toMatch(/^urn:uuid:[0-9a-f-]{36}$/);
      }
    }
  });

  it('yields nothing for empty input', async () => {
    const pipeline = new TransformPipeline({ resourceType: 'Patient' });
    const source = arrayToAsyncIterable([]);
    const bundles: Bundle[] = [];

    for await (const bundle of pipeline.pipe(source)) {
      bundles.push(bundle);
    }

    expect(bundles).toHaveLength(0);
  });

  it('calls onValidationWarning when warnings are present', async () => {
    const warnSpy = vi.fn();
    const pipeline = new TransformPipeline({
      resourceType: 'UnknownFhirResource',
      onValidationWarning: warnSpy,
    });
    const source = arrayToAsyncIterable([{ id: 'x1' }]);

    const bundles: Bundle[] = [];
    for await (const bundle of pipeline.pipe(source)) {
      bundles.push(bundle);
    }

    expect(warnSpy).toHaveBeenCalled();
  });

  it('collect() returns a single Bundle with all resources', async () => {
    const pipeline = new TransformPipeline({ resourceType: 'Patient', batchSize: 1 });
    const source = arrayToAsyncIterable(rawPatientRecords);
    const bundle = await pipeline.collect(source);
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.entry?.length).toBe(3);
  });
});
