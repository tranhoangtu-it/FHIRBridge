/**
 * FHIR R4 DiagnosticReport resource type.
 * Findings and interpretation of diagnostic tests performed on patients.
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Period,
} from './base-resource.js';

/** DiagnosticReport status values (FHIR R4) */
export type DiagnosticReportStatus =
  | 'registered'
  | 'partial'
  | 'preliminary'
  | 'final'
  | 'amended'
  | 'corrected'
  | 'appended'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/** Media associated with the diagnostic report */
export interface DiagnosticReportMedia {
  comment?: string;
  link: Reference;
}

/**
 * FHIR R4 DiagnosticReport resource.
 * Required: status, code.
 */
export interface DiagnosticReport extends DomainResource {
  readonly resourceType: 'DiagnosticReport';
  identifier?: Identifier[];
  basedOn?: Reference[];
  /** Required: current status of the report */
  status: DiagnosticReportStatus;
  /** Category classifies the report */
  category?: CodeableConcept[];
  /** Required: name/code for this report */
  code: CodeableConcept;
  subject?: Reference;
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  issued?: string;
  performer?: Reference[];
  resultsInterpreter?: Reference[];
  specimen?: Reference[];
  /** Observation results referenced in the report */
  result?: Reference[];
  imagingStudy?: Reference[];
  media?: DiagnosticReportMedia[];
  /** Clinical interpretation/summary of the report */
  conclusion?: string;
  conclusionCode?: CodeableConcept[];
  presentedForm?: Array<{
    contentType?: string;
    data?: string;
    url?: string;
    title?: string;
  }>;
}
