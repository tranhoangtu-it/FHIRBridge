<p align="center">
  <h1 align="center">FHIRBridge</h1>
  <p align="center">
    <strong>Open-source patient data portability for hospitals and clinics</strong><br/>
    Self-host. Pull from your HIS. Export FHIR R4. Generate AI summaries. Zero PHI persisted.
  </p>
  <p align="center">
    <a href="#features">Features</a> &bull;
    <a href="#quickstart">Quickstart</a> &bull;
    <a href="#api-endpoints">API</a> &bull;
    <a href="#cli-usage">CLI</a> &bull;
    <a href="#self-host-deployment">Self-host</a> &bull;
    <a href="#privacy--security">Security</a>
  </p>
</p>

---

## What it is

Patient medical records are locked inside hospital information systems (HIS). In Vietnam, 34M+ VneID records lack portability. In Japan, data is siloed per facility with limited interoperability. **FHIRBridge** is the bridge: connect to any HIS via FHIR API or CSV/Excel, transform into standardized FHIR R4 bundles, and (optionally) generate de-identified AI summaries — all running on your own infrastructure.

**No SaaS. No hosted tier. No billing. No quotas.** You pull the repo, you run it. The hospital, clinic, or research group is the operator and the data controller.

## Features

- **FHIR R4 Export** — Patient, Encounter, Condition, Observation, MedicationRequest, AllergyIntolerance, Procedure, DiagnosticReport, Immunization, CarePlan, CareTeam, Specimen, DocumentReference, Practitioner, Medication
- **HIS Connectors** — FHIR endpoint (SMART on FHIR / OAuth2) + CSV / Excel import with visual column mapping
- **AI Summaries (optional)** — Claude or OpenAI providers, de-identified before any external call (HMAC-SHA256 + date shifting), supports VI / EN / JA
- **Three interfaces** — CLI tool, REST API (Fastify), React web dashboard
- **Privacy-by-design** — Stream-only architecture, no PHI persisted to durable storage, audit log stores hashes only
- **IPS Bundle support** — International Patient Summary `Bundle.type=document` profile

## Tech stack

TypeScript (strict, ES2022) · Turborepo + pnpm workspaces · Fastify 5 · Vite 6 + React 18 + Tailwind · Commander.js · Vitest + Playwright · PostgreSQL 16 (audit logs only, no PHI) · Redis 7 (rate limit + caching, optional) · Anthropic SDK · OpenAI SDK · i18next (VI / EN / JA)

## Project layout

```
fhirbridge/
├── packages/
│   ├── types/   FHIR R4 types, AI types, connector types
│   ├── core/    FHIR engine, validators, connectors, AI pipeline, security utilities
│   ├── api/     Fastify REST server (JWT, rate limit, audit, helmet, swagger)
│   ├── cli/     Commander.js CLI tool
│   └── web/     Vite + React + Tailwind dashboard (i18n VI/EN/JA)
├── docker/      Postgres 16 + Redis 7 (optional, only needed for audit log + multi-replica rate limit)
└── tests/       1100+ tests across unit, integration, E2E, security, performance
```

## Prerequisites

- Node.js >= 20 LTS
- pnpm >= 9
- (Optional) Docker + Docker Compose — only needed if you want persistent audit logs (Postgres) or distributed rate limiting (Redis). The server runs fine with both off, falling back to Console-audit + in-memory rate limit.

## Quickstart

```bash
# 1. Clone and install
git clone https://github.com/tranhoangtu-it/FHIRBridge.git
cd FHIRBridge
pnpm install

# 2. Configure environment (only the security secrets are required)
cp .env.example .env
#   Required:  JWT_SECRET, HMAC_SECRET (each >= 32 chars, must be different)
#   Optional:  DATABASE_URL, REDIS_URL, ANTHROPIC_API_KEY, OPENAI_API_KEY

# 3. Build + run the unit tests
pnpm build
pnpm test                                    # ~1100 tests, no Docker required

# 4. Start dev servers (no infra dependencies — uses Console audit + in-memory store)
pnpm --filter @fhirbridge/api dev            # API   → http://localhost:3001
pnpm --filter @fhirbridge/web dev            # Web   → http://localhost:5173
```

That's it for development. Optional infra (Postgres + Redis) below in [Self-host deployment](#self-host-deployment).

## Development commands

```bash
pnpm build              # Build all packages
pnpm dev                # Start all dev servers via turbo
pnpm test               # All unit tests (~1100, no Docker)
pnpm typecheck          # TypeScript strict check
pnpm lint               # ESLint + Prettier

# Extended test suites
pnpm test:integration   # Fastify server.inject() integration tests
pnpm test:e2e:cli       # CLI as real subprocess
pnpm test:e2e           # Playwright (needs Docker + dev servers running)
pnpm test:security      # XSS, SSRF, IDOR, JWT bypass
pnpm test:perf          # Latency + memory + CSV scaling
pnpm test:a11y          # axe-core via Playwright
```

## API endpoints

| Method | Endpoint                       | Description                                                                    |
| ------ | ------------------------------ | ------------------------------------------------------------------------------ |
| `POST` | `/api/v1/export`               | Initiate patient data export                                                   |
| `GET`  | `/api/v1/export/:id/status`    | Check export progress                                                          |
| `GET`  | `/api/v1/export/:id/download`  | Download FHIR R4 Bundle (`?format=json` or `?format=ndjson`)                   |
| `POST` | `/api/v1/connectors/test`      | Test HIS connection                                                            |
| `POST` | `/api/v1/connectors/import`    | Upload CSV / Excel file                                                        |
| `POST` | `/api/v1/summary/generate`     | Generate AI patient summary (requires `ANTHROPIC_API_KEY` or `OPENAI_API_KEY`) |
| `GET`  | `/api/v1/summary/:id/download` | Download summary (Markdown / FHIR Composition)                                 |
| `POST` | `/api/v1/consent/record`       | Record cross-border AI consent                                                 |
| `GET`  | `/api/v1/health`               | Liveness + dependency health                                                   |

OpenAPI spec served at `/api/v1/docs` (only outside production, or set `ENABLE_DOCS=true`).

**Authentication:** `Authorization: Bearer <jwt>` or `X-API-Key: <key>`. `/api/v1/health` is public.

## CLI usage

```bash
# Export from a FHIR endpoint
fhirbridge export --patient-id 123 --endpoint https://hapi.fhir.org/baseR4

# Import CSV / Excel into a FHIR Bundle
fhirbridge import --file patients.csv --mapping mapping.json --output bundle.json

# Generate an AI summary (de-identified before the API call)
fhirbridge summarize --input bundle.json --provider claude --language vi

# Validate a FHIR Bundle
fhirbridge validate --input bundle.json

# Manage saved connection profiles
fhirbridge config add-profile my-hospital
fhirbridge config list
```

## Self-host deployment

The simplest deployment is a single Node.js process. Docker compose for Postgres + Redis is provided but optional.

```bash
# 1. Build the production bundle
pnpm build

# 2. (Optional) Start Postgres + Redis for persistent audit logs and distributed rate limit
docker compose -f docker/docker-compose.yml up -d

# 3. Start the API server
NODE_ENV=production pnpm --filter @fhirbridge/api start

# 4. Serve the web bundle (any static host works — nginx, Caddy, etc.)
pnpm --filter @fhirbridge/web build
# upload packages/web/dist to your static host
```

Behavior under degraded infra:

- No `DATABASE_URL` set → audit log writes to stdout (Console sink). Use `journalctl` / log aggregator.
- No `REDIS_URL` set → rate limit + caches stay in-memory per process. Single-replica only.
- No `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` → AI summary endpoints return a clear error; export + connector endpoints unaffected.

## Privacy & security

| Protection           | Implementation                                                                             |
| -------------------- | ------------------------------------------------------------------------------------------ |
| Zero PHI at rest     | Stream-only export pipeline; in-memory record TTL 10 min                                   |
| De-identification    | HMAC-SHA256 + per-patient deterministic date shift before AI call                          |
| Safe Harbor age cap  | `birthDate` removed when computed age ≥ 89 (HIPAA §164.514(b)(2)(i)(C))                    |
| SSRF protection      | Blocks private IPs, link-local, IPv6 loopback, cloud metadata                              |
| IDOR protection      | Ownership verified on every export / summary access; cross-tenant attempts audited as 404  |
| Authentication       | JWT (HS256) + API key with `crypto.timingSafeEqual` comparison                             |
| Rate limiting        | Per-user / per-IP, 100 req/min default (configurable via `RATE_LIMIT_PER_MINUTE`)          |
| Audit logging        | HMAC-SHA256 hashes of user IDs, action types, resource counts only — never raw identifiers |
| Cross-border consent | Per-session consent recording before sending data to non-domestic AI providers             |
| BAA disclaimer       | Hospital operator owns the BAA decision; UI surfaces the disclaimer for end users          |
| HMAC secret reuse    | Boot fails if `HMAC_SECRET == JWT_SECRET` (Zod-enforced)                                   |

## Testing

Roughly 1100 unit + integration tests pass on every commit.

```
core: ~627 tests (validators, connectors, AI pipeline, de-identifier invariants)
api:  ~179 tests (routes, services, plugins, IDOR + auth security)
web:  ~238 tests (components, hooks, i18n, accessibility)
cli:  test commands for every CLI verb
```

## Environment variables

See `.env.example` for full documentation.

| Variable                | Required | Description                                                             |
| ----------------------- | -------- | ----------------------------------------------------------------------- |
| `JWT_SECRET`            | Yes      | JWT signing key (>= 32 chars)                                           |
| `HMAC_SECRET`           | Yes      | De-identification HMAC key (>= 32 chars, must differ from `JWT_SECRET`) |
| `API_KEYS`              | No       | Comma-separated list of static API keys                                 |
| `CORS_ORIGINS`          | No       | Comma-separated allow-list (default `http://localhost:3000`)            |
| `DATABASE_URL`          | No       | PostgreSQL connection for persistent audit logs                         |
| `REDIS_URL`             | No       | Redis connection for distributed rate limit + caches                    |
| `ANTHROPIC_API_KEY`     | For AI   | Claude API key                                                          |
| `OPENAI_API_KEY`        | For AI   | OpenAI API key                                                          |
| `RATE_LIMIT_PER_MINUTE` | No       | Override the default 100 req/min budget                                 |
| `METRICS_BEARER_TOKEN`  | No       | Bearer token for `/metrics`; off when unset                             |
| `TRUST_PROXY`           | No       | `true` or a CIDR string when running behind a load balancer             |
| `ENABLE_DOCS`           | No       | Set to `true` to expose `/api/v1/docs` in production                    |

## Contributing

```bash
pnpm build && pnpm test && pnpm typecheck && pnpm lint
```

## License

MIT
