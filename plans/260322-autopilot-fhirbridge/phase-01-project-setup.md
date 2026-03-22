---
title: "Phase 1 — Project Setup"
status: completed
priority: P1
effort: 12h
owner: Dev 3
completed: 2026-03-22
---

# Phase 1 — Project Setup

## Context Links
- [Plan Overview](./plan.md)
- [Turborepo Docs](https://turbo.build/repo/docs)
- [pnpm Workspaces](https://pnpm.io/workspaces)

## Overview
Bootstrap Turborepo monorepo with pnpm workspaces, TypeScript strict mode, shared configs, Docker Compose (Postgres + Redis), and CI scaffolding.

## Priority
**P1** — Blocks all other phases.

## Requirements

### Functional
- Monorepo with 5 packages compiling independently
- Shared TypeScript config with strict mode + path aliases
- Docker Compose for Postgres 16 + Redis 7
- ESLint + Prettier shared configs
- Vitest configured per package
- Git hooks (husky + lint-staged)

### Non-Functional
- pnpm >=9, Node >=20 LTS
- Build time <30s for full monorepo
- Hot reload in dev for all packages

## Architecture

```
fhirbridge/
├── packages/
│   ├── types/          # @fhirbridge/types — shared FHIR types, enums
│   ├── core/           # @fhirbridge/core — FHIR engine, validators
│   ├── api/            # @fhirbridge/api — Fastify REST server
│   ├── cli/            # @fhirbridge/cli — Commander.js CLI
│   └── web/            # @fhirbridge/web — Vite + React
├── docker/
│   ├── docker-compose.yml
│   ├── postgres/
│   │   └── init.sql
│   └── redis/
│       └── redis.conf
├── scripts/
│   ├── setup.sh
│   └── generate-synthea-data.sh
├── turbo.json
├── pnpm-workspace.yaml
├── tsconfig.base.json
├── .eslintrc.base.cjs
├── .prettierrc
├── vitest.workspace.ts
└── package.json
```

## Related Code Files

### Files to Create
- `package.json` — root workspace config
- `pnpm-workspace.yaml` — workspace definition
- `turbo.json` — pipeline: build, dev, lint, test, typecheck
- `tsconfig.base.json` — strict, ES2022, path aliases
- `.eslintrc.base.cjs` — shared ESLint config
- `.prettierrc` — formatting rules
- `vitest.workspace.ts` — workspace test config
- `.husky/pre-commit` — lint-staged hook
- `docker/docker-compose.yml` — Postgres 16 + Redis 7
- `docker/postgres/init.sql` — audit_logs, usage_tracking tables (NO PHI)
- `docker/redis/redis.conf` — maxmemory 256mb, eviction policy
- `scripts/setup.sh` — install + docker up + db migrate
- `scripts/generate-synthea-data.sh` — download/generate Synthea FHIR bundles
- `packages/types/package.json` — @fhirbridge/types
- `packages/types/tsconfig.json` — extends base
- `packages/types/src/index.ts` — barrel export
- `packages/core/package.json` — @fhirbridge/core
- `packages/core/tsconfig.json`
- `packages/core/src/index.ts`
- `packages/api/package.json` — @fhirbridge/api
- `packages/api/tsconfig.json`
- `packages/api/src/index.ts`
- `packages/cli/package.json` — @fhirbridge/cli
- `packages/cli/tsconfig.json`
- `packages/cli/src/index.ts`
- `packages/web/package.json` — @fhirbridge/web (Vite scaffold)
- `packages/web/tsconfig.json`
- `packages/web/vite.config.ts`
- `.env.example` — all env vars documented, no secrets

## Implementation Steps

1. **Initialize root project**
   - `pnpm init`, set `"private": true`
   - Create `pnpm-workspace.yaml` with `packages: ["packages/*"]`
   - Add `engines: { "node": ">=20", "pnpm": ">=9" }`

2. **Configure Turborepo**
   - `turbo.json` pipelines: `build` (dependsOn ^build), `dev` (persistent), `lint`, `test`, `typecheck`
   - Output dirs: `dist/**`, `.next/**`

3. **TypeScript base config**
   - `tsconfig.base.json`: strict, ES2022 target, moduleResolution bundler
   - Path aliases: `@fhirbridge/types`, `@fhirbridge/core`, etc.

4. **Scaffold all 5 packages**
   - Each: `package.json`, `tsconfig.json` (extends ../../tsconfig.base.json), `src/index.ts`
   - Set inter-package dependencies: core depends on types, api depends on core+types, etc.
   - Use `"main": "./dist/index.js"`, `"types": "./dist/index.d.ts"`

5. **ESLint + Prettier**
   - Root `.eslintrc.base.cjs`: typescript-eslint, import plugin
   - Root `.prettierrc`: singleQuote, trailingComma all, printWidth 100
   - Per-package `.eslintrc.cjs` extends base

6. **Vitest setup**
   - `vitest.workspace.ts` pointing to all packages
   - Each package: `vitest.config.ts` with path aliases

7. **Docker Compose**
   - `docker/docker-compose.yml`: postgres:16-alpine, redis:7-alpine
   - Postgres: port 5432, `POSTGRES_DB=fhirbridge_audit`
   - `docker/postgres/init.sql`:
     ```sql
     CREATE TABLE audit_logs (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       user_id_hash VARCHAR(64) NOT NULL,
       action VARCHAR(50) NOT NULL,
       resource_count INTEGER,
       status VARCHAR(20) NOT NULL,
       metadata JSONB
     );
     CREATE TABLE usage_tracking (
       id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
       timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
       user_id_hash VARCHAR(64) NOT NULL,
       export_type VARCHAR(20) NOT NULL,
       resource_count INTEGER NOT NULL,
       duration_ms INTEGER,
       tier VARCHAR(10) DEFAULT 'free'
     );
     ```
   - Redis: maxmemory 256mb, allkeys-lru

8. **Git hooks**
   - `husky` + `lint-staged`
   - Pre-commit: `lint-staged` (eslint --fix, prettier --write)

9. **Scripts**
   - `scripts/setup.sh`: pnpm install, docker compose up -d, wait for pg, run init.sql
   - `scripts/generate-synthea-data.sh`: download Synthea JAR, generate 10 patients, output to `tests/fixtures/synthea/`

10. **Verify**
    - `pnpm build` succeeds for all packages
    - `pnpm test` runs (empty tests pass)
    - `pnpm typecheck` passes
    - Docker containers healthy

## Todo List
- [x] Root package.json + pnpm-workspace.yaml
- [x] turbo.json pipeline config
- [x] tsconfig.base.json with strict mode
- [x] Scaffold 5 packages with proper inter-deps
- [x] ESLint + Prettier shared configs
- [x] Vitest workspace setup
- [x] Docker Compose (Postgres + Redis)
- [x] init.sql with audit tables
- [x] Git hooks (husky + lint-staged)
- [x] Setup + Synthea scripts
- [x] .env.example with all vars
- [x] Verify full build + typecheck

## Success Criteria
- `pnpm build` compiles all 5 packages
- `pnpm test` runs with zero errors
- `docker compose up` starts Postgres + Redis
- Audit tables exist in Postgres
- Synthea test data generated in `tests/fixtures/`

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| pnpm workspace resolution issues | Medium | Pin versions, use `workspace:*` protocol |
| TypeScript path alias breakage | Medium | Test aliases in build + runtime early |
| Docker port conflicts | Low | Use non-standard ports in .env |

## File Ownership
```
docker/**          → Dev 3
scripts/**         → Dev 3
turbo.json         → Dev 3
pnpm-workspace.yaml → Dev 3
tsconfig.base.json → Dev 3
.eslintrc.base.cjs → Dev 3
vitest.workspace.ts → Dev 3
package.json (root) → Dev 3
packages/*/package.json → respective owner
```
