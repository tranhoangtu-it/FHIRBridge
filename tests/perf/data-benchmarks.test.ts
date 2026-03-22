/**
 * Data pipeline benchmarks — no HTTP overhead.
 * Tests CsvConnector, BundleSerializer, ResourceValidator, and Deidentifier
 * directly against target throughput thresholds.
 */

import { describe, it, expect, afterAll } from 'vitest';
import { unlinkSync, existsSync } from 'node:fs';
import { CsvConnector } from '../../packages/core/src/connectors/csv-connector.js';
import {
  serializeToJson,
  serializeToNdjson,
} from '../../packages/core/src/bundle/bundle-serializer.js';
import { validateResource } from '../../packages/core/src/validators/resource-validator.js';
import { deidentify } from '../../packages/core/src/ai/deidentifier.js';
import { generateCsv, generateBundle } from './helpers/generate-csv.js';

const HMAC_SECRET = 'test-hmac-secret-for-perf-testing-min32ch';

// Paths of generated CSV files — cleaned up in afterAll
const generatedFiles: string[] = [];

afterAll(() => {
  for (const p of generatedFiles) {
    if (existsSync(p)) unlinkSync(p);
  }
});

// Minimal column mapping so CsvConnector produces RawRecords
const PERF_MAPPING = [
  {
    sourceColumn: 'patient_id',
    resourceType: 'Patient',
    fhirPath: 'id',
    transform: 'string' as const,
  },
  {
    sourceColumn: 'observation_type',
    resourceType: 'Observation',
    fhirPath: 'code.text',
    transform: 'string' as const,
  },
];

describe('CSV import benchmarks', () => {
  it('imports 1K rows in < 2s', async () => {
    const csvPath = generateCsv(1_000);
    generatedFiles.push(csvPath);

    const connector = new CsvConnector();
    await connector.connect({ type: 'csv', filePath: csvPath, mapping: PERF_MAPPING });

    const start = performance.now();
    let count = 0;
    for await (const _ of connector.fetchPatientData('')) {
      count++;
    }
    const elapsed = performance.now() - start;
    await connector.disconnect();

    // Each row yields 2 records (Patient + Observation)
    expect(count).toBeGreaterThan(0);
    expect(elapsed).toBeLessThan(2000);
  });
});

describe('Bundle serialization benchmarks', () => {
  it('serializes 1K resources to JSON in < 500ms', () => {
    const bundle = generateBundle(1_000);
    const start = performance.now();
    const json = serializeToJson(bundle);
    const elapsed = performance.now() - start;

    expect(json).toContain('"Bundle"');
    expect(elapsed).toBeLessThan(500);
  });

  it('serializes 5K resources to JSON in < 2s', () => {
    const bundle = generateBundle(5_000);
    const start = performance.now();
    const json = serializeToJson(bundle);
    const elapsed = performance.now() - start;

    expect(json).toContain('"Bundle"');
    expect(elapsed).toBeLessThan(2000);
  });

  it('serializes 1K resources to NDJSON in < 500ms', () => {
    const bundle = generateBundle(1_000);
    const start = performance.now();
    const ndjson = serializeToNdjson(bundle);
    const elapsed = performance.now() - start;

    expect(ndjson.split('\n').length).toBe(1_000);
    expect(elapsed).toBeLessThan(500);
  });
});

describe('FHIR validation benchmarks', () => {
  it('validates 1K resources in < 1s', () => {
    const bundle = generateBundle(1_000);
    const resources = (bundle.entry ?? []).map((e) => e.resource);

    const start = performance.now();
    let validCount = 0;
    for (const resource of resources) {
      const result = validateResource(resource);
      if (result.valid) validCount++;
    }
    const elapsed = performance.now() - start;

    expect(validCount).toBe(1_000);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('De-identification benchmarks', () => {
  it('de-identifies bundle with 1K resources in < 1s', () => {
    // Build a bundle with a Patient + 999 Observations
    const patientEntry = {
      fullUrl: 'urn:uuid:patient-0',
      resource: {
        resourceType: 'Patient' as const,
        id: 'patient-0',
        name: [{ family: 'Smith', given: ['Alice'] }],
        birthDate: '1990-01-15',
      },
    };
    const obsBundle = generateBundle(999);
    const bundle = {
      resourceType: 'Bundle' as const,
      type: 'collection' as const,
      entry: [patientEntry, ...(obsBundle.entry ?? [])],
    };

    const start = performance.now();
    const { bundle: deidentified } = deidentify(bundle, HMAC_SECRET);
    const elapsed = performance.now() - start;

    expect(deidentified.entry?.length).toBe(1000);
    expect(elapsed).toBeLessThan(1000);
  });
});
