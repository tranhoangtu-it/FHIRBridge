# Codebase Summary

Generated: 2026-03-22

## Repository

Turborepo monorepo managed with pnpm. 5 packages, 185 total files (100 `.ts` + 22 `.tsx` + 17 test files + config/tooling).

```
fhirbridge/
├── packages/
│   ├── types/    @fhirbridge/types   — FHIR R4 type definitions (no runtime logic)
│   ├── core/     @fhirbridge/core    — FHIR engine, connectors, AI engine
│   ├── api/      @fhirbridge/api     — Fastify REST server
│   ├── cli/      @fhirbridge/cli     — Commander.js CLI
│   └── web/      @fhirbridge/web     — Vite + React SPA
├── docker/                           — Postgres 16 + Redis 7 compose file
├── scripts/                          — setup.sh, test data generation
├── .env.example
└── turbo.json
```

---

## Package Inventory

### `@fhirbridge/types` (packages/types/src/)

Pure TypeScript interfaces, no runtime dependencies.

| Module | Files |
|---|---|
| `fhir/` | `base-resource.ts`, `patient.ts`, `encounter.ts`, `condition.ts`, `observation.ts`, `medication-request.ts`, `allergy-intolerance.ts`, `procedure.ts`, `diagnostic-report.ts`, `bundle.ts`, `index.ts` |
| `connectors/` | `connector-config.ts`, `mapping-config.ts`, `index.ts` |
| `ai/` | `ai-config.ts`, `summary-types.ts`, `index.ts` |
| root | `index.ts` (re-exports all) |

---

### `@fhirbridge/core` (packages/core/src/)

197 unit tests. The FHIR engine, connectors, and AI processing pipeline.

| Module | Key Files |
|---|---|
| `coding/` | `code-systems.ts`, `code-system-lookup.ts`, `index.ts` |
| `validators/` | `resource-validator.ts`, `patient-validator.ts`, `coding-validator.ts`, `reference-validator.ts`, `index.ts` |
| `bundle/` | `bundle-builder.ts`, `bundle-serializer.ts`, `index.ts` |
| `pipeline/` | `resource-transformer.ts`, `transform-pipeline.ts`, `index.ts` |
| `connectors/` | `his-connector-interface.ts`, `fhir-endpoint-connector.ts`, `csv-connector.ts`, `excel-connector.ts`, `column-mapper.ts`, `retry-handler.ts`, `index.ts` |
| `ai/` | `deidentifier.ts`, `ai-provider-interface.ts`, `claude-provider.ts`, `openai-provider.ts`, `provider-gateway.ts`, `section-summarizer.ts`, `synthesis-engine.ts`, `summary-formatter.ts`, `prompt-templates.ts`, `token-tracker.ts`, `index.ts` |
| root | `index.ts` |

Test files: `__tests__/` subdirectory in each module.

---

### `@fhirbridge/api` (packages/api/src/)

15 unit tests.

| Module | Key Files |
|---|---|
| root | `index.ts`, `server.ts`, `config.ts` |
| `plugins/` | `auth-plugin.ts`, `cors-plugin.ts`, `rate-limiter-plugin.ts`, `audit-plugin.ts`, `request-id-plugin.ts`, `plugin-utils.ts` |
| `routes/` | `health-routes.ts`, `export-routes.ts`, `connector-routes.ts`, `summary-routes.ts` |
| `schemas/` | `export-schemas.ts`, `connector-schemas.ts`, `summary-schemas.ts` |
| `services/` | `export-service.ts`, `summary-service.ts`, `audit-service.ts` |
| `middleware/` | `error-handler.ts` |

---

### `@fhirbridge/cli` (packages/cli/src/)

16 unit tests.

| Module | Key Files |
|---|---|
| root | `index.ts` (Commander.js entry) |
| `commands/` | `export-command.ts`, `import-command.ts`, `summarize-command.ts`, `validate-command.ts`, `config-command.ts` |
| `config/` | `config-manager.ts`, `profile-store.ts` |
| `formatters/` | `json-formatter.ts`, `table-formatter.ts`, `progress-display.ts` |
| `prompts/` | `export-prompts.ts`, `import-prompts.ts`, `provider-prompts.ts` |
| `utils/` | `logger.ts`, `file-writer.ts` |

---

### `@fhirbridge/web` (packages/web/src/)

0 unit tests (deferred).

| Module | Key Files |
|---|---|
| root | `main.tsx`, `App.tsx` |
| `pages/` | `dashboard-page.tsx`, `export-wizard-page.tsx`, `import-page.tsx`, `summary-viewer-page.tsx`, `settings-page.tsx` |
| `components/layout/` | `app-sidebar.tsx`, `app-header.tsx`, `page-container.tsx` |
| `components/export/` | `connector-form.tsx`, `export-progress.tsx`, `export-result.tsx` |
| `components/import/` | `file-dropzone.tsx`, `preview-table.tsx`, `column-mapper.tsx` |
| `components/summary/` | `summary-config.tsx`, `summary-display.tsx`, `summary-actions.tsx` |
| `components/shared/` | `loading-spinner.tsx`, `status-badge.tsx`, `error-boundary.tsx` |
| `api/` | `api-client.ts`, `export-api.ts`, `connector-api.ts`, `summary-api.ts`, `health-api.ts` |
| `hooks/` | `use-api.ts`, `use-polling.ts`, `use-file-upload.ts`, `use-export.ts` |
| `lib/` | `utils.ts`, `format-utils.ts` |

---

## Test Coverage

| Package | Tests | Status |
|---|---|---|
| `@fhirbridge/core` | 197 | All pass |
| `@fhirbridge/api` | 15 | All pass |
| `@fhirbridge/cli` | 16 | All pass |
| `@fhirbridge/web` | 0 | Deferred |
| `@fhirbridge/types` | 0 | Type-only |
| **Total** | **228** | **228/228 pass** |

---

## Key Design Patterns

| Pattern | Where Used |
|---|---|
| `ValidationResult` | All validators in `@fhirbridge/core` |
| Adapter / interface | `HisConnectorInterface` — all connectors |
| Async generator pipeline | `transform-pipeline.ts` |
| Two-step AI summarization | `section-summarizer` → `synthesis-engine` |
| HMAC-SHA256 de-identification | `deidentifier.ts` before every AI call |
| Fastify plugin chain | `server.ts` — CORS, auth, rate-limit, audit |
| In-memory store (MVP) | `export-service.ts`, rate limiter (Redis interfaces ready) |

---

## External Dependencies (Notable)

| Dependency | Package | Purpose |
|---|---|---|
| Fastify | api | HTTP server |
| `@fastify/jwt` | api | JWT auth |
| Commander.js | cli | CLI framework |
| Vite | web | Build tool |
| React 18 | web | UI |
| Tailwind CSS | web | Styling |
| SheetJS (`xlsx`) | core | Excel parsing |
| `@anthropic-ai/sdk` | core | Claude provider |
| `openai` | core | OpenAI provider |
| Vitest | all | Test framework |
