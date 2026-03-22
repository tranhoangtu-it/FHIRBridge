/**
 * PDF formatter tests.
 * Verifies that formatPdf() produces a valid PDF Buffer.
 */

import { describe, it, expect } from 'vitest';
import type { PatientSummary } from '@fhirbridge/types';
import { formatPdf } from '../pdf-formatter.js';

/** Build a minimal PatientSummary for testing */
function buildSummary(overrides: Partial<PatientSummary> = {}): PatientSummary {
  return {
    sections: [
      {
        section: 'Conditions',
        content: 'Patient has hypertension (I10), well controlled.',
        tokenCount: 40,
        resourceCount: 1,
      },
      {
        section: 'Medications',
        content: 'Lisinopril 10mg once daily.',
        tokenCount: 30,
        resourceCount: 1,
      },
    ],
    synthesis:
      'The patient is a middle-aged adult with hypertension managed with Lisinopril. No significant allergies reported.',
    metadata: {
      generatedAt: '2026-03-22T10:00:00.000Z',
      provider: 'claude',
      model: 'claude-sonnet-4-20250514',
      totalTokens: 500,
      language: 'en',
      deidentified: true,
    },
    ...overrides,
  };
}

describe('formatPdf', () => {
  it('returns a Buffer', async () => {
    const result = await formatPdf(buildSummary());
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('PDF starts with %PDF magic bytes', async () => {
    const result = await formatPdf(buildSummary());
    const header = result.subarray(0, 4).toString('ascii');
    expect(header).toBe('%PDF');
  });

  it('generates a non-trivial PDF (> 1000 bytes)', async () => {
    const result = await formatPdf(buildSummary());
    expect(result.length).toBeGreaterThan(1000);
  });

  it('handles empty sections array gracefully', async () => {
    const summary = buildSummary({ sections: [] });
    const result = await formatPdf(summary);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('handles empty synthesis string gracefully', async () => {
    const summary = buildSummary({ synthesis: '' });
    const result = await formatPdf(summary);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(1000);
  });

  it('handles sections with zero resourceCount', async () => {
    const summary = buildSummary({
      sections: [
        {
          section: 'Allergies',
          content: 'No data available for this section.',
          tokenCount: 0,
          resourceCount: 0,
        },
      ],
    });
    const result = await formatPdf(summary);
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.subarray(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('includes content for multiple sections without errors', async () => {
    const summary = buildSummary({
      sections: [
        { section: 'Conditions', content: 'Diabetes Type 2.', tokenCount: 20, resourceCount: 2 },
        { section: 'Medications', content: 'Metformin 500mg.', tokenCount: 15, resourceCount: 1 },
        { section: 'Allergies', content: 'No known allergies.', tokenCount: 10, resourceCount: 0 },
        { section: 'Vitals', content: 'BP 130/80. HR 72.', tokenCount: 25, resourceCount: 5 },
        { section: 'Procedures', content: 'Annual checkup.', tokenCount: 12, resourceCount: 1 },
      ],
    });
    const result = await formatPdf(summary);
    expect(result.length).toBeGreaterThan(1000);
  });
});
