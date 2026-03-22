---
title: "FHIRBridge — Patient Data Portability Tool"
description: "Full implementation plan for FHIR R4 export tool with AI summaries, privacy-by-design"
status: completed
priority: P1
effort: 120h
branch: main
tags: [fhir, healthtech, privacy, ai, monorepo]
created: 2026-03-22
---

# FHIRBridge Implementation Plan

## Vision
Auto-export FHIR R4 patient data from HIS systems with AI-generated summaries. No patient data storage. CLI + REST API + Web UI. Target: Vietnam (34M+ VneID), Japan.

## Revenue Model
Open-source core + $5/export cloud tier.

## Architecture
Turborepo monorepo with 5 packages: `@fhirbridge/core`, `@fhirbridge/cli`, `@fhirbridge/api`, `@fhirbridge/web`, `@fhirbridge/types`.

## Phases

| # | Phase | Effort | Status | Owner |
|---|-------|--------|--------|-------|
| 1 | [Project Setup](./phase-01-project-setup.md) | 12h | ✅ completed | Dev 3 |
| 2 | [Core FHIR Engine](./phase-02-core-fhir-engine.md) | 24h | ✅ completed | Dev 1 |
| 3 | [HIS Connectors](./phase-03-his-connectors.md) | 16h | ✅ completed | Dev 1 |
| 4 | [AI Summary Engine](./phase-04-ai-summary-engine.md) | 20h | ✅ completed | Dev 1 |
| 5 | [API Server](./phase-05-api-server.md) | 18h | ✅ completed | Dev 1 |
| 6 | [CLI Tool](./phase-06-cli-tool.md) | 10h | ✅ completed | Dev 2 |
| 7 | [Web UI](./phase-07-web-ui.md) | 20h | ✅ completed | Dev 2 |

## Dependencies
```
Phase 1 ─┬─> Phase 2 ──> Phase 3 ──> Phase 5
          │                              │
          │                    Phase 4 ──┘
          │
          ├─> Phase 6 (after Phase 2)
          └─> Phase 7 (after Phase 5)
```

## File Ownership
- **Dev 1**: `packages/core/**`, `packages/api/**`, `packages/types/**`
- **Dev 2**: `packages/web/**`, `packages/cli/**`
- **Dev 3**: `docker/**`, `scripts/**`, root configs, `tests/e2e/**`

## Key Decisions
- Fastify over Express (2.3x throughput, native JSON Schema)
- Stream-only architecture — zero PHI at rest
- HMAC-SHA256 de-identification before AI calls
- Synthea test data — no mocks
- PostgreSQL for audit logs only (no PHI)
- Redis for rate limiting + job queues

## Success Criteria
- [x] Export Patient bundle with 8 FHIR resource types
- [x] AI summary via Claude or OpenAI with de-identified data
- [x] CLI, API, and Web UI all functional
- [x] Zero PHI persisted at any layer
- [ ] Synthea-based integration tests (deferred — inline fixtures used)
- [x] Docker Compose one-command startup
