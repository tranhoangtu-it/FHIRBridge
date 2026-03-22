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
pnpm install          # Install dependencies
pnpm build            # Build all packages
pnpm typecheck        # TypeScript type checking
pnpm test             # Run all tests
pnpm dev              # Start dev servers

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

## Key Files
- `packages/core/src/ai/deidentifier.ts` — PHI de-identification (CRITICAL)
- `packages/core/src/bundle/bundle-builder.ts` — FHIR Bundle assembly
- `packages/core/src/connectors/` — HIS connector adapters
- `packages/api/src/server.ts` — Fastify server setup
- `packages/api/src/services/export-service.ts` — Export orchestration
- `plans/260322-autopilot-fhirbridge/plan.md` — Implementation plan

## Documentation
- `docs/system-architecture.md` — Full system architecture
- `docs/code-standards.md` — Coding standards
- `docs/deployment-guide.md` — Setup & deployment
- `docs/project-roadmap.md` — Roadmap & milestones
