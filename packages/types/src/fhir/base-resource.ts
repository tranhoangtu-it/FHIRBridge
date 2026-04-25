/**
 * FHIR R4 base resource types and common data types.
 * These form the foundation for all resource-specific interfaces.
 */

// ── Primitive-adjacent types ────────────────────────────────────────────────

/** FHIR Extension element */
export interface Extension {
  url: string;
  valueString?: string;
  valueBoolean?: boolean;
  valueInteger?: number;
  valueDecimal?: number;
  valueCode?: string;
  valueDateTime?: string;
  valueCodeableConcept?: CodeableConcept;
  valueReference?: Reference;
  valueQuantity?: Quantity;
  extension?: Extension[];
}

/** FHIR Meta element */
export interface Meta {
  versionId?: string;
  lastUpdated?: string;
  source?: string;
  profile?: string[];
  security?: Coding[];
  tag?: Coding[];
}

/** FHIR Narrative */
export interface Narrative {
  status: 'generated' | 'extensions' | 'additional' | 'empty';
  div: string;
}

// ── Common data types ───────────────────────────────────────────────────────

/** FHIR Coding — a reference to a code in a code system */
export interface Coding {
  system?: string;
  version?: string;
  code?: string;
  display?: string;
  userSelected?: boolean;
}

/** FHIR CodeableConcept — a concept defined by text and/or codings */
export interface CodeableConcept {
  coding?: Coding[];
  text?: string;
}

/** FHIR Reference — a reference from one resource to another */
export interface Reference {
  reference?: string;
  type?: string;
  identifier?: Identifier;
  display?: string;
}

/** FHIR Identifier — a business identifier */
export interface Identifier {
  use?: 'usual' | 'official' | 'temp' | 'secondary' | 'old';
  type?: CodeableConcept;
  system?: string;
  value?: string;
  period?: Period;
  assigner?: Reference;
}

/** FHIR Period — a time period defined by start and end */
export interface Period {
  start?: string;
  end?: string;
}

/** FHIR Quantity — a measured or measurable amount */
export interface Quantity {
  value?: number;
  comparator?: '<' | '<=' | '>=' | '>';
  unit?: string;
  system?: string;
  code?: string;
}

/** FHIR HumanName — a name of a human */
export interface HumanName {
  use?: 'usual' | 'official' | 'temp' | 'nickname' | 'anonymous' | 'old' | 'maiden';
  text?: string;
  family?: string;
  given?: string[];
  prefix?: string[];
  suffix?: string[];
  period?: Period;
}

/** FHIR Address */
export interface Address {
  use?: 'home' | 'work' | 'temp' | 'old' | 'billing';
  type?: 'postal' | 'physical' | 'both';
  text?: string;
  line?: string[];
  city?: string;
  district?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  period?: Period;
}

/** FHIR ContactPoint — details for a technology-mediated contact point */
export interface ContactPoint {
  system?: 'phone' | 'fax' | 'email' | 'pager' | 'url' | 'sms' | 'other';
  value?: string;
  use?: 'home' | 'work' | 'temp' | 'old' | 'mobile';
  rank?: number;
  period?: Period;
}

/** FHIR Dosage instruction */
export interface Dosage {
  sequence?: number;
  text?: string;
  timing?: {
    repeat?: {
      frequency?: number;
      period?: number;
      periodUnit?: 's' | 'min' | 'h' | 'd' | 'wk' | 'mo' | 'a';
    };
  };
  route?: CodeableConcept;
  doseAndRate?: Array<{
    type?: CodeableConcept;
    doseQuantity?: Quantity;
  }>;
}

/** FHIR Ratio — numerator/denominator quantity pair (FHIR R4 §2.24.0.2) */
export interface Ratio {
  numerator?: Quantity;
  denominator?: Quantity;
}

/** FHIR Attachment — content in a format such as PDF, image, or HL7 v2 message */
export interface Attachment {
  /** MIME type — e.g. "application/pdf", "image/png" */
  contentType?: string;
  /** BCP 47 language code */
  language?: string;
  /** Base64-encoded data */
  data?: string;
  /** URL pointing to external content */
  url?: string;
  /** Expected size in bytes */
  size?: number;
  /** MD5 hash of data for integrity check */
  hash?: string;
  /** Human-readable title */
  title?: string;
  /** Date of creation (ISO 8601 datetime) */
  creation?: string;
}

// ── Base resource interfaces ─────────────────────────────────────────────────

/** Base FHIR Resource — every resource has resourceType and optional id */
export interface Resource {
  readonly resourceType: string;
  id?: string;
  meta?: Meta;
  implicitRules?: string;
  language?: string;
}

/** FHIR DomainResource — resource with narrative, extensions, and contained resources */
export interface DomainResource extends Resource {
  text?: Narrative;
  contained?: Resource[];
  extension?: Extension[];
  modifierExtension?: Extension[];
}

// ── Validation types ─────────────────────────────────────────────────────────

/** Severity of a validation issue */
export type ValidationSeverity = 'error' | 'warning';

/** A single validation issue found during resource validation */
export interface ValidationError {
  path: string;
  message: string;
  severity: ValidationSeverity;
}

/** Result of validating a FHIR resource */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
