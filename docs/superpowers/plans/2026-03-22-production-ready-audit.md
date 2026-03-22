# FHIRBridge Production-Ready Audit — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Comprehensive review + testing of FHIRBridge across 6 phases — unit gaps, integration, CLI E2E, Playwright E2E, security/a11y, performance. Zero bugs tolerated.

**Architecture:** Each phase produces a test suite running against real infrastructure (Docker Postgres + Redis). Phase 1 sets up infra + fills unit gaps. Phase 2 adds API integration tests. Phases 3+4 (parallel) add CLI + Playwright E2E. Phases 5+6 (parallel) add security/a11y + performance.

**Tech Stack:** Vitest (unit/integration), Playwright (E2E/a11y), @axe-core/playwright (accessibility), @lhci/cli (Lighthouse), Docker Compose (Postgres 16 + Redis 7), autocannon (load testing)

**Spec:** `docs/superpowers/specs/2026-03-22-production-ready-audit-design.md`

---

## Phase 1: Test Infrastructure + Unit Test Gaps

### Task 1: Docker Test Profile + Test Environment

**Files:**

- Create: `docker/docker-compose.test.yml`
- Create: `.env.test`
- Create: `scripts/test-teardown.sh`
- Modify: `scripts/test-setup.sh`

- [ ] **Step 1: Create docker-compose.test.yml**

```yaml
# docker/docker-compose.test.yml
version: '3.9'
services:
  postgres-test:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: fhirbridge_test
      POSTGRES_PASSWORD: testpass
      POSTGRES_DB: fhirbridge_test
    ports:
      - '5433:5432'
    volumes:
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/init.sql:ro
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U fhirbridge_test']
      interval: 5s
      timeout: 3s
      retries: 5

  redis-test:
    image: redis:7-alpine
    ports:
      - '6380:6379'
    healthcheck:
      test: ['CMD', 'redis-cli', 'ping']
      interval: 5s
      timeout: 3s
      retries: 5
```

- [ ] **Step 2: Create .env.test**

```env
PORT=3002
HOST=0.0.0.0
JWT_SECRET=test-jwt-secret-for-testing-only-min32chars
HMAC_SECRET=test-hmac-secret-for-testing-only-min32ch
API_KEYS=test-key-free,test-key-paid
CORS_ORIGINS=http://localhost:4173
DATABASE_URL=postgresql://fhirbridge_test:testpass@localhost:5433/fhirbridge_test
REDIS_URL=redis://localhost:6380
LOG_LEVEL=silent
TRUST_PROXY=false
NODE_ENV=test
```

- [ ] **Step 3: Create test-teardown.sh**

```bash
#!/bin/bash
docker compose -f docker/docker-compose.test.yml down -v 2>/dev/null
echo "Test infrastructure stopped"
```

- [ ] **Step 4: Update test-setup.sh to support test mode**

Add `--test` flag that uses `docker-compose.test.yml` and `.env.test`.

- [ ] **Step 5: Verify Docker test infra starts/stops**

Run: `bash scripts/test-setup.sh --test && sleep 5 && bash scripts/test-teardown.sh`
Expected: Postgres on 5433, Redis on 6380, both healthy, then cleaned up.

- [ ] **Step 6: Commit**

```bash
git add docker/docker-compose.test.yml .env.test scripts/
git commit -m "test: add Docker test profile with isolated ports"
```

---

### Task 2: Install Playwright + Integration/Security/Perf Configs

**Files:**

- Modify: `package.json` (root)
- Modify: `.gitignore` (add screenshots/videos/lighthouse-reports)
- Create: `playwright.config.ts`
- Create: `tests/e2e/global-setup.ts`
- Create: `tests/e2e/global-teardown.ts`
- Create: `vitest.integration.config.ts`
- Create: `vitest.security.config.ts`
- Create: `vitest.perf.config.ts`
- Create: `lighthouserc.json`
- Create: `tests/e2e/smoke.spec.ts`

- [ ] **Step 1: Install Playwright + devDependencies**

Run:

```bash
pnpm add -Dw @playwright/test @axe-core/playwright
npx playwright install chromium firefox webkit
pnpm add -Dw @lhci/cli autocannon
```

- [ ] **Step 2: Create playwright.config.ts**

3 browser projects (chromium, firefox, webkit) x 2 viewports (desktop 1280x720, tablet 768x1024). Include:

- `globalSetup: './tests/e2e/global-setup.ts'` — waits for Docker healthy, runs DB init
- `globalTeardown: './tests/e2e/global-teardown.ts'` — cleanup test data
- `webServer`: start API on 3002, Web preview on 4173
- `use.video: 'on-first-retry'` — video recording on retries only
- `use.screenshot: 'only-on-failure'`
- `outputDir: 'tests/e2e/screenshots/'`
- `expect.toHaveScreenshot: { maxDiffPixelRatio: 0.01 }`

- [ ] **Step 2b: Create global-setup.ts**

```typescript
// tests/e2e/global-setup.ts
// Verify Docker test containers are healthy before running E2E tests.
// Does NOT start Docker — assumes `scripts/test-setup.sh --test` was run beforehand.
// This avoids conflict with integration setup.ts which also needs Docker.
```

Checks: Postgres on 5433 accepts connections, Redis on 6380 responds to PING. Throws if not healthy within 30s.

- [ ] **Step 2c: Create global-teardown.ts**

Truncates test data from audit_logs and usage_tracking tables. Does NOT stop Docker (left to manual `test-teardown.sh`).

- [ ] **Step 2d: Add .gitignore entries**

Add: `tests/e2e/screenshots/`, `tests/e2e/test-results/`, `tests/perf/lighthouse-reports/`

- [ ] **Step 3: Create vitest.integration.config.ts**

```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    include: ['tests/integration/**/*.integration.test.ts'],
    testTimeout: 30_000,
    hookTimeout: 15_000,
    setupFiles: ['tests/integration/setup.ts'],
  },
});
```

- [ ] **Step 4: Create vitest.security.config.ts + vitest.perf.config.ts**

Same pattern — include `tests/security/**` and `tests/perf/**` respectively. Perf config has 120s timeout.

- [ ] **Step 5: Create lighthouserc.json**

Targets: Performance > 80, Accessibility > 90, Best Practices > 90. Collect from `http://localhost:4173`. Output: `tests/perf/lighthouse-reports/` (JSON + HTML reports).

- [ ] **Step 6: Create smoke test**

`tests/e2e/smoke.spec.ts`: GET /api/v1/health returns 200, Web UI loads with title "FHIRBridge".

- [ ] **Step 7: Add test scripts to root package.json**

Add: `test:integration`, `test:e2e`, `test:e2e:ui`, `test:security`, `test:a11y`, `test:perf`, `test:lighthouse`, `test:all`.

- [ ] **Step 8: Run smoke test**

Run: `pnpm test:e2e tests/e2e/smoke.spec.ts`
Expected: Pass on chromium (at least).

- [ ] **Step 9: Commit**

```bash
git add playwright.config.ts vitest.*.config.ts lighthouserc.json tests/e2e/ package.json pnpm-lock.yaml
git commit -m "test: add Playwright + integration/security/perf configs"
```

---

### Task 3: Core Unit Test Gaps — AI Module

**Files:**

- Create: `packages/core/src/ai/__tests__/claude-provider.test.ts`
- Create: `packages/core/src/ai/__tests__/openai-provider.test.ts`
- Create: `packages/core/src/ai/__tests__/provider-gateway.test.ts`
- Create: `packages/core/src/ai/__tests__/section-summarizer.test.ts`
- Create: `packages/core/src/ai/__tests__/synthesis-engine.test.ts`
- Create: `packages/core/src/ai/__tests__/pdf-formatter.test.ts`

- [ ] **Step 1: Write claude-provider tests** — interface compliance (has `name`, `generate`, `isAvailable`), error when no API key, skip real calls annotation
- [ ] **Step 2: Write openai-provider tests** — same pattern
- [ ] **Step 3: Write provider-gateway tests** — stub AiProvider, test fallback when primary fails, event emission (`provider-switch`), full orchestration flow
- [ ] **Step 4: Write section-summarizer tests** — resource grouping by type (conditions, meds, allergies etc), correct prompt per section, stub provider returns fixed text
- [ ] **Step 5: Write synthesis-engine tests** — combines sections into narrative, language switching (en/vi/ja), detail levels
- [ ] **Step 6: Write pdf-formatter tests** — returns Buffer, buffer starts with `%PDF`, contains section titles
- [ ] **Step 7: Run tests** — `pnpm --filter @fhirbridge/core test`
- [ ] **Step 8: Fix any bugs found**
- [ ] **Step 9: Commit**

---

### Task 4: Core Unit Test Gaps — Pipeline, Coding, Connectors, Billing, Validators

**Files:**

- Create: `packages/core/src/pipeline/__tests__/resource-transformer.test.ts`
- Create: `packages/core/src/coding/__tests__/code-system-lookup.test.ts`
- Create: `packages/core/src/coding/__tests__/code-systems.test.ts`
- Create: `packages/core/src/connectors/__tests__/fhir-endpoint-connector.test.ts`
- Create: `packages/core/src/connectors/__tests__/his-connector-interface.test.ts`
- Create: `packages/core/src/billing/__tests__/stripe-provider.test.ts`
- Create: `packages/core/src/billing/__tests__/sepay-provider.test.ts`
- Create: `packages/core/src/validators/__tests__/coding-validator.test.ts`
- Create: `packages/core/src/validators/__tests__/reference-validator.test.ts`

- [ ] **Step 1: Write resource-transformer tests** — direct field mapping, custom mapping config, date normalization, nested paths
- [ ] **Step 2: Write code-system-lookup tests** — lookupCode returns display for known LOINC/SNOMED/RxNorm codes, isKnownCode true/false, getCodesForSystem returns correct list
- [ ] **Step 3: Write code-systems tests** — verify LOINC_SYSTEM/SNOMED_SYSTEM/RXNORM_SYSTEM URIs correct, KNOWN_SYSTEMS contains all systems
- [ ] **Step 4: Write fhir-endpoint-connector tests** — stub HTTP (vi.mock the fhir-kit-client require), test connect/testConnection/fetchPatientData/disconnect, pagination via next link, error handling
- [ ] **Step 5: Write his-connector-interface tests** — verify CsvConnector, ExcelConnector, FhirEndpointConnector all implement HisConnector (type, connect, testConnection, fetchPatientData, disconnect)
- [ ] **Step 6: Write stripe-provider tests** — stub Stripe SDK, test createSubscription returns PaymentIntent, handleWebhook verifies signature, rejects invalid
- [ ] **Step 7: Write sepay-provider tests** — test QR URL generation, HMAC-SHA256 webhook verification, reject tampered payload
- [ ] **Step 8: Write coding-validator tests** — valid coding with known system, unknown system warns, empty code errors, validateCodeableConcept
- [ ] **Step 9: Write reference-validator tests** — urn:uuid format valid, relative reference valid, absolute URL valid, in-bundle resolution, broken reference errors
- [ ] **Step 10: Run all core tests** — `pnpm --filter @fhirbridge/core test`
- [ ] **Step 11: Fix bugs, re-run until pass**
- [ ] **Step 12: Commit**

---

### Task 5: CLI Unit Test Gaps

**Files:**

- Create: `packages/cli/src/commands/__tests__/export-command.test.ts`
- Create: `packages/cli/src/commands/__tests__/import-command.test.ts`
- Create: `packages/cli/src/commands/__tests__/summarize-command.test.ts`
- Create: `packages/cli/src/commands/__tests__/config-command.test.ts`
- Create: `packages/cli/src/config/__tests__/profile-store.test.ts`
- Create: `packages/cli/src/formatters/__tests__/table-formatter.test.ts`
- Create: `packages/cli/src/formatters/__tests__/json-formatter.test.ts`
- Create: `packages/cli/src/formatters/__tests__/progress-display.test.ts`
- Create: `packages/cli/src/utils/__tests__/logger.test.ts`
- Create: `packages/cli/src/utils/__tests__/file-writer.test.ts`

- [ ] **Step 1: Write export-command tests** — buildProgram() + parseAsync with args, verify options parsed, missing required arg errors
- [ ] **Step 2: Write import-command tests** — detect CSV vs Excel by extension, mapping flag parsed, output path
- [ ] **Step 3: Write summarize-command tests** — provider selection, language flag, detail flag, output format
- [ ] **Step 4: Write config-command tests** — subcommands set/get/list/add-profile/remove-profile parse correctly
- [ ] **Step 5: Write profile-store tests** — create profile, read profiles, update, delete, persist to JSON file
- [ ] **Step 6: Write formatter tests** — table-formatter: aligned columns, empty data, key-value format. json-formatter: pretty JSON, valid output. progress-display: noop when !process.stdout.isTTY
- [ ] **Step 7: Write logger tests** — info/success/warn/error output, verbose mode shows debug, quiet suppresses info
- [ ] **Step 8: Write file-writer tests** — write to temp file, path traversal `../` rejected, stdout mode
- [ ] **Step 9: Run cli tests** — `pnpm --filter @fhirbridge/cli test`
- [ ] **Step 10: Fix bugs, commit**

---

### Task 6: API Unit Test Gaps

**Files:**

- Create: `packages/api/src/plugins/__tests__/cors-plugin.test.ts`
- Create: `packages/api/src/plugins/__tests__/request-id-plugin.test.ts`
- Create: `packages/api/src/plugins/__tests__/audit-plugin.test.ts`
- Create: `packages/api/src/plugins/__tests__/rate-limiter-plugin.test.ts`
- Create: `packages/api/src/routes/__tests__/export-routes.test.ts` (expand existing)
- Create: `packages/api/src/routes/__tests__/summary-routes.test.ts`
- Create: `packages/api/src/services/__tests__/billing-service.test.ts`
- Create: `packages/api/src/services/__tests__/audit-service.test.ts`
- Create: `packages/api/src/services/__tests__/postgres-usage-tracker.test.ts`
- Create: `packages/api/src/schemas/__tests__/export-schemas.test.ts`
- Create: `packages/api/src/schemas/__tests__/connector-schemas.test.ts`
- Create: `packages/api/src/schemas/__tests__/summary-schemas.test.ts`
- Create: `packages/api/src/schemas/__tests__/billing-schemas.test.ts`

- [ ] **Step 1: Write plugin tests** — cors (wildcard no credentials, specific origins), request-id (generated, propagated), audit (onResponse called, userId hashed), rate-limiter (tier limits applied)
- [ ] **Step 2: Write export-routes tests** — POST returns 202, GET status, GET download with Content-Type, quota 402, IDOR 404
- [ ] **Step 3: Write summary-routes tests** — POST returns 202, free tier 402, download format selection
- [ ] **Step 4: Write service tests** — billing-service checkQuota/recordUsage, audit-service ConsoleAuditSink, postgres-usage-tracker (stub pg.Pool)
- [ ] **Step 5: Write schema tests** — validate correct payload passes, invalid payload rejected, for all 4 schema files
- [ ] **Step 6: Run api tests** — `pnpm --filter @fhirbridge/api test`
- [ ] **Step 7: Fix bugs, commit**

---

### Task 7: Web Component Unit Test Gaps

**Files:**

- Create: `packages/web/src/api/__tests__/api-client.test.ts`
- Create: `packages/web/src/api/__tests__/export-api.test.ts`
- Create: `packages/web/src/components/export/__tests__/connector-form.test.tsx`
- Create: `packages/web/src/components/export/__tests__/export-progress.test.tsx`
- Create: `packages/web/src/components/export/__tests__/export-result.test.tsx`
- Create: `packages/web/src/components/summary/__tests__/summary-config.test.tsx`
- Create: `packages/web/src/components/summary/__tests__/summary-display.test.tsx`
- Create: `packages/web/src/components/summary/__tests__/summary-actions.test.tsx`
- Create: `packages/web/src/components/layout/__tests__/app-sidebar.test.tsx`
- Create: `packages/web/src/hooks/__tests__/use-export.test.ts`
- Create: `packages/web/src/hooks/__tests__/use-file-upload.test.ts`
- Create: `packages/web/src/pages/__tests__/export-wizard-page.test.tsx`
- Create: `packages/web/src/pages/__tests__/import-page.test.tsx`
- Create: `packages/web/src/pages/__tests__/settings-page.test.tsx`

- [ ] **Step 1: Write api-client tests** — fetch mock, auth header included, error parsing, base URL
- [ ] **Step 2: Write export-api tests** — startExport calls POST, getStatus calls GET, downloadBundle returns blob
- [ ] **Step 3: Write export component tests** — connector-form validates URL, export-progress shows steps, export-result has download button
- [ ] **Step 4: Write summary component tests** — config selectors, markdown display, disclaimer visible, download buttons
- [ ] **Step 5: Write layout tests** — sidebar nav links, active state highlighting
- [ ] **Step 6: Write hook tests** — use-export state machine (idle->configuring->exporting->complete), use-file-upload progress tracking
- [ ] **Step 7: Write page tests** — export-wizard step navigation, import-page dropzone+mapper, settings-page theme toggle
- [ ] **Step 8: Run web tests** — `pnpm --filter @fhirbridge/web test`
- [ ] **Step 9: Fix bugs, commit**

---

### Task 8: Phase 1 Verification

- [ ] **Step 1: Run full test suite** — `pnpm test`
- [ ] **Step 2: Verify test count increased** — target: 700+ tests (from 395)
- [ ] **Step 3: Run build** — `pnpm build`
- [ ] **Step 4: Final commit for Phase 1**

---

## Phase 2: API Integration Tests

### Task 9: Integration Test Setup

**Files:**

- Create: `tests/integration/setup.ts`
- Create: `tests/integration/helpers.ts`

- [ ] **Step 1: Create setup.ts** — Does NOT start Docker (assumes `scripts/test-setup.sh --test` was already run). Loads `.env.test` via dotenv, verifies Postgres + Redis are reachable, creates Fastify server instance via `createServer(loadConfig())`
- [ ] **Step 2: Create helpers.ts** — `createTestServer()`, `makeAuthHeader(userId, tier)`, `makeApiKeyHeader(key)`, `queryPostgres(sql)`, `queryRedis(cmd)`
- [ ] **Step 3: Verify setup** — `pnpm test:integration` runs (empty, 0 tests)
- [ ] **Step 4: Commit**

---

### Task 10: Auth + Rate Limiting + Audit Integration Tests

**Files:**

- Create: `tests/integration/auth.integration.test.ts`
- Create: `tests/integration/rate-limit.integration.test.ts`
- Create: `tests/integration/audit.integration.test.ts`

- [ ] **Step 1: Write auth tests** — 8 test cases (valid JWT, expired, invalid sig, alg:none, API key, invalid key, no auth, health bypass)
- [ ] **Step 2: Write rate-limit tests** — free tier 11th request 429, paid tier 101st, headers present, Redis counter verified, per-user isolation
- [ ] **Step 3: Write audit tests** — API call -> query audit_logs table, verify hashed userId, no PHI, batch flush
- [ ] **Step 4: Run** — `pnpm test:integration`
- [ ] **Step 5: Fix bugs in source code if tests reveal issues**
- [ ] **Step 6: Commit**

---

### Task 11: Export + Import + Summary + Billing Integration Tests

**Files:**

- Create: `tests/integration/export.integration.test.ts`
- Create: `tests/integration/import.integration.test.ts`
- Create: `tests/integration/summary.integration.test.ts`
- Create: `tests/integration/billing.integration.test.ts`

- [ ] **Step 1: Write export tests** — POST 202, GET status, GET download, IDOR 404, quota 402, SSRF blocked
- [ ] **Step 2: Write import tests** — CSV multipart 200, invalid file error, oversized 413, connector test, SSRF blocked
- [ ] **Step 3: Write summary tests** — POST 202, free tier 402, paid tier 202, IDOR protection
- [ ] **Step 4: Write billing tests** — GET plans, GET usage, usage increment, subscribe, Stripe webhook, SePay webhook, idempotency
- [ ] **Step 5: Run all integration tests** — `pnpm test:integration`
- [ ] **Step 6: Fix bugs, re-run loop until 100% pass**
- [ ] **Step 7: Commit**

---

## Phase 3: CLI End-to-End Tests (parallel with Phase 4)

### Task 12: CLI Test Harness + All Commands

**Files:**

- Create: `tests/e2e/cli/cli-test-helper.ts`
- Create: `tests/e2e/cli/validate.spec.ts`
- Create: `tests/e2e/cli/import.spec.ts`
- Create: `tests/e2e/cli/export.spec.ts`
- Create: `tests/e2e/cli/config.spec.ts`
- Create: `tests/e2e/cli/summarize.spec.ts`

- [ ] **Step 1: Create cli-test-helper** — `runCli(args): Promise<{stdout, stderr, exitCode}>`, spawn `node packages/cli/bin/fhirbridge.js`, temp dirs, 30s timeout
- [ ] **Step 2: Write validate tests** — valid bundle exit 0, invalid exit 1, missing file exit 1, empty bundle, 1K resources < 5s
- [ ] **Step 3: Write import tests** — CSV with mapping -> valid bundle file, Excel import, missing file error, stdout output
- [ ] **Step 4: Write export tests** — HAPI FHIR export (skip if offline), invalid endpoint error, SSRF blocked
- [ ] **Step 5: Write config tests** — add-profile, list, get, set, remove-profile, isolated temp HOME, 0o600 permissions
- [ ] **Step 6: Write summarize tests** — with API key (skip if absent), without key graceful error, language flag, format flag, output to file
- [ ] **Step 7: Run** — `npx vitest run tests/e2e/cli/` (or however CLI E2E is configured)
- [ ] **Step 8: Fix bugs, commit**

---

## Phase 4: Playwright E2E (parallel with Phase 3)

### Task 13: Playwright Helpers + Page Object Models

**Files:**

- Create: `tests/e2e/web/fixtures/test-patients.csv`
- Create: `tests/e2e/web/fixtures/test-bundle.json`
- Create: `tests/e2e/web/helpers/auth.ts`
- Create: `tests/e2e/web/helpers/navigation.ts`
- Create: `tests/e2e/web/pages/dashboard.page.ts`
- Create: `tests/e2e/web/pages/export-wizard.page.ts`
- Create: `tests/e2e/web/pages/import.page.ts`
- Create: `tests/e2e/web/pages/summary-viewer.page.ts`
- Create: `tests/e2e/web/pages/settings.page.ts`

- [ ] **Step 1: Create test fixtures** — CSV with 5 patients, FHIR bundle JSON with Patient+Condition+Observation
- [ ] **Step 2: Create auth helper** — navigate to settings, fill API key, save
- [ ] **Step 3: Create navigation helper** — `goto(page)` with route map
- [ ] **Step 4: Create Page Object Models** — each with locators for key elements + action methods
- [ ] **Step 5: Commit**

---

### Task 14: Dashboard + Settings + Error States E2E

**Files:**

- Create: `tests/e2e/web/dashboard.spec.ts`
- Create: `tests/e2e/web/settings.spec.ts`
- Create: `tests/e2e/web/error-states.spec.ts`

- [ ] **Step 1: Write dashboard tests** — loads without console.error, health indicator, quick actions, recent exports table, sidebar nav, tablet responsive
- [ ] **Step 2: Write settings tests** — API key masked, provider dropdown, language, theme toggle, persistence across nav, dark mode
- [ ] **Step 3: Write error-states tests** — API down error boundary, 401 auth error, 429 rate limit, 402 quota, form validation
- [ ] **Step 4: Run** — `pnpm test:e2e tests/e2e/web/dashboard.spec.ts tests/e2e/web/settings.spec.ts tests/e2e/web/error-states.spec.ts`
- [ ] **Step 5: Fix UI bugs, commit**

---

### Task 15: Export Wizard + Import + Summary Viewer + Billing E2E

**Files:**

- Create: `tests/e2e/web/export-wizard.spec.ts`
- Create: `tests/e2e/web/import.spec.ts`
- Create: `tests/e2e/web/summary-viewer.spec.ts`
- Create: `tests/e2e/web/billing.spec.ts`

- [ ] **Step 1: Write export-wizard tests** — full 6-step flow, step nav, form validation, file upload, review, progress, download, cancel
- [ ] **Step 2: Write import tests** — dropzone accepts CSV/XLSX/JSON, rejects invalid, column mapper, preview table, import produces bundle
- [ ] **Step 3: Write summary-viewer tests** — config panel, generate button, markdown render, section nav, download buttons, AI disclaimer, skip if no key
- [ ] **Step 4: Write billing tests** — 402 shows upgrade prompt, plans visible, usage display
- [ ] **Step 5: Run full E2E** — `pnpm test:e2e` (all 6 browser/viewport combos)
- [ ] **Step 6: Fix bugs across all browsers, capture visual regression baselines**
- [ ] **Step 7: Commit**

---

## Phase 5: Security + Accessibility Audit (parallel with Phase 6)

### Task 16: Security Tests

**Files:**

- Create: `tests/security/xss.test.ts`
- Create: `tests/security/auth-security.test.ts`
- Create: `tests/security/file-upload-security.test.ts`
- Create: `tests/security/ssrf-deep.test.ts`
- Create: `tests/security/header-security.test.ts`

- [ ] **Step 1: Write XSS tests** — inject script tags in API inputs, verify JSON responses escaped, test markdown XSS in Playwright
- [ ] **Step 2: Write auth-security tests** — JWT alg:none rejected, tampered payload rejected, API key timing resistance, CORS malicious origin
- [ ] **Step 3: Write file-upload tests** — path traversal filename, polyglot file, oversized 413, null byte
- [ ] **Step 4: Write SSRF-deep tests** — IPv6 [::1], credentials in URL `http://user:pass@internal`, decimal IP 0x7f000001, 302 redirect to localhost (if HTTP client follows redirects)
- [ ] **Step 5: Write header-security tests** — X-Content-Type-Options, X-Frame-Options, no Server version, no stack traces
- [ ] **Step 6: Run** — `pnpm test:security`
- [ ] **Step 7: Fix any vulnerabilities found**
- [ ] **Step 8: Commit**

---

### Task 17: Accessibility Tests

**Files:**

- Create: `tests/e2e/a11y/axe-scan.spec.ts`
- Create: `tests/e2e/a11y/keyboard-navigation.spec.ts`

- [ ] **Step 1: Write axe-core scan** — scan every page (dashboard, export wizard each step, import, summary, settings), both light and dark mode, zero critical/serious violations
- [ ] **Step 2: Write keyboard navigation tests** — tab through export wizard all steps, Enter/Space activate, Escape closes, focus visible
- [ ] **Step 3: Verify screen reader attributes** — alt text, labels, aria-describedby, aria-live, document.title
- [ ] **Step 4: Verify color contrast** — axe-core `color-contrast` rule enabled, scan all pages in light mode AND dark mode separately, assert 4.5:1 for normal text, 3:1 for large text and interactive elements
- [ ] **Step 5: Run** — `pnpm test:a11y`
- [ ] **Step 6: Fix a11y violations (add aria labels, fix contrast, add focus styles)**
- [ ] **Step 7: Re-run until zero critical/serious violations**
- [ ] **Step 8: Commit**

---

## Phase 6: Performance + Stress Testing (parallel with Phase 5)

### Task 18: API + Data Processing Benchmarks

**Files:**

- Create: `tests/perf/api-benchmarks.test.ts`
- Create: `tests/perf/data-benchmarks.test.ts`
- Create: `tests/perf/helpers/generate-csv.ts`

- [ ] **Step 1: Create CSV generator** — generate 1K/10K/100K row CSV files for benchmarks
- [ ] **Step 2: Write API benchmarks** — GET /health p95<50ms, POST /export p95<500ms, GET /billing/plans p95<20ms, 100 req throughput, RSS after 1000 req
- [ ] **Step 3: Write data benchmarks** — CSV import 1K/10K/100K rows timing + RSS, bundle serialization 1K/5K, validation 1K, deidentification 1K
- [ ] **Step 4: Run** — `pnpm test:perf`
- [ ] **Step 5: Optimize if benchmarks fail (streaming, memory, query optimization)**
- [ ] **Step 6: Commit**

---

### Task 19: Rate Limiter Stress + Memory Leak Detection

**Files:**

- Create: `tests/perf/rate-limiter-stress.test.ts`
- Create: `tests/perf/memory-leak.test.ts`

- [ ] **Step 1: Write rate limiter stress** — burst 100 req verify <=10 pass, sustained 5 req/s for 60s, multi-user isolation
- [ ] **Step 2: Write memory leak tests** — API 1000 export cycles RSS delta <50MB, CLI 50 validate commands RSS stable
- [ ] **Step 3: Run** — `pnpm test:perf`
- [ ] **Step 4: Fix leaks if found**
- [ ] **Step 5: Commit**

---

### Task 20: Lighthouse CI + Web UI Stress

**Files:**

- Create: `tests/e2e/web/performance.spec.ts`

- [ ] **Step 1: Run Lighthouse** — `pnpm test:lighthouse`, verify Performance>80, Accessibility>90, Best Practices>90
- [ ] **Step 2: Write web stress tests** — dashboard 100 exports no jank, 10MB file upload no freeze, memory stable after 10 nav cycles
- [ ] **Step 3: Fix performance issues if Lighthouse fails** — lazy loading, code splitting, image optimization
- [ ] **Step 4: Commit**

---

## Final Verification

### Task 21: Full Suite Run + Final Commit

- [ ] **Step 1: Run everything** — `pnpm test:all`
- [ ] **Step 2: Verify zero failures across all suites**
- [ ] **Step 3: Run `pnpm build` to confirm build still passes**
- [ ] **Step 4: Create summary commit**

```bash
git add -A
git commit -m "test: Production-Ready Audit complete — full test coverage across 6 phases"
```

- [ ] **Step 5: Generate final report** — test count, coverage areas, bugs found + fixed, performance benchmarks
