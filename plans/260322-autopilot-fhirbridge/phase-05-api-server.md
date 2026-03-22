---
title: "Phase 5 — API Server"
status: complete
priority: P1
effort: 18h
owner: Dev 1
---

# Phase 5 — API Server

## Context Links
- [Plan Overview](./plan.md)
- [Fastify Docs](https://fastify.dev/docs/latest/)
- Phase dependencies: [Phase 2](./phase-02-core-fhir-engine.md), [Phase 3](./phase-03-his-connectors.md), [Phase 4](./phase-04-ai-summary-engine.md)

## Overview
Fastify REST API server exposing export endpoints, connector management, AI summary generation. Includes JWT auth, rate limiting (Redis), JSON Schema request validation, audit logging (Postgres), and streaming responses. No PHI stored — all endpoints are pass-through.

## Priority
**P1** — Primary interface for web UI and external integrations.

## Requirements

### Functional
- `POST /api/v1/export` — initiate patient export
- `GET /api/v1/export/:id/status` — check export status
- `GET /api/v1/export/:id/download` — stream export result
- `POST /api/v1/connectors/test` — test HIS connection
- `POST /api/v1/connectors/import` — upload CSV/Excel for import
- `POST /api/v1/summary/generate` — generate AI summary
- `GET /api/v1/summary/:id/download` — download summary (PDF/MD)
- `GET /api/v1/health` — health check (DB + Redis + uptime)
- JWT authentication (API key-based for MVP)
- Rate limiting: 10 exports/min free tier, 100/min paid
- Audit logging: every export action logged (hashed user ID, counts, status)

### Non-Functional
- Fastify with TypeBox/JSON Schema validation
- Streaming responses for large bundles
- CORS configured for web UI origin
- Graceful shutdown (drain connections)
- Request ID tracing (X-Request-Id)
- <200 LOC per file

## Architecture

```
@fhirbridge/api/
├── server.ts                    # Fastify instance creation + plugin registration
├── config.ts                    # Environment config loader
├── plugins/
│   ├── auth-plugin.ts           # JWT verification + API key auth
│   ├── rate-limiter-plugin.ts   # Redis-backed rate limiting
│   ├── cors-plugin.ts           # CORS configuration
│   ├── request-id-plugin.ts     # X-Request-Id propagation
│   └── audit-plugin.ts          # Postgres audit logging hook
├── routes/
│   ├── export-routes.ts         # /api/v1/export/*
│   ├── connector-routes.ts      # /api/v1/connectors/*
│   ├── summary-routes.ts        # /api/v1/summary/*
│   └── health-routes.ts         # /api/v1/health
├── schemas/
│   ├── export-schemas.ts        # JSON Schema for export requests/responses
│   ├── connector-schemas.ts     # JSON Schema for connector requests
│   └── summary-schemas.ts       # JSON Schema for summary requests
├── services/
│   ├── export-service.ts        # Orchestrate connector → pipeline → bundle
│   ├── summary-service.ts       # Orchestrate deidentify → AI → format
│   └── audit-service.ts         # Write hashed audit logs to Postgres
├── middleware/
│   └── error-handler.ts         # Centralized error handling
└── index.ts                     # Entry point: start server
```

### Request Flow
```
Client Request
  → request-id-plugin (assign/propagate trace ID)
  → auth-plugin (verify JWT / API key)
  → rate-limiter-plugin (check Redis counter)
  → JSON Schema validation (Fastify built-in)
  → route handler
  → service layer (orchestrate core)
  → audit-plugin (log to Postgres, onResponse hook)
  → Stream response to client
```

## Related Code Files

### Files to Create
- `packages/api/src/server.ts` — `createServer(config): FastifyInstance`
- `packages/api/src/config.ts` — `loadConfig(): ApiConfig` from env vars
- `packages/api/src/plugins/auth-plugin.ts` — `fp(authPlugin)` — verify Bearer token or X-API-Key
- `packages/api/src/plugins/rate-limiter-plugin.ts` — Redis sliding window, tier-aware
- `packages/api/src/plugins/cors-plugin.ts` — allowedOrigins from config
- `packages/api/src/plugins/request-id-plugin.ts` — generate/propagate X-Request-Id
- `packages/api/src/plugins/audit-plugin.ts` — onResponse hook → audit_logs insert
- `packages/api/src/routes/export-routes.ts` — POST export, GET status, GET download
- `packages/api/src/routes/connector-routes.ts` — POST test, POST import (multipart)
- `packages/api/src/routes/summary-routes.ts` — POST generate, GET download
- `packages/api/src/routes/health-routes.ts` — GET /health with component checks
- `packages/api/src/schemas/export-schemas.ts` — TypeBox schemas
- `packages/api/src/schemas/connector-schemas.ts`
- `packages/api/src/schemas/summary-schemas.ts`
- `packages/api/src/services/export-service.ts` — `exportPatient(config): ExportResult`
- `packages/api/src/services/summary-service.ts` — `generateSummary(bundle, config): SummaryResult`
- `packages/api/src/services/audit-service.ts` — `logAudit(action, userId, metadata)`
- `packages/api/src/middleware/error-handler.ts` — map errors to HTTP status codes
- `packages/api/src/index.ts` — `startServer()`

### Test Files
- `packages/api/src/routes/__tests__/export-routes.test.ts`
- `packages/api/src/routes/__tests__/connector-routes.test.ts`
- `packages/api/src/routes/__tests__/summary-routes.test.ts`
- `packages/api/src/routes/__tests__/health-routes.test.ts`
- `packages/api/src/plugins/__tests__/auth-plugin.test.ts`
- `packages/api/src/plugins/__tests__/rate-limiter-plugin.test.ts`

## Implementation Steps

1. **Config loader** (`config.ts`)
   - Load from env: PORT, HOST, DATABASE_URL, REDIS_URL, JWT_SECRET, CORS_ORIGINS, API_KEYS (comma-separated)
   - Validate required vars present at startup
   - Type-safe config object

2. **Create Fastify server** (`server.ts`)
   - `fastify({ logger: true, requestIdHeader: 'x-request-id' })`
   - Register plugins in order: requestId → cors → auth → rateLimiter → audit
   - Register routes: health, export, connector, summary
   - Set error handler
   - Graceful shutdown: `closeListeners` on SIGTERM/SIGINT

3. **Auth plugin** (`auth-plugin.ts`)
   - Check `Authorization: Bearer <jwt>` or `X-API-Key: <key>`
   - JWT: verify with HS256, extract userId + tier
   - API Key: lookup in configured API_KEYS list
   - Skip auth for: `/api/v1/health`
   - Decorate request with `req.user = { id, tier }`

4. **Rate limiter plugin** (`rate-limiter-plugin.ts`)
   - Use `@fastify/rate-limit` with Redis store
   - Limits by tier: `{ free: { max: 10, timeWindow: '1 minute' }, paid: { max: 100, timeWindow: '1 minute' } }`
   - Key: `req.user.id` (after auth)
   - Return `429` with `Retry-After` header

5. **Audit plugin** (`audit-plugin.ts`)
   - `onResponse` hook: log to `audit_logs` table
   - Hash user ID: `SHA256(req.user.id + salt)`
   - Log: timestamp, user_id_hash, action (route path), resource_count, status (HTTP code), duration_ms
   - Async — don't block response
   - Never log request/response bodies (may contain PHI)

6. **Export routes** (`export-routes.ts`)
   - `POST /api/v1/export`:
     - Body: `{ patientId, connectorConfig, outputFormat: 'json' | 'ndjson', includeSummary?: boolean, summaryConfig? }`
     - Call ExportService.exportPatient()
     - Return `{ exportId, status: 'processing' }` (202 Accepted)
   - `GET /api/v1/export/:id/status`:
     - Return `{ status: 'processing' | 'complete' | 'failed', resourceCount?, error? }`
   - `GET /api/v1/export/:id/download`:
     - Stream Bundle as response with `Content-Type: application/fhir+json`
     - Set `Content-Disposition: attachment; filename=patient-bundle.json`

7. **Connector routes** (`connector-routes.ts`)
   - `POST /api/v1/connectors/test`:
     - Body: `{ type: 'fhir-endpoint', config: FhirEndpointConfig }`
     - Test connection, return status
   - `POST /api/v1/connectors/import`:
     - Multipart upload: file + mapping config
     - Use `@fastify/multipart` for streaming file upload
     - Pipe file through CSV/Excel connector → pipeline → bundle
     - Return export result

8. **Summary routes** (`summary-routes.ts`)
   - `POST /api/v1/summary/generate`:
     - Body: `{ bundle (or exportId), summaryConfig }`
     - Call SummaryService.generateSummary()
     - Return `{ summaryId, status: 'processing' }` (202)
   - `GET /api/v1/summary/:id/download`:
     - Query: `?format=pdf|markdown|composition`
     - Stream formatted summary

9. **Service layer** (`services/`)
   - `ExportService`: instantiate connector → fetch data → run pipeline → build bundle → store in Redis (TTL 10min)
   - `SummaryService`: take bundle → deidentify → AI summarize → format → store in Redis (TTL 10min)
   - `AuditService`: insert into `audit_logs`, query usage for billing
   - Redis storage: `export:{id}` and `summary:{id}` with short TTL (no persistence)

10. **Error handler** (`error-handler.ts`)
    - Map domain errors to HTTP: ValidationError→400, AuthError→401, RateLimitError→429, NotFoundError→404
    - Log error details server-side, return safe message client-side
    - Never expose stack traces or internal details

11. **JSON Schemas** (`schemas/`)
    - Use `@sinclair/typebox` for TypeScript-first schema definition
    - Export both TypeScript types and JSON Schemas from same definition
    - Reuse across routes for request validation

12. **Write tests**
    - Use `fastify.inject()` for route testing (no network)
    - Test auth: valid JWT, invalid JWT, API key, missing auth
    - Test rate limiting: exceed limit → 429
    - Test export flow: mock connector → verify bundle response
    - Test multipart upload for CSV import
    - Test health endpoint returns component status

## Todo List
- [x] Config loader with validation
- [x] Fastify server setup with plugin registration
- [x] Auth plugin (JWT + API key)
- [x] Rate limiter plugin (tier-aware, in-memory fallback)
- [x] CORS plugin
- [x] Request ID plugin
- [x] Audit plugin (console-based, pluggable interface for Postgres)
- [x] Export routes (POST, GET status, GET download)
- [x] Connector routes (test + import)
- [x] Summary routes (generate + download)
- [x] Health route
- [x] JSON Schemas (plain objects)
- [x] Export service
- [x] Summary service
- [x] Audit service
- [x] Error handler
- [x] Route tests (health)
- [x] Plugin tests (auth)
- [x] Middleware tests (error-handler)

## Success Criteria
- All endpoints respond with correct status codes and schemas
- Auth blocks unauthenticated requests (except health)
- Rate limiter enforces tier-based limits via Redis
- Export streams FHIR Bundle without buffering full response
- Audit logs written for every request (hashed, no PHI)
- Health check reports Postgres + Redis status
- Graceful shutdown drains active connections

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| Redis unavailable → rate limiter fails | High | Fallback to in-memory rate limit |
| Large bundle streaming memory | Medium | Use Fastify reply.raw + Node streams |
| Multipart upload size limits | Medium | Configure max file size (50MB default) |
| JWT secret rotation | Low | Support multiple secrets with kid header |

## Security Considerations
- JWT secret from env, rotatable
- API keys hashed at rest in config
- All responses include security headers (helmet)
- File uploads scanned for valid CSV/Excel magic bytes
- No PHI in logs, audit records, or error responses
- Redis data expires (TTL 10min) — no long-term storage
- TLS termination expected at load balancer level

## File Ownership
```
packages/api/src/**  → Dev 1
```
