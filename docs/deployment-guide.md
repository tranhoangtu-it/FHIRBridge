# Deployment Guide

## Prerequisites

| Tool | Version |
|---|---|
| Node.js | >= 20 LTS |
| pnpm | >= 9 |
| Docker + Docker Compose | any recent |

---

## Local Development

### 1. Install dependencies

```bash
git clone https://github.com/your-org/fhirbridge.git
cd fhirbridge
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
# Edit .env with your values — see Environment Variables section
```

### 3. Start infrastructure

```bash
docker compose -f docker/docker-compose.yml up -d
```

This starts:
- Postgres 16 on `localhost:5432` (audit logs database)
- Redis 7 on `localhost:6379` (rate limiting)

### 4. Run setup script (first time)

```bash
bash scripts/setup.sh
```

Installs deps, starts Docker, initializes the audit database schema.

### 5. Start all packages in watch mode

```bash
pnpm dev
```

| Service | Default URL |
|---|---|
| API server | http://localhost:3000 |
| Web dashboard | http://localhost:5173 |

### 6. Start a specific package

```bash
pnpm --filter @fhirbridge/api dev
pnpm --filter @fhirbridge/web dev
```

---

## Environment Variables

All variables are documented in `.env.example`. Key variables:

| Variable | Purpose | Required |
|---|---|---|
| `DATABASE_URL` | Postgres connection string (audit only) | Yes |
| `REDIS_URL` | Redis connection string | Yes |
| `API_PORT` | API server port (default: `3000`) | No |
| `API_HOST` | Bind address (default: `0.0.0.0`) | No |
| `NODE_ENV` | `development` or `production` | Yes |
| `LOG_LEVEL` | `info`, `debug`, `warn`, `error` | No |
| `HIS_BASE_URL` | HIS FHIR endpoint base URL | For FHIR connector |
| `HIS_CLIENT_ID` | OAuth2 client ID for HIS | For FHIR connector |
| `HIS_CLIENT_SECRET` | OAuth2 client secret for HIS | For FHIR connector |
| `HIS_TOKEN_URL` | OAuth2 token endpoint | For FHIR connector |
| `AI_PROVIDER` | `anthropic` or `openai` | For summaries |
| `ANTHROPIC_API_KEY` | Anthropic API key | If provider = anthropic |
| `OPENAI_API_KEY` | OpenAI API key | If provider = openai |
| `DEIDENTIFY_HMAC_SECRET` | HMAC-SHA256 key (min 32 chars) | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `CORS_ORIGINS` | Comma-separated allowed origins | Yes |
| `RATE_LIMIT_MAX` | Max requests per window (default: `100`) | No |
| `RATE_LIMIT_WINDOW_MS` | Rate limit window in ms (default: `60000`) | No |

---

## Build

```bash
pnpm build        # compile all packages
pnpm typecheck    # TypeScript check (no emit)
pnpm test         # run all 228 tests
pnpm lint         # ESLint
```

Build outputs are cached by Turborepo. Force rebuild:

```bash
pnpm exec turbo run build --force
```

---

## Docker

```bash
# Start
docker compose -f docker/docker-compose.yml up -d

# Stop
docker compose -f docker/docker-compose.yml down

# Stop and remove volumes
docker compose -f docker/docker-compose.yml down -v

# View logs
docker compose -f docker/docker-compose.yml logs -f
```

---

## Production Deployment

### API Server

The API package compiles to a Node.js process. Start with:

```bash
cd packages/api
node dist/index.js
```

Or use a process manager (PM2, systemd):

```bash
pm2 start dist/index.js --name fhirbridge-api
```

### Web Dashboard

Build the web SPA and serve the static output:

```bash
pnpm --filter @fhirbridge/web build
# Output: packages/web/dist/
```

Serve `packages/web/dist/` via Nginx, Caddy, or any static host.

### Environment

- Set `NODE_ENV=production`
- Use a secrets manager (AWS Secrets Manager, Vault) for `JWT_SECRET` and `DEIDENTIFY_HMAC_SECRET`
- Set `CORS_ORIGINS` to the production web domain only

---

## Production Security Checklist

- [ ] `DEIDENTIFY_HMAC_SECRET` is >= 32 characters, randomly generated
- [ ] `JWT_SECRET` is randomly generated, not the default placeholder
- [ ] `POSTGRES_PASSWORD` changed from `changeme`
- [ ] `CORS_ORIGINS` restricted to production domain (not `*`)
- [ ] `trustProxy` in Fastify set to specific proxy CIDRs, not `true`
- [ ] Redis requires auth password in production
- [ ] `LOG_LEVEL` set to `warn` or `error` in production (no debug output)
- [ ] Postgres only accessible within private network
- [ ] HTTPS/TLS termination at reverse proxy layer
- [ ] Rate limiting tuned for expected traffic
- [ ] Audit log retention policy configured

---

## Generating Test Data

```bash
# Generate synthetic Synthea patient data
SYNTHEA_PATIENT_COUNT=10 bash scripts/setup.sh
```

Test fixtures are written to `tests/fixtures/synthea/`.
