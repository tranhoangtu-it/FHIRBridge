/**
 * IPS (International Patient Summary) Bundle builder.
 *
 * Theo chuẩn HL7 IPS: https://hl7.org/fhir/uv/ips/
 * - Bundle type phải là 'document'
 * - Entry đầu tiên PHẢI là Composition resource (document root)
 * - Composition.subject → Patient
 * - Composition.section[] chứa các clinical category entries
 *
 * FHIR R4 §Composition: https://hl7.org/fhir/r4/composition.html
 */

import { v4 as uuidv4 } from 'uuid';
import type {
  Resource,
  Bundle,
  BundleEntry,
  Reference,
  CodeableConcept,
  Coding,
} from '@fhirbridge/types';

// ── Minimal Composition type (inline — tránh edit packages/types) ───────────

/** FHIR R4 Composition.section */
interface CompositionSection {
  title: string;
  code: CodeableConcept;
  /** Danh sách reference tới resources trong Bundle entries */
  entry: Reference[];
  emptyReason?: CodeableConcept;
}

/** FHIR R4 Composition resource — minimal IPS-required fields */
interface Composition extends Resource {
  readonly resourceType: 'Composition';
  status: 'preliminary' | 'final' | 'amended' | 'entered-in-error';
  /** IPS document type: LOINC 60591-5 */
  type: CodeableConcept;
  subject: Reference;
  date: string;
  author: Reference[];
  title: string;
  section: CompositionSection[];
}

// ── IPS Section LOINC codes (per HL7 IPS profile) ───────────────────────────

/**
 * LOINC codes cho IPS sections theo chuẩn HL7 IPS:
 * https://hl7.org/fhir/uv/ips/StructureDefinition-Composition-uv-ips.html
 */
export const IPS_SECTION_CODES = {
  /** Allergies and Intolerances — LOINC 48765-2 */
  ALLERGIES: '48765-2',
  /** Medications — LOINC 10160-0 */
  MEDICATIONS: '10160-0',
  /** Problems / Conditions — LOINC 11450-4 */
  PROBLEMS: '11450-4',
  /** Results (Observations, DiagnosticReports) — LOINC 30954-2 */
  RESULTS: '30954-2',
  /** Procedures — LOINC 47519-4 */
  PROCEDURES: '47519-4',
  /** Immunizations — LOINC 11369-6 */
  IMMUNIZATIONS: '11369-6',
} as const;

const LOINC_SYSTEM = 'http://loinc.org';

/** IPS document type Coding */
const IPS_DOCUMENT_TYPE_CODING: Coding = {
  system: LOINC_SYSTEM,
  code: '60591-5',
  display: 'Patient summary Document',
};

// ── Nội bộ: theo dõi một section ────────────────────────────────────────────

interface PendingSection {
  title: string;
  code: CodeableConcept;
  resources: Resource[];
  fullUrls: string[];
}

// ── IPSBundleBuilder ─────────────────────────────────────────────────────────

/**
 * Xây dựng FHIR R4 Bundle theo IPS (International Patient Summary) profile.
 *
 * Cách dùng:
 * ```ts
 * const builder = new IPSBundleBuilder({ reference: 'Patient/p1' });
 * builder.addSection('Allergies', { coding: [{ system: LOINC_SYSTEM, code: '48765-2' }] }, allergyResources);
 * builder.addSection('Medications', { coding: [{ system: LOINC_SYSTEM, code: '10160-0' }] }, medResources);
 * const bundle = builder.build();
 * ```
 */
export class IPSBundleBuilder {
  private readonly pendingSections: PendingSection[] = [];
  /** Tất cả non-Composition entries (sẽ append sau Composition) */
  private readonly resourceEntries: BundleEntry[] = [];
  /** Map từ resource index → fullUrl (để Composition references) */
  private readonly resourceFullUrlMap = new Map<Resource, string>();
  private readonly timestamp: string;

  /**
   * @param patientRef - Reference tới Patient resource (Composition.subject)
   * @param authorRef  - Reference tới author (practitioner/system). Default: FHIRBridge display ref
   */
  constructor(
    private readonly patientRef: Reference,
    private readonly authorRef?: Reference,
  ) {
    this.timestamp = new Date().toISOString();
  }

  /**
   * Thêm một section vào IPS Bundle.
   * Sections có 0 resources sẽ KHÔNG được render vào Composition (per IPS profile).
   *
   * @param sectionTitle - Tiêu đề hiển thị của section
   * @param sectionCode  - CodeableConcept (LOINC code theo IPS spec)
   * @param resources    - Danh sách FHIR resources trong section này
   */
  addSection(sectionTitle: string, sectionCode: CodeableConcept, resources: Resource[]): void {
    if (resources.length === 0) {
      // Empty sections không render — per IPS profile requirement
      return;
    }

    // Gán fullUrl cho mỗi resource, tránh duplicate nếu resource được add nhiều section
    const fullUrls: string[] = [];
    for (const resource of resources) {
      if (!this.resourceFullUrlMap.has(resource)) {
        const fullUrl = `urn:uuid:${uuidv4()}`;
        this.resourceFullUrlMap.set(resource, fullUrl);
        this.resourceEntries.push({ fullUrl, resource });
      }
      // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
      fullUrls.push(this.resourceFullUrlMap.get(resource)!);
    }

    this.pendingSections.push({
      title: sectionTitle,
      code: sectionCode,
      resources,
      fullUrls,
    });
  }

  /**
   * Build Bundle IPS document.
   * Bundle.type = 'document'
   * entry[0] = Composition
   * entry[1..] = clinical resources
   */
  build(): Bundle {
    const compositionId = uuidv4();
    const compositionFullUrl = `urn:uuid:${compositionId}`;

    // Xây sections từ pendingSections
    const sections: CompositionSection[] = this.pendingSections.map((ps) => ({
      title: ps.title,
      code: ps.code,
      entry: ps.fullUrls.map((fullUrl) => ({ reference: fullUrl })),
    }));

    const composition: Composition = {
      resourceType: 'Composition',
      id: compositionId,
      status: 'final',
      type: {
        coding: [IPS_DOCUMENT_TYPE_CODING],
      },
      subject: this.patientRef,
      date: this.timestamp,
      author: [this.authorRef ?? { display: 'FHIRBridge Auto-Summary' }],
      title: 'Patient Summary',
      section: sections,
    };

    const compositionEntry: BundleEntry = {
      fullUrl: compositionFullUrl,
      resource: composition as Resource,
    };

    return {
      resourceType: 'Bundle',
      id: uuidv4(),
      type: 'document',
      timestamp: this.timestamp,
      entry: [compositionEntry, ...this.resourceEntries],
    };
  }

  /**
   * Serialize Bundle thành JSON string.
   * Alias tiện lợi cho JSON.stringify + formatting.
   */
  serialize(): string {
    return JSON.stringify(this.build(), null, 2);
  }
}
