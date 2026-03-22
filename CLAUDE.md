# CLAUDE.md — FHIRBridge

## Project Overview

FHIRBridge is a FHIR R4 Patient Data Portability Tool. It exports patient medical data from HIS systems, transforms it into valid FHIR R4 bundles, and generates AI-powered summaries. Privacy-by-design: no patient data stored.

## Tech Stack

- **Monorepo**: Turborepo + pnpm workspaces
- **Language**: TypeScript (strict mode, ES2022)
- **Backend**: Fastify REST API
- **Frontend**: Vite + React + Tailwind CSS
- **CLI**: Commander.js
- **Testing**: Vitest
- **AI**: Claude API (@anthropic-ai/sdk) + OpenAI (openai)
- **Database**: PostgreSQL (audit logs only, NO PHI)
- **Cache**: Redis (rate limiting, job queues)

## Packages

```
packages/
├── types/   # @fhirbridge/types — FHIR R4 types, AI types, connector types
├── core/    # @fhirbridge/core — FHIR engine, validators, connectors, AI
├── api/     # @fhirbridge/api — Fastify REST server
├── cli/     # @fhirbridge/cli — CLI tool
└── web/     # @fhirbridge/web — React dashboard
```

## Commands

```bash
pnpm install              # Install dependencies
pnpm build                # Build all packages
pnpm typecheck            # TypeScript type checking
pnpm test                 # Run 913 unit tests
pnpm test:integration     # 54 API integration tests
pnpm test:e2e:cli         # 24 CLI E2E tests
pnpm test:e2e             # Playwright E2E (needs Docker)
pnpm test:security        # Security penetration tests
pnpm test:perf            # Performance benchmarks
pnpm test:all             # All suites (fail-fast)
pnpm dev                  # Start dev servers

# Per-package
pnpm --filter @fhirbridge/core test
pnpm --filter @fhirbridge/api dev
pnpm --filter @fhirbridge/web dev
```

## Architecture Rules

### PRIVACY (NON-NEGOTIABLE)

- **NEVER** store patient data (PHI) at rest — stream/transform only
- **NEVER** log PHI in any log output, error messages, or audit records
- **ALWAYS** de-identify data before sending to AI providers (HMAC-SHA256)
- **ALWAYS** strip `text.div`, `extension`, `note`, `valueString` fields before AI
- **ALWAYS** hash user IDs in audit logs
- API keys and secrets in env vars only, never in code

### Code Standards

- Files under 200 LOC — modularize if larger
- kebab-case file names
- Barrel `index.ts` exports per module
- `workspace:*` for inter-package dependencies
- No mocks in tests — use realistic FHIR data fixtures
- Adapter pattern for connectors (HisConnector) and AI providers (AiProvider)

### Security

- SSRF protection: validate baseUrl, block private IPs
- IDOR protection: userId ownership check on all resource access
- Auth: JWT (HS256) + API key, skip only for /health
- Rate limiting: tier-aware (free: 10/min, paid: 100/min)
- Input validation via JSON Schema on all API routes

## Billing

- Free: 5 exports/month, no AI summary
- Paid: $5/month → 100 exports/month + AI summaries
- Providers: Stripe (international) + SePay/VietQR (Vietnam)
- Quota enforcement: 402 Payment Required on exceeded limits
- Webhook verification: Stripe signature + SePay HMAC-SHA256

## Testing

```bash
pnpm test               # 913 unit tests (Vitest)
pnpm test:integration   # 54 API integration tests (server.inject, no Docker)
pnpm test:e2e:cli       # 24 CLI E2E tests (real subprocess)
pnpm test:e2e           # 53 Playwright E2E (needs Docker + running servers)
pnpm test:security      # 40 security tests (XSS, SSRF, auth bypass)
pnpm test:perf          # 17 performance benchmarks
pnpm test:all           # All suites sequential (fail-fast)
```

- **Unit tests**: stub external deps (AI providers, Stripe, HTTP), test orchestration logic
- **Integration tests**: real Fastify server via `server.inject()`, in-memory stores
- **CLI E2E**: spawn `node packages/cli/bin/fhirbridge.js` as subprocess, capture stdout/stderr/exitCode
- **Playwright E2E**: 3 browsers (Chromium, Firefox, WebKit) x 2 viewports (desktop, tablet)
- **Security**: XSS injection, JWT bypass, SSRF deep test, file upload attacks, header hardening
- **Performance**: API latency p95, CSV import scaling, rate limiter stress, memory leak detection
- Docker test profile: `docker/docker-compose.test.yml` (Postgres:5433, Redis:6380)
- Test env: `.env.test`

## Key Files

- `packages/core/src/ai/deidentifier.ts` — PHI de-identification (CRITICAL)
- `packages/core/src/bundle/bundle-builder.ts` — FHIR Bundle assembly
- `packages/core/src/connectors/` — HIS connector adapters
- `packages/core/src/billing/` — Plan manager, usage tracker, payment providers
- `packages/api/src/server.ts` — Fastify server setup
- `packages/api/src/services/export-service.ts` — Export orchestration
- `packages/api/src/services/redis-store.ts` — Redis with in-memory fallback
- `packages/api/src/services/postgres-audit-sink.ts` — Batched audit logging
- `plans/260322-autopilot-fhirbridge/plan.md` — Implementation plan

## Documentation

- `docs/system-architecture.md` — Full system architecture
- `docs/code-standards.md` — Coding standards
- `docs/deployment-guide.md` — Setup & deployment
- `docs/project-roadmap.md` — Roadmap & milestones
