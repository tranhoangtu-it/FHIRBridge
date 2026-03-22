# FHIRBridge — Product Development Requirements

## Product Summary

| Field | Value |
|---|---|
| Product | FHIRBridge — Patient Data Portability Tool |
| Version | 0.1.0 (MVP) |
| Date | 2026-03-22 |
| Status | MVP Complete |

**Mission:** Enable patients to export their medical data from HIS systems in FHIR R4 format with AI-generated summaries, with zero PHI stored at any point.

**Target markets:** Vietnam (34M+ VneID digital IDs), Japan

**Revenue model:** Open source core (MIT) + $5/export cloud tier

---

## Problem Statement

Patients in Vietnam and Japan cannot easily obtain or transfer their own medical records. Hospital Information Systems (HIS) store data in proprietary formats. Interoperability is fragmented — no standard patient-facing export exists.

---

## Requirements

### Functional Requirements

| ID | Requirement | Status |
|----|-------------|--------|
| FR-01 | Export FHIR R4 bundles with 8 resource types | Done |
| FR-02 | Connect to FHIR R4 endpoints (SMART on FHIR, pagination) | Done |
| FR-03 | Import from CSV files (streaming, multi-encoding) | Done |
| FR-04 | Import from Excel files (SheetJS) | Done |
| FR-05 | Map CSV/Excel columns to FHIR fields (LOINC/SNOMED/RxNorm) | Done |
| FR-06 | De-identify PHI before AI processing (HMAC-SHA256) | Done |
| FR-07 | AI summaries via Anthropic Claude and OpenAI | Done |
| FR-08 | Summaries in EN, VI, JA at 3 detail levels | Done |
| FR-09 | Markdown and FHIR Composition output formats | Done |
| FR-10 | REST API (Fastify, JWT auth, rate limiting, audit) | Done |
| FR-11 | CLI tool (export, import, summarize, validate, config) | Done |
| FR-12 | Web dashboard (export wizard, import, column mapper, summary viewer) | Done |
| FR-13 | PDF output | Deferred (stub in place) |

### Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| NFR-01 | Zero PHI at rest — stream-only architecture | Enforced |
| NFR-02 | API throughput | Fastify ≥ 2x Express baseline |
| NFR-03 | Bundle size cap | 10,000 resources max per export |
| NFR-04 | Rate limiting | 100 req/min per user (configurable) |
| NFR-05 | TypeScript strict mode across all packages | Enforced |
| NFR-06 | Test coverage | 228 tests passing, core 197 |
| NFR-07 | Web bundle | ≤ 135 KB gzip |

---

## FHIR Resource Types

The following FHIR R4 resource types are exported in each patient bundle:

- `Patient`
- `Encounter`
- `Condition`
- `Observation`
- `MedicationRequest`
- `AllergyIntolerance`
- `Procedure`
- `DiagnosticReport`

---

## Privacy Architecture

**Privacy-by-design principles:**

1. No patient data is written to disk or database at any stage.
2. PHI is de-identified before leaving the server to AI providers.
3. Audit logs store only hashed user IDs, action types, and resource counts — no PHI.
4. Rate limiting and IDOR protection prevent data enumeration attacks.

**De-identification fields removed:** names, telecom, address line/postalCode, extensions, narrative text, note fields, `valueString` free-text.

**De-identification fields preserved:** medical codes (LOINC, SNOMED, RxNorm), observation values, dosages, city/state/country.

---

## Acceptance Criteria

- All 8 FHIR resource types serialize to valid FHIR R4 JSON.
- De-identified bundle contains no names, phone numbers, email, or postal codes.
- AI summary produced for a 10-resource bundle in < 30 seconds.
- CLI `export` command completes without errors on a sample FHIR endpoint.
- Web dashboard export wizard completes end-to-end.
- 228/228 unit tests pass.

---

## Known Constraints & Tech Debt

| Item | Severity | Notes |
|---|---|---|
| PDF formatter | Medium | Puppeteer dependency deferred |
| Redis rate limiter | Medium | In-memory store, Redis interface ready |
| Postgres audit sink | Medium | Console sink active, `AuditSink` interface ready |
| Connector import route | Medium | Multipart file upload stub, full pipeline pending |
| `trustProxy: true` | Medium | Use specific proxy CIDRs in production |
| Web component tests | Low | `@testing-library/react` not configured |
