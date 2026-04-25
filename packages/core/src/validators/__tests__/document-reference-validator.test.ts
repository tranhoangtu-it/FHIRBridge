/**
 * Tests for the FHIR R4 DocumentReference validator.
 * Use case: tóm tắt xuất viện (discharge summary) và kết quả xét nghiệm PDF.
 */

import { describe, it, expect } from 'vitest';
import { validateDocumentReference } from '../document-reference-validator.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/** Tóm tắt xuất viện — LOINC 18842-5 */
const validDocumentReference = {
  resourceType: 'DocumentReference',
  id: 'doc-discharge-summary-001',
  masterIdentifier: {
    system: 'urn:ietf:rfc:3986',
    value: 'urn:oid:1.2.840.113619.2.62.994044785528.20060823.74819',
  },
  status: 'current',
  docStatus: 'final',
  type: {
    coding: [
      {
        system: 'http://loinc.org',
        code: '18842-5',
        display: 'Discharge summary',
      },
    ],
    text: 'Tóm tắt xuất viện',
  },
  category: [
    {
      coding: [
        {
          system: 'http://loinc.org',
          code: 'LP173421-1',
          display: 'Report',
        },
      ],
    },
  ],
  subject: { reference: 'Patient/patient-001' },
  date: '2024-01-15T10:30:00+07:00',
  author: [{ reference: 'Practitioner/practitioner-nguyen-van-a' }],
  custodian: { reference: 'Organization/hospital-bach-mai' },
  description: 'Tóm tắt xuất viện sau phẫu thuật',
  content: [
    {
      attachment: {
        contentType: 'application/pdf',
        language: 'vi',
        url: 'https://his.hospital.vn/documents/discharge-001.pdf',
        title: 'Tóm tắt xuất viện',
        creation: '2024-01-15',
      },
      format: {
        system: 'urn:oid:1.3.6.1.4.1.19376.1.2.3',
        code: 'urn:ihe:pcc:xds-ms:2007',
        display: 'XDS Medical Summaries',
      },
    },
  ],
  context: {
    encounter: [{ reference: 'Encounter/enc-001' }],
    period: { start: '2024-01-10', end: '2024-01-15' },
  },
};

// ── Valid resource tests ───────────────────────────────────────────────────────

describe('validateDocumentReference', () => {
  it('returns valid for a complete DocumentReference resource', () => {
    const result = validateDocumentReference(validDocumentReference);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid with minimal required fields', () => {
    const minimal = {
      resourceType: 'DocumentReference',
      status: 'current',
      content: [{ attachment: { url: 'https://example.com/doc.pdf' } }],
    };
    const result = validateDocumentReference(minimal);
    expect(result.valid).toBe(true);
  });

  // ── resourceType checks ───────────────────────────────────────────────────

  it('returns error if resourceType is not "DocumentReference"', () => {
    const result = validateDocumentReference({
      ...validDocumentReference,
      resourceType: 'DiagnosticReport',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'resourceType' && e.severity === 'error')).toBe(
      true,
    );
  });

  // ── status validation ─────────────────────────────────────────────────────

  it('returns error when status is missing', () => {
    const { status, ...rest } = validDocumentReference;
    const result = validateDocumentReference(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'status' && e.severity === 'error')).toBe(true);
  });

  it('returns error for invalid status value', () => {
    const result = validateDocumentReference({ ...validDocumentReference, status: 'active' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'status' && e.severity === 'error')).toBe(true);
  });

  it('accepts all valid status values', () => {
    for (const status of ['current', 'superseded', 'entered-in-error']) {
      const result = validateDocumentReference({ ...validDocumentReference, status });
      expect(
        result.errors.filter((e) => e.path === 'status' && e.severity === 'error'),
      ).toHaveLength(0);
    }
  });

  // ── docStatus validation ──────────────────────────────────────────────────

  it('returns error for invalid docStatus value', () => {
    const result = validateDocumentReference({ ...validDocumentReference, docStatus: 'draft' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'docStatus' && e.severity === 'error')).toBe(true);
  });

  // ── type / LOINC warning ──────────────────────────────────────────────────

  it('warns when type.coding does not use LOINC system', () => {
    const result = validateDocumentReference({
      ...validDocumentReference,
      type: { coding: [{ system: 'http://example.local/types', code: 'DS' }] },
    });
    expect(result.errors.some((e) => e.severity === 'warning' && e.path.includes('type'))).toBe(
      true,
    );
  });

  // ── content validation ────────────────────────────────────────────────────

  it('returns error when content is missing', () => {
    const { content, ...rest } = validDocumentReference;
    const result = validateDocumentReference(rest);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'content' && e.severity === 'error')).toBe(true);
  });

  it('returns error when content is empty array', () => {
    const result = validateDocumentReference({ ...validDocumentReference, content: [] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'content' && e.severity === 'error')).toBe(true);
  });

  it('returns error when attachment has neither data nor url', () => {
    const result = validateDocumentReference({
      ...validDocumentReference,
      content: [{ attachment: { contentType: 'application/pdf', title: 'No data' } }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'content[0].attachment')).toBe(true);
  });

  it('accepts attachment with base64 data instead of url', () => {
    const result = validateDocumentReference({
      ...validDocumentReference,
      content: [{ attachment: { contentType: 'application/pdf', data: 'base64encodeddata==' } }],
    });
    expect(
      result.errors.filter((e) => e.path === 'content[0].attachment' && e.severity === 'error'),
    ).toHaveLength(0);
  });

  it('returns error when resource is null', () => {
    const result = validateDocumentReference(null);
    expect(result.valid).toBe(false);
  });
});
