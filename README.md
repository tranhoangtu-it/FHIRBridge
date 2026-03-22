# FHIRBridge

Auto-export FHIR R4 patient data from HIS systems with AI-generated summaries. Privacy-by-design: zero PHI at rest.

## Features

- Export Patient bundles with 8 FHIR R4 resource types
- AI summaries via Anthropic Claude or OpenAI (de-identified data only)
- CLI, REST API, and Web UI interfaces
- Stream-only architecture — no PHI stored
- Audit logs and usage tracking (no PHI)

## Architecture

```
fhirbridge/
├── packages/
│   ├── types/    @fhirbridge/types  — Shared FHIR R4 type definitions
│   ├── core/     @fhirbridge/core   — FHIR engine, validators, de-identification
│   ├── api/      @fhirbridge/api    — Fastify REST server
│   ├── cli/      @fhirbridge/cli    — Commander.js CLI tool
│   └── web/      @fhirbridge/web    — Vite + React dashboard
├── docker/                          — Postgres 16 + Redis 7
└── scripts/                         — Setup + test data generation
```

## Prerequisites

- Node.js >= 20 LTS
- pnpm >= 9
- Docker + Docker Compose

## Quick Start

```bash
# 1. Clone and install
git clone https://github.com/your-org/fhirbridge.git
cd fhirbridge

# 2. Configure environment
cp .env.example .env
# Edit .env with your values

# 3. Run setup (installs deps, starts Docker, initializes DB)
bash scripts/setup.sh

# 4. Start development
pnpm dev
```

## Development Commands

```bash
pnpm build       # Build all packages
pnpm dev         # Start all packages in watch mode
pnpm test        # Run all tests
pnpm typecheck   # TypeScript check all packages
pnpm lint        # Lint all packages
pnpm format      # Format all files with Prettier
```

## Package Scripts

Each package supports the same scripts via Turborepo pipelines:

```bash
# Run command in specific package
pnpm --filter @fhirbridge/api dev
pnpm --filter @fhirbridge/core build
```

## Docker

```bash
# Start Postgres + Redis
docker compose -f docker/docker-compose.yml up -d

# Stop
docker compose -f docker/docker-compose.yml down

# View logs
docker compose -f docker/docker-compose.yml logs -f
```

## Environment Variables

See `.env.example` for all required variables with documentation.

**Key variables:**
- `DATABASE_URL` — PostgreSQL connection (audit logs only)
- `REDIS_URL` — Redis connection (rate limiting + queues)
- `ANTHROPIC_API_KEY` or `OPENAI_API_KEY` — AI summary provider
- `DEIDENTIFY_HMAC_SECRET` — HMAC-SHA256 key for de-identification
- `HIS_BASE_URL` — Hospital Information System FHIR endpoint

## Privacy & Security

- **Zero PHI at rest**: Patient data streams through, never persisted
- **De-identification**: HMAC-SHA256 applied before any AI API call
- **Audit only**: PostgreSQL stores only hashed user IDs, action types, resource counts
- **Rate limiting**: Redis-backed per-user rate limits

## License

MIT
