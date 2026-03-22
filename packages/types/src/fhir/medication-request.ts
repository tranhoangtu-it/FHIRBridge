/**
 * FHIR R4 MedicationRequest resource type.
 * An order or request for the supply of a medication.
 */

import type {
  DomainResource,
  Identifier,
  CodeableConcept,
  Reference,
  Dosage,
  Period,
  Quantity,
} from './base-resource.js';

/** MedicationRequest status values (FHIR R4) */
export type MedicationRequestStatus =
  | 'active'
  | 'on-hold'
  | 'cancelled'
  | 'completed'
  | 'entered-in-error'
  | 'stopped'
  | 'draft'
  | 'unknown';

/** MedicationRequest intent values (FHIR R4) */
export type MedicationRequestIntent =
  | 'proposal'
  | 'plan'
  | 'order'
  | 'original-order'
  | 'reflex-order'
  | 'filler-order'
  | 'instance-order'
  | 'option';

/** Dispense request details */
export interface MedicationDispenseRequest {
  initialFill?: { quantity?: Quantity; duration?: { value: number; unit: string } };
  dispenseInterval?: { value: number; unit: string };
  validityPeriod?: Period;
  numberOfRepeatsAllowed?: number;
  quantity?: Quantity;
  expectedSupplyDuration?: { value: number; unit: string };
  performer?: Reference;
}

/** Substitution information */
export interface MedicationSubstitution {
  allowedBoolean?: boolean;
  allowedCodeableConcept?: CodeableConcept;
  reason?: CodeableConcept;
}

/**
 * FHIR R4 MedicationRequest resource.
 * Required: status, intent, medication[x], subject.
 */
export interface MedicationRequest extends DomainResource {
  readonly resourceType: 'MedicationRequest';
  identifier?: Identifier[];
  /** Required: current state of the prescription */
  status: MedicationRequestStatus;
  statusReason?: CodeableConcept;
  /** Required: intent of the prescription */
  intent: MedicationRequestIntent;
  category?: CodeableConcept[];
  priority?: 'routine' | 'urgent' | 'asap' | 'stat';
  doNotPerform?: boolean;
  reportedBoolean?: boolean;
  reportedReference?: Reference;
  /** Required (choose one): medication as a concept */
  medicationCodeableConcept?: CodeableConcept;
  /** Required (choose one): medication as a reference */
  medicationReference?: Reference;
  /** Required: who the medication request is for */
  subject: Reference;
  encounter?: Reference;
  supportingInformation?: Reference[];
  authoredOn?: string;
  requester?: Reference;
  performer?: Reference;
  performerType?: CodeableConcept;
  recorder?: Reference;
  reasonCode?: CodeableConcept[];
  reasonReference?: Reference[];
  instantiatesCanonical?: string[];
  instantiatesUri?: string[];
  basedOn?: Reference[];
  groupIdentifier?: Identifier;
  courseOfTherapyType?: CodeableConcept;
  insurance?: Reference[];
  note?: Array<{ text: string }>;
  dosageInstruction?: Dosage[];
  dispenseRequest?: MedicationDispenseRequest;
  substitution?: MedicationSubstitution;
  priorPrescription?: Reference;
  detectedIssue?: Reference[];
  eventHistory?: Reference[];
}
