<p align="center">
  <h1 align="center">FHIRBridge</h1>
  <p align="center">
    <strong>Patient Data Portability Tool</strong> — Auto-export FHIR R4 patient data with AI summaries
  </p>
  <p align="center">
    <a href="#features">Features</a> &bull;
    <a href="#quick-start">Quick Start</a> &bull;
    <a href="#api-endpoints">API</a> &bull;
    <a href="#cli-usage">CLI</a> &bull;
    <a href="#pricing">Pricing</a> &bull;
    <a href="#documentation">Docs</a>
  </p>
</p>

---

**The Problem:** Patient medical records are locked inside hospital systems (HIS). In Vietnam, 34M+ VneID records lack portability. In Japan, data is siloed per facility with limited interoperability.

**The Solution:** FHIRBridge connects to any HIS (via FHIR API or CSV/Excel export), transforms data into standardized FHIR R4 bundles, and generates AI-powered patient summaries. **Privacy-by-design: zero PHI stored.**

## Features

- **FHIR R4 Export** — 8 resource types: Patient, Encounter, Condition, Observation, MedicationRequest, AllergyIntolerance, Procedure, DiagnosticReport
- **HIS Connectors** — FHIR endpoint (SMART on FHIR OAuth2) + CSV/Excel import with visual column mapping
- **AI Summaries** — Multi-provider (Claude + OpenAI), de-identified before processing, EN/VI/JA
- **3 Interfaces** — CLI tool, REST API, React web dashboard
- **Privacy-by-Design** — Stream-only architecture, HMAC-SHA256 de-identification, no PHI storage
- **Billing Built-in** — Stripe (international) + SePay/VietQR (Vietnam), quota enforcement

## Pricing

|                | Free         | Pro ($5/mo)       |
| -------------- | ------------ | ----------------- |
| Exports/month  | 5            | 100               |
| AI Summaries   | -            | Included          |
| FHIR R4 Bundle | JSON, NDJSON | JSON, NDJSON, PDF |
| Languages      | EN           | EN, VI, JA        |
| Support        | Community    | Priority          |
| Self-hosted    | Unlimited    | Unlimited         |

**Open source core** — self-host for free, unlimited exports, no restrictions.

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
└── tests/                           — 1,000+ tests (unit, integration, E2E, security, perf)
```

**Tech Stack:** TypeScript, Turborepo, Fastify, React, Vitest, Playwright, PostgreSQL, Redis

## Prerequisites

- Node.js >= 20 LTS
- pnpm >= 9
- Docker + Docker Compose (for Postgres + Redis)

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/tranhoangtu/FHIRBridge.git
cd FHIRBridge
pnpm install

# 2. Configure environment
cp .env.example .env
# Edit .env — set JWT_SECRET, HMAC_SECRET

# 3. Start infrastructure
docker compose -f docker/docker-compose.yml up -d

# 4. Build and verify
pnpm build
pnpm test            # 913 unit tests

# 5. Start development
pnpm --filter @fhirbridge/api dev     # API → http://localhost:3001
pnpm --filter @fhirbridge/web dev     # Web → http://localhost:5173
```

## Development Commands

```bash
pnpm build              # Build all packages
pnpm dev                # Start all dev servers
pnpm test               # 913 unit tests
pnpm typecheck          # TypeScript strict check
pnpm lint               # ESLint + Prettier

# Extended test suites
pnpm test:integration   # 54 API integration tests
pnpm test:e2e:cli       # 24 CLI E2E tests (real subprocess)
pnpm test:e2e           # 53 Playwright E2E (3 browsers x 2 viewports)
pnpm test:security      # 40 security tests (XSS, SSRF, auth bypass)
pnpm test:perf          # 17 performance benchmarks
pnpm test:all           # Everything sequential (fail-fast)
```

## API Endpoints

| Method | Endpoint                            | Description                  |
| ------ | ----------------------------------- | ---------------------------- |
| `POST` | `/api/v1/export`                    | Initiate patient data export |
| `GET`  | `/api/v1/export/:id/status`         | Check export progress        |
| `GET`  | `/api/v1/export/:id/download`       | Download FHIR R4 Bundle      |
| `POST` | `/api/v1/connectors/test`           | Test HIS connection          |
| `POST` | `/api/v1/connectors/import`         | Upload CSV/Excel file        |
| `POST` | `/api/v1/summary/generate`          | Generate AI patient summary  |
| `GET`  | `/api/v1/summary/:id/download`      | Download summary (PDF/MD)    |
| `GET`  | `/api/v1/billing/plans`             | List billing plans           |
| `GET`  | `/api/v1/billing/usage`             | Current usage stats          |
| `POST` | `/api/v1/billing/subscribe`         | Create subscription          |
| `POST` | `/api/v1/billing/webhook/:provider` | Payment webhooks             |
| `GET`  | `/api/v1/health`                    | Health check                 |

**Auth:** `Authorization: Bearer <jwt>` or `X-API-Key: <key>` (except `/health` and webhooks)

## CLI Usage

```bash
# Export from FHIR endpoint
fhirbridge export --patient-id 123 --endpoint http://hapi.fhir.org/baseR4

# Import from CSV/Excel
fhirbridge import --file patients.csv --mapping mapping.json --output bundle.json

# Generate AI summary
fhirbridge summarize --input bundle.json --provider claude --language vi

# Validate FHIR bundle
fhirbridge validate --input bundle.json

# Manage connection profiles
fhirbridge config add-profile my-hospital
fhirbridge config list
```

## Privacy & Security

| Protection        | Implementation                                         |
| ----------------- | ------------------------------------------------------ |
| Zero PHI at rest  | Stream-only architecture, data never persisted         |
| De-identification | HMAC-SHA256 + date shifting before AI calls            |
| SSRF protection   | Private IPs, metadata endpoints, IPv6 loopback blocked |
| IDOR protection   | User ownership verified on all resource access         |
| Authentication    | JWT (HS256) + API key                                  |
| Rate limiting     | Tier-aware: 10/min (free), 100/min (paid) via Redis    |
| Audit logging     | Hashed user IDs, action types, resource counts only    |
| Quota enforcement | 402 Payment Required when limits exceeded              |

## Testing

**1,008 runnable tests** across 117 test files — zero failures.

```
Unit tests:        913 (core: 411, web: 203, api: 161, cli: 138)
Integration:        54 (auth, rate-limit, audit, export, billing)
CLI E2E:            24 (all commands as real subprocesses)
Playwright E2E:     53 specs (3 browsers x 2 viewports)
Security:           40 (XSS, SSRF, JWT bypass, file upload attacks)
Performance:        17 (API latency, CSV scaling, memory leak detection)
```

## Environment Variables

See `.env.example` for full documentation.

| Variable            | Required    | Description                              |
| ------------------- | ----------- | ---------------------------------------- |
| `JWT_SECRET`        | Yes         | JWT token signing (min 32 chars)         |
| `HMAC_SECRET`       | Yes         | PHI de-identification key (min 32 chars) |
| `DATABASE_URL`      | No          | PostgreSQL for audit logs (no PHI)       |
| `REDIS_URL`         | No          | Redis for rate limiting + caching        |
| `ANTHROPIC_API_KEY` | For AI      | Claude API key                           |
| `OPENAI_API_KEY`    | For AI      | OpenAI API key                           |
| `STRIPE_SECRET_KEY` | For billing | Stripe integration                       |
| `SEPAY_API_KEY`     | For billing | SePay/VietQR (Vietnam)                   |

## Documentation

- [Project Overview (PDR)](docs/project-overview-pdr.md)
- [System Architecture](docs/system-architecture.md)
- [Code Standards](docs/code-standards.md)
- [Deployment Guide](docs/deployment-guide.md)
- [Design Guidelines](docs/design-guidelines.md)
- [Project Roadmap](docs/project-roadmap.md)
- [Changelog](docs/project-changelog.md)

## Contributing

```bash
# Run all checks before submitting PR
pnpm build && pnpm test && pnpm typecheck && pnpm lint
```

Please read [Code Standards](docs/code-standards.md) before contributing.

## License

MIT
