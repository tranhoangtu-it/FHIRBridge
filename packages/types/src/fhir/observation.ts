/**
 * FHIR R4 Observation resource type.
 * Measurements and simple assertions made about a patient.
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Period,
  Quantity,
  Coding,
} from './base-resource.js';

/** Observation status values (FHIR R4) */
export type ObservationStatus =
  | 'registered'
  | 'preliminary'
  | 'final'
  | 'amended'
  | 'corrected'
  | 'cancelled'
  | 'entered-in-error'
  | 'unknown';

/** Reference range for an observation */
export interface ObservationReferenceRange {
  low?: Quantity;
  high?: Quantity;
  type?: CodeableConcept;
  appliesTo?: CodeableConcept[];
  age?: { low?: Quantity; high?: Quantity };
  text?: string;
}

/** Component of a multi-component observation (e.g., blood pressure) */
export interface ObservationComponent {
  /** Required: code identifying the component */
  code: CodeableConcept;
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valuePeriod?: Period;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  referenceRange?: ObservationReferenceRange[];
}

/**
 * FHIR R4 Observation resource.
 * Required: status, code.
 */
export interface Observation extends DomainResource {
  readonly resourceType: 'Observation';
  identifier?: Identifier[];
  basedOn?: Reference[];
  partOf?: Reference[];
  /** Required: status of the observation */
  status: ObservationStatus;
  /** Category classifies the type of observation */
  category?: CodeableConcept[];
  /** Required: type of observation — LOINC code preferred */
  code: CodeableConcept;
  subject?: Reference;
  focus?: Reference[];
  encounter?: Reference;
  effectiveDateTime?: string;
  effectivePeriod?: Period;
  effectiveTiming?: unknown;
  effectiveInstant?: string;
  issued?: string;
  performer?: Reference[];
  valueQuantity?: Quantity;
  valueCodeableConcept?: CodeableConcept;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valuePeriod?: Period;
  valueRange?: { low?: Quantity; high?: Quantity };
  valueRatio?: { numerator?: Quantity; denominator?: Quantity };
  valueSampledData?: unknown;
  valueTime?: string;
  valueDateTime?: string;
  dataAbsentReason?: CodeableConcept;
  interpretation?: CodeableConcept[];
  note?: Array<{ text: string }>;
  bodySite?: CodeableConcept;
  method?: CodeableConcept;
  specimen?: Reference;
  device?: Reference;
  referenceRange?: ObservationReferenceRange[];
  hasMember?: Reference[];
  derivedFrom?: Reference[];
  component?: ObservationComponent[];
  /** FHIR extension for supporting additional metadata */
  _effectiveDateTime?: { extension?: Array<{ url: string; valueString?: string }> };
}

/** Commonly used LOINC observation categories */
export type ObservationCategory =
  | 'vital-signs'
  | 'laboratory'
  | 'imaging'
  | 'procedure'
  | 'survey'
  | 'exam'
  | 'therapy'
  | 'activity';
