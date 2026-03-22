# Project Roadmap

## Phase 1: MVP — Complete

All 7 implementation phases delivered. 228/228 tests passing.

| Phase | Description | Status |
|---|---|---|
| 1.1 | Monorepo scaffold (Turborepo, pnpm, TypeScript, Vitest) | Done |
| 1.2 | `@fhirbridge/types` — FHIR R4 type definitions | Done |
| 1.3 | `@fhirbridge/core` — FHIR engine (validators, bundle builder, pipeline) | Done |
| 1.4 | `@fhirbridge/core` — Connectors (FHIR endpoint, CSV, Excel, column mapper) | Done |
| 1.5 | `@fhirbridge/core` — AI engine (de-identifier, summarizers, formatters) | Done |
| 1.6 | `@fhirbridge/api` — Fastify REST server (auth, rate limit, audit, routes) | Done |
| 1.7 | `@fhirbridge/cli` + `@fhirbridge/web` — CLI and web dashboard | Done |

**MVP capabilities:**
- Export FHIR R4 bundles (8 resource types) from FHIR endpoints, CSV, or Excel
- AI summaries via Claude or OpenAI — de-identified before transmission
- EN/VI/JA summaries at 3 detail levels
- Markdown and FHIR Composition output
- CLI (`export`, `import`, `summarize`, `validate`, `config`)
- Web dashboard (export wizard, import, column mapper, summary viewer)
- JWT auth + rate limiting + audit logging (no PHI)

---

## Phase 2: Production Ready

Target: integration-tested, infrastructure-complete, PDF output.

| Item | Priority | Notes |
|---|---|---|
| Redis rate limiter | High | Replace in-memory store with `@fastify/rate-limit` + Redis |
| Postgres audit sink | High | Wire `AuditSink` interface to Postgres, replace console sink |
| PDF formatter | Medium | Implement Puppeteer-based PDF generation (stub exists) |
| Connector import route | High | Complete multipart file pipeline in `connector-routes.ts` |
| `trustProxy` config | High | Replace `true` with specific proxy CIDRs |
| Synthea integration tests | Medium | End-to-end tests with generated patient data |
| Web component tests | Low | Add `@testing-library/react`, cover key components |
| Docker Compose production profile | Medium | Separate dev/prod compose files with resource limits |

---

## Phase 3: Market Entry

Target: billing, certification, Vietnam + Japan launch.

| Item | Priority | Notes |
|---|---|---|
| Billing integration | High | Stripe (global) + SePay (Vietnam) for $5/export cloud tier |
| SMART on FHIR certification | High | Pass SMART App Launch conformance tests |
| VneID integration | High | Vietnam national ID connector (34M+ users) |
| Japan My Number connector | Medium | JAMI-compliant connector |
| Multi-language UI | Medium | VI and JA web dashboard localization |
| Export history | Medium | Per-user export history (hashed IDs, no PHI) |
| External de-identification audit | High | Security review before handling real patient data |

---

## Phase 4: Scale

Target: enterprise, bulk export, multi-tenant.

| Item | Priority | Notes |
|---|---|---|
| HL7 FHIR Bulk Data API | High | `$export` operation, NDJSON streaming |
| Multi-tenant architecture | High | Separate audit namespaces per organization |
| Background job queue | Medium | BullMQ on Redis for long-running exports |
| Usage analytics dashboard | Medium | Aggregated, PHI-free usage metrics for operators |
| Connector SDK | Medium | Public interface for third-party HIS connectors |
| SLA monitoring | Medium | Uptime, export latency, AI provider fallback |

---

## Backlog (Unscheduled)

- HL7 v2 connector
- DICOM reference handling
- FHIR Questionnaire / patient intake forms
- Clinician portal (separate from patient-facing dashboard)
- On-premise self-hosted Docker image (single-container)
