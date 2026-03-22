---
title: "Phase 2 — Core FHIR Engine"
status: complete
priority: P1
effort: 24h
owner: Dev 1
---

# Phase 2 — Core FHIR Engine

## Context Links
- [Plan Overview](./plan.md)
- [FHIR R4 Spec](https://hl7.org/fhir/R4/)
- [fhir-kit-client](https://github.com/Vermonster/fhir-kit-client)
- Phase dependency: [Phase 1](./phase-01-project-setup.md)

## Overview
Build `@fhirbridge/core` — the FHIR resource handling engine. Includes TypeScript types for 8 resource types, FHIR Bundle builder, resource validators, and a streaming pipeline that transforms HIS data into valid FHIR R4 bundles. Zero storage — all operations are stream/transform.

## Priority
**P1** — Foundation for all export functionality.

## Requirements

### Functional
- Type-safe interfaces for 8 FHIR R4 resources (Patient, Encounter, Condition, Observation, MedicationRequest, AllergyIntolerance, Procedure, DiagnosticReport)
- Bundle builder: create `collection` type Bundle with `urn:uuid` fullUrls
- Resource validators: validate required fields, coding systems, references
- Streaming pipeline: transform source data → validated FHIR resources → Bundle
- Export formats: FHIR JSON Bundle, NDJSON

### Non-Functional
- Stream processing — never buffer full patient record in memory
- <200 LOC per file
- 90%+ test coverage on validators
- Synthea data passes all validators

## Architecture

```
@fhirbridge/types
├── fhir/
│   ├── base-resource.ts      # Resource, DomainResource, Reference, CodeableConcept
│   ├── patient.ts            # Patient resource type
│   ├── encounter.ts          # Encounter resource type
│   ├── condition.ts          # Condition resource type
│   ├── observation.ts        # Observation resource type
│   ├── medication-request.ts # MedicationRequest resource type
│   ├── allergy-intolerance.ts # AllergyIntolerance resource type
│   ├── procedure.ts          # Procedure resource type
│   ├── diagnostic-report.ts  # DiagnosticReport resource type
│   ├── bundle.ts             # Bundle, BundleEntry types
│   └── index.ts              # barrel export

@fhirbridge/core
├── validators/
│   ├── resource-validator.ts    # Base validator with common checks
│   ├── patient-validator.ts     # Patient-specific validation
│   ├── coding-validator.ts      # Validate CodeableConcept, Coding
│   ├── reference-validator.ts   # Validate resource references
│   └── index.ts
├── bundle/
│   ├── bundle-builder.ts        # Build FHIR Bundle from resources
│   ├── bundle-serializer.ts     # JSON + NDJSON output
│   └── index.ts
├── pipeline/
│   ├── transform-pipeline.ts    # Streaming transform orchestrator
│   ├── resource-transformer.ts  # Raw data → FHIR resource mapping
│   └── index.ts
├── coding/
│   ├── code-system-lookup.ts    # LOINC, SNOMED CT, RxNorm lookups
│   ├── code-systems.ts          # System URI constants
│   └── index.ts
└── index.ts
```

### Data Flow
```
Source Data (FHIR endpoint / CSV)
  → resource-transformer (map to FHIR types)
  → resource-validator (validate structure + codes)
  → bundle-builder (wrap in Bundle with UUIDs)
  → bundle-serializer (JSON / NDJSON output)
  → Stream to caller (API / CLI)
```

## Related Code Files

### Files to Create — @fhirbridge/types
- `packages/types/src/fhir/base-resource.ts` — Resource, Meta, Reference, CodeableConcept, Coding, HumanName, Address, ContactPoint, Period, Identifier
- `packages/types/src/fhir/patient.ts` — Patient interface extending DomainResource
- `packages/types/src/fhir/encounter.ts` — Encounter with class, status, period
- `packages/types/src/fhir/condition.ts` — Condition with code, clinicalStatus, verificationStatus
- `packages/types/src/fhir/observation.ts` — Observation with value[x], component
- `packages/types/src/fhir/medication-request.ts` — MedicationRequest with medication, dosageInstruction
- `packages/types/src/fhir/allergy-intolerance.ts` — AllergyIntolerance with reaction, criticality
- `packages/types/src/fhir/procedure.ts` — Procedure with code, status, performedPeriod
- `packages/types/src/fhir/diagnostic-report.ts` — DiagnosticReport with result references, conclusion
- `packages/types/src/fhir/bundle.ts` — Bundle, BundleEntry, BundleType enum
- `packages/types/src/fhir/index.ts` — barrel export
- `packages/types/src/index.ts` — re-export fhir/*

### Files to Create — @fhirbridge/core
- `packages/core/src/validators/resource-validator.ts` — `validateResource(resource): ValidationResult`
- `packages/core/src/validators/patient-validator.ts` — `validatePatient(patient): ValidationResult`
- `packages/core/src/validators/coding-validator.ts` — `validateCoding(coding, system?): ValidationResult`
- `packages/core/src/validators/reference-validator.ts` — `validateReference(ref, bundle): ValidationResult`
- `packages/core/src/validators/index.ts`
- `packages/core/src/bundle/bundle-builder.ts` — `class BundleBuilder { addResource(), build(): Bundle }`
- `packages/core/src/bundle/bundle-serializer.ts` — `serializeToJson(bundle), serializeToNdjson(bundle)`
- `packages/core/src/pipeline/transform-pipeline.ts` — `class TransformPipeline { pipe(source): AsyncIterable<Bundle> }`
- `packages/core/src/pipeline/resource-transformer.ts` — `transformToFhir(rawData, resourceType): Resource`
- `packages/core/src/coding/code-system-lookup.ts` — `lookupCode(system, code): CodeInfo`
- `packages/core/src/coding/code-systems.ts` — `LOINC_SYSTEM`, `SNOMED_SYSTEM`, `RXNORM_SYSTEM` URI constants
- `packages/core/src/index.ts`

### Test Files to Create
- `packages/core/src/validators/__tests__/resource-validator.test.ts`
- `packages/core/src/validators/__tests__/patient-validator.test.ts`
- `packages/core/src/bundle/__tests__/bundle-builder.test.ts`
- `packages/core/src/bundle/__tests__/bundle-serializer.test.ts`
- `packages/core/src/pipeline/__tests__/transform-pipeline.test.ts`

## Implementation Steps

1. **Define FHIR base types** (`packages/types/src/fhir/base-resource.ts`)
   - `Resource`: resourceType, id, meta
   - `DomainResource`: extends Resource + text, contained, extension
   - `Reference`: reference, type, display
   - `CodeableConcept`: coding[], text
   - `Coding`: system, code, display
   - `HumanName`: use, family, given[], prefix[], suffix[]
   - `Identifier`: system, value, use
   - `Period`: start, end
   - `Address`, `ContactPoint`

2. **Define 8 resource types** (one file each)
   - Follow FHIR R4 spec exactly for required vs optional fields
   - Use `readonly` for immutable fields
   - Patient: identifier, name, gender, birthDate, address, telecom
   - Encounter: status, class, type, subject, period, reasonCode
   - Condition: clinicalStatus, verificationStatus, code, subject, onsetDateTime
   - Observation: status, category, code, subject, effectiveDateTime, valueQuantity/valueCodeableConcept
   - MedicationRequest: status, intent, medicationCodeableConcept, subject, dosageInstruction
   - AllergyIntolerance: clinicalStatus, type, category, criticality, code, patient, reaction
   - Procedure: status, code, subject, performedPeriod
   - DiagnosticReport: status, category, code, subject, result[], conclusion

3. **Define Bundle types** (`packages/types/src/fhir/bundle.ts`)
   - `BundleType`: 'collection' | 'document' | 'message' | 'transaction' | 'searchset'
   - `BundleEntry`: fullUrl (urn:uuid), resource, search?, request?, response?
   - `Bundle`: resourceType 'Bundle', type, entry[], total?

4. **Build resource validators** (`packages/core/src/validators/`)
   - `ValidationResult`: `{ valid: boolean; errors: ValidationError[] }`
   - `ValidationError`: `{ path: string; message: string; severity: 'error' | 'warning' }`
   - `resource-validator.ts`: check resourceType present, id format, meta structure
   - `patient-validator.ts`: require name[0].family, gender in enum, birthDate format
   - `coding-validator.ts`: validate system URI format, code non-empty, known systems
   - `reference-validator.ts`: validate reference format (urn:uuid: or relative), resolve within bundle

5. **Build BundleBuilder** (`packages/core/src/bundle/bundle-builder.ts`)
   ```typescript
   class BundleBuilder {
     private entries: BundleEntry[] = [];
     addResource(resource: Resource): string; // returns generated UUID
     build(): Bundle; // creates collection Bundle
     getResourceCount(): number;
   }
   ```
   - Generate `urn:uuid:{uuidv4}` for each fullUrl
   - Return UUID so callers can create cross-references

6. **Build BundleSerializer** (`packages/core/src/bundle/bundle-serializer.ts`)
   - `serializeToJson(bundle: Bundle): string` — pretty-printed JSON
   - `serializeToNdjson(bundle: Bundle): string` — one resource per line
   - `createReadableStream(bundle: Bundle, format: 'json' | 'ndjson'): ReadableStream`

7. **Build code system utilities** (`packages/core/src/coding/`)
   - Constants: `LOINC_SYSTEM = 'http://loinc.org'`, `SNOMED_SYSTEM = 'http://snomed.info/sct'`, `RXNORM_SYSTEM = 'http://www.nlm.nih.gov/research/umls/rxnorm'`
   - `lookupCode(system, code)`: return display name from embedded subset (common vital signs, conditions)
   - Embedded lookup tables for top ~100 LOINC codes (vitals, labs), common SNOMED conditions

8. **Build resource transformer** (`packages/core/src/pipeline/resource-transformer.ts`)
   - `transformToFhir(rawData: Record<string, unknown>, resourceType: string, mappingConfig?): Resource`
   - Default mapping: direct field-name match with FHIR paths
   - Custom mapping via config object: `{ sourceField: 'fhirPath' }`
   - Handle date format normalization, code system resolution

9. **Build transform pipeline** (`packages/core/src/pipeline/transform-pipeline.ts`)
   - `TransformPipeline`: async generator pattern
   - Input: `AsyncIterable<RawRecord>` from connector
   - Steps: transform → validate → collect → bundle
   - Emit validation warnings via callback, halt on errors
   - Stream output — never hold full bundle in memory for large datasets

10. **Write tests with Synthea data**
    - Load Synthea-generated bundles from `tests/fixtures/synthea/`
    - Validate each resource type against validators
    - Test BundleBuilder creates valid bundles
    - Test round-trip: parse Synthea → validate → re-bundle → validate
    - Test NDJSON serialization/deserialization

## Todo List
- [x] FHIR base types (Resource, Reference, CodeableConcept, etc.)
- [x] Patient resource type + validator
- [x] Encounter resource type
- [x] Condition resource type
- [x] Observation resource type
- [x] MedicationRequest resource type
- [x] AllergyIntolerance resource type
- [x] Procedure resource type
- [x] DiagnosticReport resource type
- [x] Bundle types
- [x] BundleBuilder class
- [x] BundleSerializer (JSON + NDJSON)
- [x] Code system constants + lookup
- [x] Resource transformer
- [x] Transform pipeline (async streaming)
- [x] Validator tests (resource + patient validators — 28 tests)
- [x] Bundle builder tests (15 tests)
- [x] Pipeline integration tests (15 tests + 15 serializer tests)

## Success Criteria
- All 8 FHIR resource types have TypeScript interfaces matching R4 spec
- Synthea bundles pass validation without errors
- BundleBuilder creates valid `collection` bundles with `urn:uuid` fullUrls
- Pipeline processes 1000 resources in <2s (streaming)
- 90%+ test coverage on validators

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| FHIR R4 spec complexity — many optional fields | High | Start with required fields only, add optional incrementally |
| Synthea data may use extensions not in types | Medium | Allow `extension?: Extension[]` on all DomainResources |
| Code system lookups incomplete | Low | Embedded subset for MVP, API lookup in future |
| Streaming pipeline backpressure | Medium | Use Node.js built-in stream backpressure mechanisms |

## Security Considerations
- No PHI storage — all transforms are in-memory streams
- Validator does NOT log resource content (only field paths in errors)
- Code system lookups use only codes, never patient data

## File Ownership
```
packages/types/src/fhir/**  → Dev 1
packages/core/src/**        → Dev 1
```
