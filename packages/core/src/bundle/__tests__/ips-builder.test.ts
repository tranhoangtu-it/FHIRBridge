/**
 * Tests for IPSBundleBuilder.
 * Verifies IPS document Bundle structure per HL7 IPS profile:
 * https://hl7.org/fhir/uv/ips/StructureDefinition-Composition-uv-ips.html
 *
 * Không dùng mock — sử dụng realistic FHIR R4 data fixtures.
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { IPSBundleBuilder } from '../ips-builder.js';
import type { Resource, Reference } from '@fhirbridge/types';

// ── Fixtures ──────────────────────────────────────────────────────────────────

const patientRef: Reference = { reference: 'Patient/patient-ips-001' };
const authorRef: Reference = { reference: 'Practitioner/dr-nguyen-001', display: 'Dr. Nguyen' };

const allergyResource1: Resource = {
  resourceType: 'AllergyIntolerance',
  id: 'allergy-001',
};

const allergyResource2: Resource = {
  resourceType: 'AllergyIntolerance',
  id: 'allergy-002',
};

const medicationResource1: Resource = {
  resourceType: 'MedicationRequest',
  id: 'med-req-001',
};

const medicationResource2: Resource = {
  resourceType: 'MedicationRequest',
  id: 'med-req-002',
};

const medicationResource3: Resource = {
  resourceType: 'MedicationRequest',
  id: 'med-req-003',
};

const conditionResource: Resource = {
  resourceType: 'Condition',
  id: 'condition-001',
};

// IPS LOINC section codes
const LOINC = 'http://loinc.org';

const allergiesCode = {
  coding: [{ system: LOINC, code: '48765-2', display: 'Allergies and adverse reactions Document' }],
};
const medicationsCode = {
  coding: [{ system: LOINC, code: '10160-0', display: 'History of Medication use Narrative' }],
};
const problemsCode = {
  coding: [{ system: LOINC, code: '11450-4', display: 'Problem list - Reported' }],
};

// ── Helper ────────────────────────────────────────────────────────────────────

/**
 * Lấy Composition resource từ Bundle (entry[0]).
 * Throws nếu không phải Composition.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getComposition(bundle: ReturnType<IPSBundleBuilder['build']>): any {
  const first = bundle.entry?.[0]?.resource;
  if (!first || first.resourceType !== 'Composition') {
    throw new Error(`Expected entry[0] to be Composition, got ${first?.resourceType}`);
  }
  return first;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('IPSBundleBuilder', () => {
  let builder: IPSBundleBuilder;

  beforeEach(() => {
    builder = new IPSBundleBuilder(patientRef, authorRef);
  });

  // ── Bundle structure ─────────────────────────────────────────────────────────

  it('builds a Bundle with type = document', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    const bundle = builder.build();
    expect(bundle.resourceType).toBe('Bundle');
    expect(bundle.type).toBe('document');
  });

  it('entry[0] resource is Composition', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    const bundle = builder.build();
    const firstEntry = bundle.entry?.[0];
    expect(firstEntry?.resource?.resourceType).toBe('Composition');
  });

  it('Composition.subject matches patientRef', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    const composition = getComposition(builder.build());
    expect(composition.subject).toEqual(patientRef);
  });

  it('Composition.author uses provided authorRef', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    const composition = getComposition(builder.build());
    expect(composition.author).toEqual([authorRef]);
  });

  it('Composition.author defaults to FHIRBridge display when no authorRef provided', () => {
    const noAuthorBuilder = new IPSBundleBuilder(patientRef);
    noAuthorBuilder.addSection('Allergies', allergiesCode, [allergyResource1]);
    const composition = getComposition(noAuthorBuilder.build());
    expect(composition.author[0].display).toMatch(/FHIRBridge/i);
  });

  it('Composition.status is final', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    const composition = getComposition(builder.build());
    expect(composition.status).toBe('final');
  });

  it('Composition.type contains IPS document LOINC code 60591-5', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    const composition = getComposition(builder.build());
    const coding = composition.type?.coding?.[0];
    expect(coding?.system).toBe('http://loinc.org');
    expect(coding?.code).toBe('60591-5');
  });

  it('Composition has a valid ISO date', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    const composition = getComposition(builder.build());
    expect(typeof composition.date).toBe('string');
    expect(() => new Date(composition.date).toISOString()).not.toThrow();
  });

  // ── Sections ─────────────────────────────────────────────────────────────────

  it('builds correct section count: 2 allergies + 3 medications', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1, allergyResource2]);
    builder.addSection('Medications', medicationsCode, [
      medicationResource1,
      medicationResource2,
      medicationResource3,
    ]);
    const composition = getComposition(builder.build());
    expect(composition.section).toHaveLength(2);
  });

  it('section[0] has correct LOINC code for allergies', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1, allergyResource2]);
    builder.addSection('Medications', medicationsCode, [medicationResource1]);
    const composition = getComposition(builder.build());
    expect(composition.section[0].code.coding[0].code).toBe('48765-2');
    expect(composition.section[0].title).toBe('Allergies');
  });

  it('section entries contain urn:uuid references matching bundle entries', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1, allergyResource2]);
    const bundle = builder.build();
    const composition = getComposition(bundle);

    // Lấy tất cả fullUrls từ bundle entries (bỏ qua Composition entry đầu)
    const bundleFullUrls = new Set((bundle.entry ?? []).slice(1).map((e) => e.fullUrl));

    // Mọi reference trong section.entry phải có trong bundle
    const sectionRefs: string[] = composition.section[0].entry.map(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (ref: any) => ref.reference,
    );
    expect(sectionRefs).toHaveLength(2);
    for (const ref of sectionRefs) {
      expect(bundleFullUrls.has(ref)).toBe(true);
    }
  });

  it('all 5 resource IDs accessible via Composition section references', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1, allergyResource2]);
    builder.addSection('Medications', medicationsCode, [
      medicationResource1,
      medicationResource2,
      medicationResource3,
    ]);
    const bundle = builder.build();
    const composition = getComposition(bundle);

    // Build map fullUrl → resource
    const urlToResource = new Map<string, Resource>();
    for (const entry of bundle.entry ?? []) {
      if (entry.fullUrl && entry.resource) {
        urlToResource.set(entry.fullUrl, entry.resource);
      }
    }

    // Gom tất cả references từ các sections
    const allSectionRefs: string[] = composition.section.flatMap(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (s: any) => s.entry.map((e: any) => e.reference),
    );
    expect(allSectionRefs).toHaveLength(5);

    // Mỗi reference phải resolve được tới một resource trong bundle
    for (const ref of allSectionRefs) {
      expect(urlToResource.has(ref)).toBe(true);
    }

    // Verify resource IDs của 5 resources
    const resolvedIds = allSectionRefs.map((ref) => urlToResource.get(ref)?.id);
    expect(resolvedIds).toContain('allergy-001');
    expect(resolvedIds).toContain('allergy-002');
    expect(resolvedIds).toContain('med-req-001');
    expect(resolvedIds).toContain('med-req-002');
    expect(resolvedIds).toContain('med-req-003');
  });

  // ── Empty section behavior ───────────────────────────────────────────────────

  it('empty sections are NOT rendered into Composition', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    builder.addSection('Medications', medicationsCode, []); // empty — must be skipped
    builder.addSection('Problems', problemsCode, [conditionResource]);
    const composition = getComposition(builder.build());
    // Only Allergies and Problems should be present
    expect(composition.section).toHaveLength(2);
    const titles: string[] = composition.section.map((s: { title: string }) => s.title);
    expect(titles).toContain('Allergies');
    expect(titles).toContain('Problems');
    expect(titles).not.toContain('Medications');
  });

  it('Bundle with all empty sections still builds (Composition with no sections)', () => {
    builder.addSection('Medications', medicationsCode, []);
    const bundle = builder.build();
    expect(bundle.type).toBe('document');
    const composition = getComposition(bundle);
    expect(composition.section).toHaveLength(0);
  });

  // ── Deduplication ────────────────────────────────────────────────────────────

  it('same resource added to multiple sections is not duplicated in Bundle entries', () => {
    // Shared resource (edge case: resource referenced from two sections)
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    builder.addSection('Results', { coding: [{ system: LOINC, code: '30954-2' }] }, [
      allergyResource1,
    ]);
    const bundle = builder.build();
    // entry[0] = Composition, entry[1] = allergyResource1 only once
    const nonCompositionEntries = (bundle.entry ?? []).filter(
      (e) => e.resource?.resourceType !== 'Composition',
    );
    expect(nonCompositionEntries).toHaveLength(1);
  });

  // ── Serialization ────────────────────────────────────────────────────────────

  it('serialize() returns valid JSON with Bundle.type = document', () => {
    builder.addSection('Allergies', allergiesCode, [allergyResource1]);
    const json = builder.serialize();
    const parsed = JSON.parse(json) as { type: string; resourceType: string };
    expect(parsed.resourceType).toBe('Bundle');
    expect(parsed.type).toBe('document');
  });

  // ── IPS_SECTION_CODES constant ───────────────────────────────────────────────

  it('IPS_SECTION_CODES exports correct LOINC codes', async () => {
    const { IPS_SECTION_CODES } = await import('../ips-builder.js');
    expect(IPS_SECTION_CODES.ALLERGIES).toBe('48765-2');
    expect(IPS_SECTION_CODES.MEDICATIONS).toBe('10160-0');
    expect(IPS_SECTION_CODES.PROBLEMS).toBe('11450-4');
    expect(IPS_SECTION_CODES.RESULTS).toBe('30954-2');
    expect(IPS_SECTION_CODES.PROCEDURES).toBe('47519-4');
    expect(IPS_SECTION_CODES.IMMUNIZATIONS).toBe('11369-6');
  });
});
