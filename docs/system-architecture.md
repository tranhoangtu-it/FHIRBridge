# System Architecture

## Overview

FHIRBridge is a Turborepo monorepo with 5 packages. Data flows in a single direction: connectors fetch raw records → core transforms to FHIR → AI engine summarizes → API/CLI/Web deliver to the user. No PHI is persisted at any stage.

```
┌─────────────────────────────────────────────────────────────┐
│                        Clients                              │
│   @fhirbridge/cli      @fhirbridge/web      REST consumers  │
└────────────┬───────────────────┬──────────────────┬─────────┘
             │                   │                  │
             └───────────────────▼──────────────────┘
                          @fhirbridge/api
                         (Fastify server)
                                 │
                    ┌────────────▼────────────┐
                    │     @fhirbridge/core     │
                    │  connectors │ pipeline  │
                    │  bundle     │ ai engine │
                    └────────────┬────────────┘
                                 │
                    ┌────────────▼────────────┐
                    │    @fhirbridge/types     │
                    │  FHIR R4 type defs       │
                    └─────────────────────────┘
```

---

## Package Dependency Graph

```
@fhirbridge/types   (no internal deps)
       ▲
       │
@fhirbridge/core    (depends on: types)
       ▲
       ├────────────────────────────┐
@fhirbridge/api     @fhirbridge/cli
(depends on: core, types)  (depends on: core, types)
       ▲
@fhirbridge/web     (depends on: api via HTTP — no workspace dep)
```

Inter-package deps use `workspace:*` protocol via pnpm.

---

## Package Details

### `@fhirbridge/types`
Location: `packages/types/src/`

Shared TypeScript interfaces — no runtime logic.

| Directory | Contents |
|---|---|
| `fhir/` | `Patient`, `Encounter`, `Condition`, `Observation`, `MedicationRequest`, `AllergyIntolerance`, `Procedure`, `DiagnosticReport`, `Bundle`, `BaseResource` |
| `connectors/` | `ConnectorConfig`, `MappingConfig` |
| `ai/` | `AiConfig`, summary types (`SummaryResult`, `SummarySection`, etc.) |

---

### `@fhirbridge/core`
Location: `packages/core/src/`

The FHIR engine. All business logic lives here.

#### Coding (`coding/`)
- `code-systems.ts` — LOINC, SNOMED CT, RxNorm system URIs
- `code-system-lookup.ts` — resolve code system from string

#### Validators (`validators/`)
- `resource-validator.ts` — base `ValidationResult` pattern (`{ valid, errors }`)
- `patient-validator.ts` — required fields, gender enum, birthDate format
- `coding-validator.ts` — validates coding system + code presence
- `reference-validator.ts` — checks `resourceType/id` reference format

#### Bundle (`bundle/`)
- `bundle-builder.ts` — assembles FHIR collection bundle with `urn:uuid` fullUrls
- `bundle-serializer.ts` — `serializeToJson()`, `serializeToNdjson()`

#### Pipeline (`pipeline/`)
- `resource-transformer.ts` — maps raw records to typed FHIR resources
- `transform-pipeline.ts` — async generator pipeline with backpressure (10 K resource cap)

#### Connectors (`connectors/`)
All implement `HisConnectorInterface` (adapter pattern).

| Connector | File | Notes |
|---|---|---|
| FHIR endpoint | `fhir-endpoint-connector.ts` | SMART on FHIR token, pagination |
| CSV | `csv-connector.ts` | Streaming, multi-encoding |
| Excel | `excel-connector.ts` | SheetJS |
| Column mapper | `column-mapper.ts` | Resolves LOINC/SNOMED/RxNorm column headers |
| Retry handler | `retry-handler.ts` | Exponential backoff for connector calls |

SSRF protection: `fhir-endpoint-connector.ts` validates `baseUrl` against private IP ranges before any outbound request.

#### AI Engine (`ai/`)

```
Bundle ──► deidentifier ──► provider-gateway ──► section-summarizer
                                                          │
                                               synthesis-engine
                                                          │
                                               summary-formatter ──► Markdown | FHIR Composition
```

| File | Role |
|---|---|
| `deidentifier.ts` | Removes PHI; HMAC-SHA256 IDs, date shift ±30 days |
| `ai-provider-interface.ts` | Provider contract |
| `claude-provider.ts` | Anthropic Claude adapter |
| `openai-provider.ts` | OpenAI adapter |
| `provider-gateway.ts` | Selects provider from config |
| `section-summarizer.ts` | Per-section token-budgeted summaries |
| `synthesis-engine.ts` | Merges section summaries into final summary |
| `summary-formatter.ts` | Outputs Markdown or FHIR Composition |
| `prompt-templates.ts` | Prompt strings for EN/VI/JA × 3 detail levels |
| `token-tracker.ts` | Tracks token usage across provider calls |

---

### `@fhirbridge/api`
Location: `packages/api/src/`

Fastify REST server. No PHI is stored.

#### Server Bootstrap (`server.ts`)
Registers plugins in order: CORS → request-id → auth → rate-limiter → audit → routes.

#### Plugins (`plugins/`)
| Plugin | File | Notes |
|---|---|---|
| Auth | `auth-plugin.ts` | JWT verification via `@fastify/jwt` |
| CORS | `cors-plugin.ts` | Configurable origins via `CORS_ORIGINS` |
| Rate limiter | `rate-limiter-plugin.ts` | In-memory store (Redis interface ready) |
| Audit | `audit-plugin.ts` | Logs action + resource count, no PHI |
| Request ID | `request-id-plugin.ts` | UUID per request for tracing |

#### Routes

| Method | Path | Handler |
|---|---|---|
| GET | `/health` | `health-routes.ts` |
| POST | `/api/v1/export` | Start async export, returns `exportId` |
| GET | `/api/v1/export/:id/status` | Poll export status |
| GET | `/api/v1/export/:id/download` | Stream bundle (JSON or NDJSON) |
| POST | `/api/v1/connector` | `connector-routes.ts` |
| POST | `/api/v1/summary` | `summary-routes.ts` |

IDOR protection: status and download endpoints verify `userId` ownership before returning data.

#### Services (`services/`)
- `export-service.ts` — manages async export lifecycle
- `summary-service.ts` — delegates to core AI engine
- `audit-service.ts` — writes audit records (hashed user ID, action, count)

---

### `@fhirbridge/cli`
Location: `packages/cli/src/`

Commander.js CLI tool.

| Command | File |
|---|---|
| `export` | `commands/export-command.ts` |
| `import` | `commands/import-command.ts` |
| `summarize` | `commands/summarize-command.ts` |
| `validate` | `commands/validate-command.ts` |
| `config` | `commands/config-command.ts` |

Supporting modules: `logger.ts`, `file-writer.ts`, `progress-display.ts`, `json-formatter.ts`, `table-formatter.ts`, `profile-store.ts`, `config-manager.ts`.

---

### `@fhirbridge/web`
Location: `packages/web/src/`

Vite + React SPA. Communicates with `@fhirbridge/api` over HTTP — no workspace dependency.

#### Pages (`pages/`)
| Page | File |
|---|---|
| Dashboard | `dashboard-page.tsx` |
| Export wizard | `export-wizard-page.tsx` |
| Import (CSV/Excel) | `import-page.tsx` |
| Summary viewer | `summary-viewer-page.tsx` |
| Settings | `settings-page.tsx` |

#### Components (`components/`)
| Group | Components |
|---|---|
| Layout | `app-sidebar.tsx`, `app-header.tsx`, `page-container.tsx` |
| Export | `connector-form.tsx`, `export-progress.tsx`, `export-result.tsx` |
| Import | `file-dropzone.tsx`, `preview-table.tsx`, `column-mapper.tsx` |
| Summary | `summary-config.tsx`, `summary-display.tsx`, `summary-actions.tsx` |
| Shared | `loading-spinner.tsx`, `status-badge.tsx`, `error-boundary.tsx` |

#### API Client (`api/`)
- `api-client.ts` — base fetch wrapper
- `export-api.ts`, `connector-api.ts`, `summary-api.ts`, `health-api.ts`

#### Hooks (`hooks/`)
- `use-api.ts`, `use-polling.ts`, `use-file-upload.ts`, `use-export.ts`

---

## Infrastructure

### Docker (`docker/`)
- Postgres 16 — audit logs only, no PHI
- Redis 7 — rate limiting + job queues (Redis integration deferred in MVP, in-memory used)

### Scripts (`scripts/`)
- `setup.sh` — installs deps, starts Docker, initializes DB
- Test data generation utilities

---

## Data Flow

```
1. User triggers export (CLI / API / Web)
2. ConnectorConfig identifies source (FHIR endpoint | CSV | Excel)
3. Core connector fetches raw records (streaming)
4. transform-pipeline converts records → FHIR resources (async generator)
5. bundle-builder assembles FHIR collection Bundle
6. [Optional] deidentifier strips PHI, shifts dates
7. [Optional] section-summarizer + synthesis-engine generate AI summary
8. summary-formatter outputs Markdown or FHIR Composition
9. bundle-serializer produces JSON or NDJSON
10. Response streamed to caller — nothing written to disk
```

---

## Security Model

| Concern | Mitigation |
|---|---|
| PHI at rest | None stored — stream-only pipeline |
| AI data leakage | HMAC-SHA256 de-identification before every AI call |
| IDOR | `userId` ownership check on export status/download |
| SSRF | Private IP validation on connector `baseUrl` |
| Brute force | JWT auth + rate limiting on all routes |
| Audit trail | Hashed user ID, action type, resource count logged |
