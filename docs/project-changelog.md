# Changelog

All notable changes to FHIRBridge are documented here.

Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)

---

## [0.1.0] — 2026-03-22

### Added

**Monorepo infrastructure**
- Turborepo + pnpm workspace monorepo with 5 packages
- TypeScript strict mode, ES2022 target across all packages
- Vitest test framework — 228 tests, 0 failures
- ESLint + Prettier configuration
- Docker Compose: Postgres 16 + Redis 7
- `scripts/setup.sh` for one-command local setup

**`@fhirbridge/types`**
- FHIR R4 type definitions: `Patient`, `Encounter`, `Condition`, `Observation`, `MedicationRequest`, `AllergyIntolerance`, `Procedure`, `DiagnosticReport`, `Bundle`
- Connector config types (`ConnectorConfig`, `MappingConfig`)
- AI config and summary types (`AiConfig`, `SummaryResult`, `SummarySection`)

**`@fhirbridge/core` — FHIR engine**
- `ValidationResult` pattern for all validators (no throws)
- `resource-validator.ts`, `patient-validator.ts`, `coding-validator.ts`, `reference-validator.ts`
- `bundle-builder.ts` — collection bundle with `urn:uuid` fullUrls
- `bundle-serializer.ts` — `serializeToJson()`, `serializeToNdjson()`
- `transform-pipeline.ts` — async generator pipeline, 10K resource cap

**`@fhirbridge/core` — Connectors**
- `fhir-endpoint-connector.ts` — SMART on FHIR OAuth2, pagination, SSRF protection
- `csv-connector.ts` — streaming, multi-encoding support
- `excel-connector.ts` — SheetJS-based Excel parsing
- `column-mapper.ts` — LOINC/SNOMED/RxNorm column header resolution
- `retry-handler.ts` — exponential backoff for connector calls
- `HisConnectorInterface` — adapter interface for all connectors

**`@fhirbridge/core` — AI engine**
- `deidentifier.ts` — HMAC-SHA256 ID hashing, ±30-day date shifting, PHI field stripping
- `claude-provider.ts` — Anthropic Claude adapter
- `openai-provider.ts` — OpenAI adapter
- `provider-gateway.ts` — provider selection from config
- `section-summarizer.ts` — token-budgeted per-section summaries
- `synthesis-engine.ts` — merges section summaries into final output
- `summary-formatter.ts` — Markdown and FHIR Composition output
- `prompt-templates.ts` — EN/VI/JA prompts at 3 detail levels
- `token-tracker.ts` — tracks token usage per call

**`@fhirbridge/api`**
- Fastify REST server with plugin chain: CORS → request-id → auth → rate-limiter → audit
- JWT authentication via `@fastify/jwt`
- In-memory rate limiter (Redis interface ready)
- Audit plugin — logs hashed user ID, action, resource count (no PHI)
- Routes: `POST /api/v1/export`, `GET /api/v1/export/:id/status`, `GET /api/v1/export/:id/download`, connector and summary routes, health check
- IDOR protection on export status/download endpoints
- JSON Schema validation on all route bodies

**`@fhirbridge/cli`**
- Commander.js CLI with commands: `export`, `import`, `summarize`, `validate`, `config`
- Profile store for saved connector configurations
- Progress display, JSON formatter, table formatter

**`@fhirbridge/web`**
- Vite + React SPA, Tailwind CSS, medical blue/teal theme, dark mode
- Pages: dashboard, export wizard, import (CSV/Excel), summary viewer, settings
- Column mapper component with LOINC/SNOMED/RxNorm resolution
- File dropzone with preview table
- Export progress polling and result download
- API client layer (`api-client.ts`, domain-specific modules, custom hooks)

### Security

- IDOR vulnerability patched: `userId` ownership check on export endpoints
- SSRF vulnerability patched: private IP validation on connector `baseUrl`
- De-identifier extended: `text`, `extension`, `note`, `valueString` fields stripped
- PHI leakage via `valueString` fixed: redacted to `[CLINICAL_TEXT_REDACTED]`

### Known Issues (carry-forward to 0.2.0)

- PDF formatter is a stub — Puppeteer dependency deferred
- Rate limiter uses in-memory store — Redis integration deferred
- Postgres audit sink uses console sink — interface in place for swap
- Connector import route (multipart) is a stub — full pipeline pending
- `trustProxy: true` should use specific proxy CIDRs in production
- Web component tests not configured (`@testing-library/react` missing)
