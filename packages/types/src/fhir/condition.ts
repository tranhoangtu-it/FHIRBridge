/**
 * FHIR R4 Condition resource type.
 * A clinical condition, problem, diagnosis, or other event.
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Period,
  Quantity,
} from './base-resource.js';

/** Evidence supporting the condition */
export interface ConditionEvidence {
  code?: CodeableConcept[];
  detail?: Reference[];
}

/** Stage information for the condition */
export interface ConditionStage {
  summary?: CodeableConcept;
  assessment?: Reference[];
  type?: CodeableConcept;
}

/**
 * FHIR R4 Condition resource.
 * Required: subject; clinicalStatus and verificationStatus strongly recommended.
 */
export interface Condition extends DomainResource {
  readonly resourceType: 'Condition';
  identifier?: Identifier[];
  /**
   * Clinical status of the condition.
   * Binding: http://hl7.org/fhir/ValueSet/condition-clinical
   */
  clinicalStatus?: CodeableConcept;
  /**
   * Verification status to support diagnosis.
   * Binding: http://hl7.org/fhir/ValueSet/condition-ver-status
   */
  verificationStatus?: CodeableConcept;
  category?: CodeableConcept[];
  severity?: CodeableConcept;
  /** Identification of the condition — required for meaningful exchange */
  code?: CodeableConcept;
  bodySite?: CodeableConcept[];
  /** Subject the condition is about — required */
  subject: Reference;
  encounter?: Reference;
  onsetDateTime?: string;
  onsetAge?: Quantity;
  onsetPeriod?: Period;
  onsetRange?: { low?: Quantity; high?: Quantity };
  onsetString?: string;
  abatementDateTime?: string;
  abatementAge?: Quantity;
  abatementPeriod?: Period;
  abatementRange?: { low?: Quantity; high?: Quantity };
  abatementString?: string;
  recordedDate?: string;
  recorder?: Reference;
  asserter?: Reference;
  stage?: ConditionStage[];
  evidence?: ConditionEvidence[];
  note?: Array<{ text: string; authorReference?: Reference; time?: string }>;
}
