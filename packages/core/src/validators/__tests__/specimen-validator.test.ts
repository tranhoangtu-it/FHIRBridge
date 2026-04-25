/**
 * Tests for the FHIR R4 Specimen validator.
 * Dùng context Việt Nam / Nhật Bản: phòng xét nghiệm BV Bạch Mai, BV Tokyo.
 */

import { describe, it, expect } from 'vitest';
import { validateSpecimen } from '../specimen-validator.js';

// ── Fixtures ──────────────────────────────────────────────────────────────────

/**
 * Mẫu máu toàn phần — ống EDTA (tím)
 * Bệnh viện Bạch Mai, Hà Nội
 */
const validBloodSpecimen = {
  resourceType: 'Specimen',
  id: 'spec-blood-bm-2024-001',
  identifier: [
    {
      system: 'https://bachmai.gov.vn/lab/specimen-id',
      value: 'BM-2024-XN-00456',
    },
  ],
  accessionIdentifier: {
    system: 'https://bachmai.gov.vn/lab/accession',
    value: 'ACC-2024-456',
  },
  status: 'available',
  type: {
    coding: [
      {
        system: 'http://snomed.info/sct',
        code: '119297000',
        display: 'Blood specimen',
      },
    ],
    text: 'Máu toàn phần (EDTA)',
  },
  subject: {
    reference: 'Patient/bn-nguyen-van-a',
    display: 'Nguyễn Văn A',
  },
  receivedTime: '2024-03-10T07:45:00+07:00',
  request: [
    {
      reference: 'ServiceRequest/sr-cbc-001',
      display: 'Tổng phân tích tế bào máu (CBC)',
    },
  ],
  collection: {
    collector: {
      reference: 'Practitioner/ky-thuat-vien-01',
      display: 'Kỹ thuật viên Lê Văn D',
    },
    collectedDateTime: '2024-03-10T07:30:00+07:00',
    quantity: {
      value: 3,
      unit: 'mL',
      system: 'http://unitsofmeasure.org',
      code: 'mL',
    },
    method: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '28520004',
          display: 'Venipuncture for blood test',
        },
      ],
    },
    bodySite: {
      coding: [
        {
          system: 'http://snomed.info/sct',
          code: '368209003',
          display: 'Right arm',
        },
      ],
      text: 'Tĩnh mạch cánh tay phải',
    },
  },
  processing: [
    {
      description: 'Ly tâm 3000 rpm trong 10 phút',
      procedure: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '85457002',
            display: 'Centrifugation',
          },
        ],
      },
      timeDateTime: '2024-03-10T08:00:00+07:00',
    },
  ],
  container: [
    {
      identifier: [{ system: 'https://bachmai.gov.vn/lab/container', value: 'TUBE-EDTA-001' }],
      description: 'Ống EDTA 3mL (nắp tím)',
      type: {
        coding: [
          {
            system: 'http://snomed.info/sct',
            code: '767384007',
            display: 'EDTA anticoagulant',
          },
        ],
      },
      capacity: {
        value: 3,
        unit: 'mL',
        system: 'http://unitsofmeasure.org',
        code: 'mL',
      },
      specimenQuantity: {
        value: 3,
        unit: 'mL',
        system: 'http://unitsofmeasure.org',
        code: 'mL',
      },
    },
  ],
};

/**
 * Mẫu nước tiểu — xét nghiệm tổng phân tích nước tiểu (UA)
 * Bệnh viện Tokyo
 */
const validUrineSpecimen = {
  resourceType: 'Specimen',
  id: 'spec-urine-tokyo-2023',
  status: 'available',
  type: {
    coding: [
      {
        system: 'http://snomed.info/sct',
        code: '122575003',
        display: 'Urine specimen',
      },
    ],
    text: '尿検体',
  },
  subject: {
    reference: 'Patient/pt-yamamoto-hanako',
  },
  receivedTime: '2023-06-20T09:00:00+09:00',
  collection: {
    collectedDateTime: '2023-06-20T08:45:00+09:00',
    quantity: {
      value: 10,
      unit: 'mL',
    },
    method: {
      text: '中間尿採取 (Midstream urine collection)',
    },
  },
};

/** Minimal specimen — chỉ resourceType */
const minimalSpecimen = {
  resourceType: 'Specimen',
};

// ── Valid resource tests ───────────────────────────────────────────────────────

describe('validateSpecimen', () => {
  it('returns valid for a complete blood specimen resource', () => {
    const result = validateSpecimen(validBloodSpecimen);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid for urine specimen with minimal collection info', () => {
    const result = validateSpecimen(validUrineSpecimen);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  it('returns valid for minimal Specimen (only resourceType)', () => {
    const result = validateSpecimen(minimalSpecimen);
    expect(result.valid).toBe(true);
    expect(result.errors.filter((e) => e.severity === 'error')).toHaveLength(0);
  });

  // ── resourceType ──────────────────────────────────────────────────────────

  it('returns error if resourceType is not "Specimen"', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, resourceType: 'DiagnosticReport' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'resourceType' && e.severity === 'error')).toBe(
      true,
    );
  });

  it('returns error for null resource', () => {
    const result = validateSpecimen(null);
    expect(result.valid).toBe(false);
  });

  it('returns error for non-object resource', () => {
    const result = validateSpecimen(42);
    expect(result.valid).toBe(false);
  });

  // ── status ────────────────────────────────────────────────────────────────

  it('returns error for invalid status value', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, status: 'destroyed' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'status' && e.severity === 'error')).toBe(true);
  });

  it('accepts all valid status values', () => {
    for (const status of ['available', 'unavailable', 'unsatisfactory', 'entered-in-error']) {
      const result = validateSpecimen({ ...validBloodSpecimen, status });
      expect(
        result.errors.filter((e) => e.path === 'status' && e.severity === 'error'),
      ).toHaveLength(0);
    }
  });

  it('accepts specimen with no status (status is optional)', () => {
    const { status, ...rest } = validBloodSpecimen;
    const result = validateSpecimen(rest);
    expect(result.errors.filter((e) => e.path === 'status' && e.severity === 'error')).toHaveLength(
      0,
    );
  });

  // ── type ──────────────────────────────────────────────────────────────────

  it('returns error when type is not a CodeableConcept object', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, type: 'Blood' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'type' && e.severity === 'error')).toBe(true);
  });

  it('warns when type has neither coding nor text', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, type: {} });
    expect(result.errors.some((e) => e.path === 'type' && e.severity === 'warning')).toBe(true);
  });

  it('warns when type.coding uses unknown system', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      type: { coding: [{ system: 'http://local-hospital.vn/specimen-types', code: 'BLD' }] },
    });
    expect(result.errors.some((e) => e.severity === 'warning' && e.path.includes('system'))).toBe(
      true,
    );
  });

  it('accepts type with text only (no coding)', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, type: { text: 'Mẫu dịch não tủy' } });
    expect(result.errors.filter((e) => e.path === 'type' && e.severity === 'error')).toHaveLength(
      0,
    );
  });

  // ── subject ───────────────────────────────────────────────────────────────

  it('returns error when subject is not a valid Reference', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, subject: 'Patient/123' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'subject' && e.severity === 'error')).toBe(true);
  });

  it('returns error when subject Reference has no reference/identifier/display', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, subject: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'subject' && e.severity === 'error')).toBe(true);
  });

  // ── parent ────────────────────────────────────────────────────────────────

  it('returns error when parent is not an array', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      parent: { reference: 'Specimen/sp-001' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'parent' && e.severity === 'error')).toBe(true);
  });

  it('returns error when parent entry is not a valid Reference', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, parent: [{}] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'parent[0]' && e.severity === 'error')).toBe(true);
  });

  it('accepts valid parent reference (derived specimen from blood)', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      parent: [{ reference: 'Specimen/spec-whole-blood-001' }],
    });
    expect(
      result.errors.filter((e) => e.path.includes('parent') && e.severity === 'error'),
    ).toHaveLength(0);
  });

  // ── request ───────────────────────────────────────────────────────────────

  it('returns error when request is not an array', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      request: { reference: 'ServiceRequest/sr-001' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'request' && e.severity === 'error')).toBe(true);
  });

  it('returns error when request entry is invalid Reference', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, request: [null] });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'request[0]' && e.severity === 'error')).toBe(true);
  });

  // ── collection ────────────────────────────────────────────────────────────

  it('returns error when collection is not an object', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, collection: 'venipuncture' });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'collection' && e.severity === 'error')).toBe(true);
  });

  it('returns error when collection.collector is invalid Reference', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      collection: { ...validBloodSpecimen.collection, collector: {} },
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === 'collection.collector' && e.severity === 'error'),
    ).toBe(true);
  });

  it('returns error when collection.quantity.value is not a number', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      collection: {
        ...validBloodSpecimen.collection,
        quantity: { value: 'three', unit: 'mL' },
      },
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === 'collection.quantity.value' && e.severity === 'error'),
    ).toBe(true);
  });

  // ── processing ────────────────────────────────────────────────────────────

  it('returns error when processing is not an array', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      processing: { description: 'Centrifuge' },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'processing' && e.severity === 'error')).toBe(true);
  });

  it('returns error when processing additive entry is invalid Reference', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      processing: [
        {
          description: 'Bảo quản lạnh',
          additive: [{}],
        },
      ],
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === 'processing[0].additive[0]' && e.severity === 'error'),
    ).toBe(true);
  });

  // ── container ─────────────────────────────────────────────────────────────

  it('returns error when container is not an array', () => {
    const result = validateSpecimen({ ...validBloodSpecimen, container: {} });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'container' && e.severity === 'error')).toBe(true);
  });

  it('returns error when container capacity is not a Quantity object', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      container: [{ description: 'EDTA tube', capacity: '3mL' }],
    });
    expect(result.valid).toBe(false);
    expect(
      result.errors.some((e) => e.path === 'container[0].capacity' && e.severity === 'error'),
    ).toBe(true);
  });

  it('returns error when container specimenQuantity.value is not a number', () => {
    const result = validateSpecimen({
      ...validBloodSpecimen,
      container: [{ description: 'EDTA tube', specimenQuantity: { value: '2.5mL', unit: 'mL' } }],
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.path === 'container[0].specimenQuantity.value')).toBe(true);
  });
});
