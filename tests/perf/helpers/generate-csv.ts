/**
 * Test data generators for performance benchmarks.
 * Generates CSV files and FHIR Bundles with N rows/resources.
 */

import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Write a CSV file with N patient observation rows to tmp dir.
 * Returns the absolute file path.
 */
export function generateCsv(rowCount: number): string {
  const path = join(tmpdir(), `fhirbridge-perf-${rowCount}.csv`);
  const header = 'patient_id,first_name,last_name,birth_date,gender,observation_type,value,unit\n';
  let content = header;
  for (let i = 0; i < rowCount; i++) {
    const month = String((i % 9) + 1).padStart(2, '0');
    const day = String((i % 9) + 11);
    content += `P${i},First${i},Last${i},199${i % 10}-${month}-${day},${i % 2 ? 'male' : 'female'},HR,${60 + (i % 40)},bpm\n`;
  }
  writeFileSync(path, content);
  return path;
}

/**
 * Build an in-memory FHIR Bundle with N Observation resources.
 * No file I/O — used for serialization and validation benchmarks.
 */
export function generateBundle(resourceCount: number) {
  return {
    resourceType: 'Bundle' as const,
    type: 'collection' as const,
    entry: Array.from({ length: resourceCount }, (_, i) => ({
      fullUrl: `urn:uuid:obs-${i}`,
      resource: {
        resourceType: 'Observation',
        id: `obs-${i}`,
        status: 'final',
        code: {
          coding: [{ system: 'http://loinc.org', code: '29463-7', display: 'Body Weight' }],
        },
        valueQuantity: {
          value: 70 + (i % 30),
          unit: 'kg',
          system: 'http://unitsofmeasure.org',
          code: 'kg',
        },
        effectiveDateTime: `2024-01-${String((i % 28) + 1).padStart(2, '0')}`,
      },
    })),
  };
}
