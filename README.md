# FHIRBridge

Patient Data Portability Tool — auto-export FHIR R4 patient data from HIS systems with AI-generated summaries. Privacy-by-design: zero PHI at rest.

**Target:** Vietnam (34M+ VneID), Japan healthcare market
**Revenue:** Open source core + $5/export cloud tier

## Features

- **FHIR R4 Export** — 8 resource types (Patient, Encounter, Condition, Observation, MedicationRequest, AllergyIntolerance, Procedure, DiagnosticReport)
- **HIS Connectors** — FHIR endpoint (SMART on FHIR OAuth2), CSV, Excel import with column mapping
- **AI Summaries** — Multi-provider (Claude + OpenAI), de-identified data only, EN/VI/JA languages
- **3 Interfaces** — CLI tool, REST API, React web dashboard
- **Privacy-by-Design** — Stream-only architecture, HMAC-SHA256 de-identification, no PHI storage
- **Billing** — Free tier (5 exports/mo) + Paid tier ($5/mo, 100 exports + AI), Stripe + SePay (VietQR)

## Architecture

```
fhirbridge/
├── packages/
│   ├── types/    @fhirbridge/types  — FHIR R4 types, AI, connector, billing types
│   ├── core/     @fhirbridge/core   — FHIR engine, validators, connectors, AI, billing
│   ├── api/      @fhirbridge/api    — Fastify REST server (JWT, rate limiting, audit)
│   ├── cli/      @fhirbridge/cli    — Commander.js CLI tool
│   └── web/      @fhirbridge/web    — Vite + React + Tailwind dashboard
├── docker/                          — Postgres 16 + Redis 7
├── docs/                            — Project documentation
├── plans/                           — Implementation plans
├── scripts/                         — Setup + Synthea data generation
└── tests/fixtures/                  — CSV, Excel, Synthea test data
```

## Prerequisites

- Node.js >= 20 LTS
- pnpm >= 9
- Docker + Docker Compose (for Postgres + Redis)

## Quick Start

```bash
# 1. Clone and install
git clone <repo-url>
cd FHIRBridge
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, HMAC_SECRET, API keys

# 3. Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# 4. Build and verify
pnpm build
pnpm test        # 395 tests

# 5. Start development
pnpm dev
```

## Development Commands

```bash
pnpm build            # Build all packages
pnpm dev              # Start all dev servers
pnpm test             # Run 395 tests
pnpm typecheck        # TypeScript strict check
pnpm lint             # ESLint + Prettier

# Per-package
pnpm --filter @fhirbridge/api dev     # API server → http://localhost:3001
pnpm --filter @fhirbridge/web dev     # Web UI → http://localhost:5173
pnpm --filter @fhirbridge/core test   # Core tests only
```

## API Endpoints

| Method | Endpoint                            | Description               |
| ------ | ----------------------------------- | ------------------------- |
| `POST` | `/api/v1/export`                    | Initiate patient export   |
| `GET`  | `/api/v1/export/:id/status`         | Check export status       |
| `GET`  | `/api/v1/export/:id/download`       | Download FHIR Bundle      |
| `POST` | `/api/v1/connectors/test`           | Test HIS connection       |
| `POST` | `/api/v1/connectors/import`         | Upload CSV/Excel          |
| `POST` | `/api/v1/summary/generate`          | Generate AI summary       |
| `GET`  | `/api/v1/summary/:id/download`      | Download summary (PDF/MD) |
| `GET`  | `/api/v1/billing/plans`             | List billing plans        |
| `GET`  | `/api/v1/billing/usage`             | Get usage stats           |
| `POST` | `/api/v1/billing/subscribe`         | Create subscription       |
| `POST` | `/api/v1/billing/webhook/:provider` | Payment webhooks          |
| `GET`  | `/api/v1/health`                    | Health check              |

Auth: `Authorization: Bearer <jwt>` or `X-API-Key: <key>` (except `/health` and webhooks).

## CLI Usage

```bash
# Export from FHIR endpoint
fhirbridge export --patient-id 123 --endpoint http://hapi.fhir.org/baseR4

# Import from CSV
fhirbridge import --file patients.csv --mapping mapping.json --output bundle.json

# Generate AI summary
fhirbridge summarize --input bundle.json --provider claude --language vi

# Validate FHIR bundle
fhirbridge validate --input bundle.json

# Manage config profiles
fhirbridge config add-profile my-hospital
fhirbridge config list
```

## Docker

```bash
docker compose -f docker/docker-compose.yml up -d    # Start Postgres + Redis
docker compose -f docker/docker-compose.yml down      # Stop
docker compose -f docker/docker-compose.yml logs -f   # View logs
```

## Environment Variables

See `.env.example` for full documentation. Key variables:

| Variable            | Required | Description                                  |
| ------------------- | -------- | -------------------------------------------- |
| `JWT_SECRET`        | Yes      | Secret for JWT token signing                 |
| `HMAC_SECRET`       | Yes      | HMAC-SHA256 key for PHI de-identification    |
| `DATABASE_URL`      | No       | PostgreSQL (audit logs only, no PHI)         |
| `REDIS_URL`         | No       | Redis (rate limiting + caching)              |
| `ANTHROPIC_API_KEY` | No\*     | Claude API key (\*required for AI summaries) |
| `OPENAI_API_KEY`    | No\*     | OpenAI API key (\*required for AI summaries) |
| `STRIPE_SECRET_KEY` | No       | Stripe billing integration                   |
| `SEPAY_API_KEY`     | No       | SePay (VietQR) billing integration           |
| `API_KEYS`          | No       | Comma-separated valid API keys               |
| `CORS_ORIGINS`      | No       | Allowed origins (default: localhost)         |

## Privacy & Security

- **Zero PHI at rest** — Patient data streams through, never persisted
- **De-identification** — HMAC-SHA256 + date shifting before AI calls; text, extensions, notes stripped
- **SSRF protection** — Private IPs and metadata endpoints blocked
- **IDOR protection** — User ownership verified on all resource access
- **Auth** — JWT (HS256) + API key authentication
- **Rate limiting** — Tier-aware: 10/min (free), 100/min (paid)
- **Audit logging** — Hashed user IDs, action types, resource counts only
- **Quota enforcement** — 402 Payment Required when limits exceeded

## Testing

```bash
pnpm test    # 395 tests across 33 files

# Breakdown:
# @fhirbridge/core  — 247 tests (FHIR, validators, AI, billing, connectors)
# @fhirbridge/api   —  57 tests (routes, plugins, services)
# @fhirbridge/cli   —  16 tests (commands, config)
# @fhirbridge/web   —  75 tests (hooks, components, pages)
```

## Documentation

- [Project Overview (PDR)](docs/project-overview-pdr.md)
- [System Architecture](docs/system-architecture.md)
- [Code Standards](docs/code-standards.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Design Guidelines](docs/design-guidelines.md)
- [Project Roadmap](docs/project-roadmap.md)
- [Changelog](docs/project-changelog.md)

## License

MIT
