# FHIRBridge Production-Ready Audit — Design Spec

## Goal

Comprehensive review and testing of the entire FHIRBridge project across 6 phases. Zero bugs or feature gaps tolerated. Every test runs against real infrastructure (Docker Postgres + Redis + API server + Web UI + real browsers).

## Constraints

- Integration and E2E tests hit real infrastructure — no in-memory fallbacks
- **Unit test exception:** For external dependencies that are impractical to call in unit tests (AI providers, external FHIR servers, payment APIs), stub the interface boundary. Unit tests verify orchestration logic, not external service behavior. Integration/E2E tests verify the real connections.
- AI provider tests skip gracefully when API keys absent (log `[SKIPPED]`)
- Playwright: Chromium + Firefox + WebKit x desktop (1280x720) + tablet (768x1024) = 6 matrix combos
- Phase ordering: Phase 1 then Phase 2 (sequential). Phases 3+4 can run in parallel. Phases 5+6 can run in parallel.
- Fix bugs inline during each phase — no deferral

## Test Infrastructure

### Docker Test Profile

Extend existing `docker/docker-compose.yml` with test overrides:

- `docker/docker-compose.test.yml` — same Postgres 16 + Redis 7 but isolated ports (5433, 6380) to avoid conflicts with dev
- Test database: `fhirbridge_test` (separate from `fhirbridge_audit`)
- Init script runs `docker/postgres/init.sql` against test DB

### Playwright Configuration

- `playwright.config.ts` at project root
- 3 browser projects: chromium, firefox, webkit
- Each project runs with 2 viewports via parameterized test fixtures
- `webServer` config: start API (port 3002) + Web (port 4173) before tests
- `globalSetup`: wait for Docker services healthy, run DB init
- `globalTeardown`: stop servers, cleanup test data
- Test directory: `tests/e2e/`
- Screenshots on failure: `tests/e2e/screenshots/`
- Visual regression: `expect(page).toHaveScreenshot()` with `maxDiffPixelRatio: 0.01`, update via `--update-snapshots`
- Video recording: on first retry only (save disk)

### Lighthouse

Run via `@lhci/cli` as a separate script (`pnpm test:lighthouse`), not inside Playwright specs. Output: JSON report + HTML report in `tests/perf/lighthouse-reports/`.

### Test Scripts (root package.json)

```json
{
  "test": "turbo run test",
  "test:integration": "vitest run --config vitest.integration.config.ts",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:security": "vitest run --config vitest.security.config.ts",
  "test:a11y": "playwright test --grep @a11y",
  "test:perf": "vitest run --config vitest.perf.config.ts",
  "test:lighthouse": "lhci autorun --config lighthouserc.json",
  "test:all": "pnpm test && pnpm test:integration && pnpm test:e2e && pnpm test:security && pnpm test:perf && pnpm test:lighthouse"
}
```

Note: `test:all` uses `&&` (fail-fast — stops on first failure). Expected total runtime: ~15-20 minutes.

### Environment

- `.env.test` — test-specific env vars (test DB, test Redis, test ports, test JWT secret)
- API keys optional — AI tests skip if absent
- `@fhirbridge/types` — types-only package, no runtime code, excluded from unit test requirements

---

## Phase 1 — Test Infrastructure + Unit Test Gaps

### Objective

Set up full-stack test infrastructure. Fill every unit test gap so all business logic modules have coverage.

### Deliverables

#### 1.1 Playwright Setup

- Install: `@playwright/test`, `@axe-core/playwright`, browsers
- `playwright.config.ts`: 3 browsers x 2 viewports, webServer config
- `tests/e2e/` directory structure
- Smoke test: `tests/e2e/smoke.spec.ts` — verify health endpoint + web UI loads

#### 1.2 Docker Test Profile

- `docker/docker-compose.test.yml` — isolated ports (5433, 6380)
- `.env.test` — all test env vars
- `scripts/test-setup.sh` — start Docker, wait healthy, create test DB
- `scripts/test-teardown.sh` — cleanup

#### 1.3 Integration Test Config

- `vitest.integration.config.ts` — separate from unit tests, longer timeout (30s)
- Test files: `**/*.integration.test.ts`

#### 1.4 Missing Unit Tests (by module)

**@fhirbridge/core — AI module:**

- `ai/__tests__/claude-provider.test.ts` — interface compliance, error handling, skip real calls if no key
- `ai/__tests__/openai-provider.test.ts` — same pattern
- `ai/__tests__/provider-gateway.test.ts` — fallback logic, event emission, orchestration (stub AiProvider interface)
- `ai/__tests__/section-summarizer.test.ts` — resource grouping, section extraction (stub AiProvider)
- `ai/__tests__/synthesis-engine.test.ts` — section combination, language switching (stub AiProvider)
- `ai/__tests__/pdf-formatter.test.ts` — PDF buffer generation, page count, metadata

**@fhirbridge/core — pipeline + coding:**

- `pipeline/__tests__/resource-transformer.test.ts` — field mapping, date normalization, nested path setting
- `coding/__tests__/code-system-lookup.test.ts` — lookupCode, isKnownCode, LOINC/SNOMED/RxNorm coverage
- `coding/__tests__/code-systems.test.ts` — verify all system URI constants, KNOWN_SYSTEMS completeness

**@fhirbridge/core — connectors:**

- `connectors/__tests__/fhir-endpoint-connector.test.ts` — connection, pagination, error handling (stub HTTP via nock or msw)
- `connectors/__tests__/his-connector-interface.test.ts` — interface compliance for CSV, Excel, FHIR connectors

**@fhirbridge/core — billing:**

- `billing/__tests__/stripe-provider.test.ts` — interface compliance, error handling (stub Stripe SDK)
- `billing/__tests__/sepay-provider.test.ts` — QR URL generation, webhook HMAC verification

**@fhirbridge/core — validators:**

- `validators/__tests__/coding-validator.test.ts` — code systems, unknown codes, edge cases
- `validators/__tests__/reference-validator.test.ts` — urn:uuid, relative, absolute, bundle resolution

**@fhirbridge/cli:**

- `commands/__tests__/export-command.test.ts` — arg parsing, missing args, non-TTY
- `commands/__tests__/import-command.test.ts` — file detection, mapping, output
- `commands/__tests__/summarize-command.test.ts` — provider selection, language, format
- `commands/__tests__/config-command.test.ts` — set, get, list, add-profile, remove-profile
- `config/__tests__/profile-store.test.ts` — CRUD operations, persistence
- `formatters/__tests__/table-formatter.test.ts` — column alignment, empty data
- `formatters/__tests__/json-formatter.test.ts` — pretty print, syntax highlight
- `formatters/__tests__/progress-display.test.ts` — noop in non-TTY, bar update
- `utils/__tests__/logger.test.ts` — verbose, quiet, no-color modes
- `utils/__tests__/file-writer.test.ts` — write to file, stdout, path traversal guard

**@fhirbridge/api:**

- `plugins/__tests__/cors-plugin.test.ts` — wildcard, specific origins, credentials disabled with wildcard
- `plugins/__tests__/request-id-plugin.test.ts` — generation, propagation, custom header
- `plugins/__tests__/audit-plugin.test.ts` — onResponse hook, hashed userId, async non-blocking
- `plugins/__tests__/rate-limiter-plugin.test.ts` — tier limits, in-memory fallback
- `routes/__tests__/export-routes.test.ts` — full export flow, quota check, download
- `routes/__tests__/summary-routes.test.ts` — generate, download, format selection
- `services/__tests__/billing-service.test.ts` — quota check logic, usage recording
- `services/__tests__/audit-service.test.ts` — ConsoleAuditSink compliance
- `services/__tests__/postgres-usage-tracker.test.ts` — track + query (stub pg Pool)
- `schemas/__tests__/export-schemas.test.ts` — valid/invalid payloads
- `schemas/__tests__/connector-schemas.test.ts` — valid/invalid payloads
- `schemas/__tests__/summary-schemas.test.ts` — valid/invalid payloads
- `schemas/__tests__/billing-schemas.test.ts` — valid/invalid payloads

**@fhirbridge/web (component unit tests):**

- `api/__tests__/api-client.test.ts` — fetch wrapper, auth header, error handling
- `api/__tests__/export-api.test.ts` — startExport, getStatus, downloadBundle
- `components/export/__tests__/connector-form.test.tsx` — form inputs, validation
- `components/export/__tests__/export-progress.test.tsx` — step display, status updates
- `components/export/__tests__/export-result.test.tsx` — download buttons, bundle preview
- `components/summary/__tests__/summary-config.test.tsx` — provider/language/detail selectors
- `components/summary/__tests__/summary-display.test.tsx` — markdown render, disclaimer
- `components/summary/__tests__/summary-actions.test.tsx` — download buttons
- `components/layout/__tests__/app-sidebar.test.tsx` — navigation links, active state
- `hooks/__tests__/use-export.test.ts` — state machine transitions
- `hooks/__tests__/use-file-upload.test.ts` — progress tracking, error handling
- `pages/__tests__/export-wizard-page.test.tsx` — step navigation, form flow
- `pages/__tests__/import-page.test.tsx` — dropzone + mapper integration
- `pages/__tests__/settings-page.test.tsx` — inputs, theme toggle, persistence

### Success Criteria

- Playwright smoke test passes on all 6 browser/viewport combos
- Docker test infra starts/stops cleanly
- Every business logic file in core/api/cli/web has a corresponding test file
- All tests pass

---

## Phase 2 — API Integration Tests

### Objective

Test every API endpoint against real Postgres + Redis. Verify auth, rate limiting, audit logging, billing quota enforcement, and error handling.

### Deliverables

#### 2.1 Auth Integration (`tests/integration/auth.integration.test.ts`)

- Valid JWT -> 200
- Expired JWT -> 401
- Invalid JWT signature -> 401
- JWT algorithm confusion (alg: none) -> 401
- Valid API key -> 200
- Invalid API key -> 401
- No auth -> 401 (except /health and webhooks)
- /health without auth -> 200

#### 2.2 Rate Limiting (`tests/integration/rate-limit.integration.test.ts`)

- Free tier: 11th request within 1 minute -> 429
- Paid tier: 101st request -> 429
- Verify `X-RateLimit-*` headers present
- Verify `Retry-After` header value
- Verify Redis counter via direct Redis KEYS/GET query
- Rate limit reset after window expires
- Multiple users: verify per-user isolation

#### 2.3 Audit Logging (`tests/integration/audit.integration.test.ts`)

- Make API calls -> verify rows in `audit_logs` table via direct Postgres query
- Verify: user_id_hash is SHA256 hex (not plaintext)
- Verify: no PHI in any column (scan all JSONB metadata)
- Verify: timestamp, action, status, duration_ms populated correctly
- Verify: batch flush works (trigger 50 entries, verify all written)

#### 2.4 Export Pipeline (`tests/integration/export.integration.test.ts`)

- POST /export with FHIR endpoint config -> 202
- GET /export/:id/status -> processing -> complete/failed
- GET /export/:id/download -> valid FHIR Bundle JSON with correct Content-Type
- IDOR: user A cannot access user B's export -> 404
- Quota exceeded -> 402 with usage info
- Invalid connector config -> 400
- SSRF: localhost, 127.0.0.1, [::1], 169.254.169.254, private IPs -> all blocked

#### 2.5 Import Pipeline (`tests/integration/import.integration.test.ts`)

- POST /connectors/import with CSV multipart -> 200 with bundle
- POST /connectors/import with invalid file -> error
- POST /connectors/import with oversized file -> 413
- POST /connectors/test with valid FHIR endpoint -> connected: true
- POST /connectors/test with SSRF URL -> blocked

#### 2.6 Summary Pipeline (`tests/integration/summary.integration.test.ts`)

- POST /summary/generate with bundle -> 202 (skip AI if no key)
- Free tier -> 402 (AI not included in free plan)
- Paid tier -> 202
- IDOR protection on summary download
- Invalid bundle format -> 400

#### 2.7 Billing (`tests/integration/billing.integration.test.ts`)

- GET /billing/plans -> returns free + paid with correct limits
- GET /billing/usage -> returns current period usage
- Usage increments after export initiation
- Quota resets with new period
- POST /billing/subscribe -> returns subscription/payment URL
- POST /billing/webhook/stripe -> verify Stripe signature validation, reject invalid
- POST /billing/webhook/sepay -> verify SePay HMAC validation, reject invalid
- Webhook idempotency: duplicate delivery handled gracefully

### Success Criteria

- All integration tests pass with real Postgres + Redis
- Audit logs verified in database
- Rate limit counters verified in Redis
- Zero auth bypass paths
- Both Stripe + SePay webhooks validated

---

## Phase 3 — CLI End-to-End Tests

### Objective

Test every CLI command as a real subprocess with real file I/O.

### Deliverables

#### 3.1 Test Harness (`tests/e2e/cli/cli-test-helper.ts`)

- Spawn `node packages/cli/bin/fhirbridge.js` as child process
- Capture stdout, stderr, exit code
- Timeout: 30s per command
- Temp directory for output files
- Temp HOME for config isolation

#### 3.2 Validate Command (`tests/e2e/cli/validate.spec.ts`)

- Valid bundle -> exit 0, "All resources valid"
- Invalid bundle (missing required fields) -> exit 1, error table
- Missing file -> exit 1, error message
- Empty bundle -> exit 0, "0 resources"
- Large bundle (1K resources) -> completes within 5s

#### 3.3 Import Command (`tests/e2e/cli/import.spec.ts`)

- CSV import with mapping -> valid bundle output file
- Excel import -> valid bundle output file
- Missing file -> exit 1, clear error
- Invalid mapping -> error message
- Output to stdout (no --output flag) -> valid JSON on stdout
- Verify output is valid parseable FHIR JSON

#### 3.4 Export Command (`tests/e2e/cli/export.spec.ts`)

- Export from HAPI FHIR public server -> bundle output (skip if network unavailable)
- Invalid endpoint -> error message, non-zero exit
- SSRF endpoint -> blocked
- Progress output on stderr (not mixed with JSON on stdout)

#### 3.5 Config Command (`tests/e2e/cli/config.spec.ts`)

- `config add-profile` -> persists to ~/.fhirbridgerc.json
- `config list` -> shows all profiles
- `config get` -> returns specific value
- `config set` -> updates value
- `config remove-profile` -> removes, verify gone from list
- Config file created with 0o600 permissions (not world-readable)

#### 3.6 Summarize Command (`tests/e2e/cli/summarize.spec.ts`)

- With valid bundle + API key -> summary output (skip if no key)
- Without API key -> graceful error, clear message
- Language flag (--language vi) -> output contains Vietnamese markers
- Format flag: markdown, composition -> different output structure
- Output to file -> file exists + valid content

### Success Criteria

- All CLI commands tested as real subprocesses
- Exit codes correct for success/failure
- File I/O verified (input read, output written, permissions)
- Non-TTY mode works (no interactive prompts blocking in CI)

---

## Phase 4 — Playwright E2E (Web UI)

### Objective

Test every user flow in real browsers. 3 browsers x 2 viewports = 6 matrix combinations.

### Deliverables

#### 4.1 Test Fixtures + Helpers

- `tests/e2e/web/fixtures/` — test CSV, FHIR bundle JSON
- `tests/e2e/web/helpers/auth.ts` — set API key via settings page
- `tests/e2e/web/helpers/navigation.ts` — goto page helpers
- Page Object Models: DashboardPage, ExportWizardPage, ImportPage, SummaryViewerPage, SettingsPage

#### 4.2 Dashboard (`tests/e2e/web/dashboard.spec.ts`)

- Page loads without JS errors (listen to console.error)
- Health indicator shows green when API up
- Quick action cards visible and clickable
- Recent exports table renders (empty state if no exports)
- Navigation sidebar works (all links navigate correctly)
- Responsive: sidebar collapses on tablet viewport

#### 4.3 Export Wizard (`tests/e2e/web/export-wizard.spec.ts`)

- Full 6-step flow: connector type -> config -> patient ID -> options -> review -> progress
- Step navigation: next, back, step indicator updates
- FHIR endpoint form validation (required fields show errors)
- File upload step (CSV drag-drop via Playwright input.setInputFiles)
- Review step shows all selections correctly
- Progress step shows status indicator
- Result step shows download button
- Cancel flow returns to dashboard

#### 4.4 Import Page (`tests/e2e/web/import.spec.ts`)

- File dropzone accepts CSV/XLSX/JSON (via setInputFiles)
- File dropzone rejects invalid types (show error)
- Column mapper shows source columns after upload
- Column mapper creates valid mapping
- Preview table shows first 10 rows
- Import produces downloadable bundle
- Large file handling (no browser freeze)

#### 4.5 Summary Viewer (`tests/e2e/web/summary-viewer.spec.ts`)

- Summary config panel (provider, language, detail level dropdowns)
- Generate button triggers API call
- Markdown content renders with sections (check heading elements)
- Section navigation scrolls to correct position
- Download buttons (PDF, Markdown) trigger download
- AI disclaimer banner visible on page
- Skip AI generation test if no API key

#### 4.6 Settings Page (`tests/e2e/web/settings.spec.ts`)

- API key input masked (type=password)
- Provider selection dropdown works
- Language selection changes value
- Theme toggle (light to dark) applies class to root element
- Settings persist across page navigation (navigate away and back)
- Dark mode applies to all major components (sidebar, cards, tables)

#### 4.7 Billing UI (`tests/e2e/web/billing.spec.ts`)

- 402 quota exceeded response -> shows upgrade prompt on export page
- Plans visible somewhere in UI (if billing page exists) or within error messages
- Usage display shows current period stats

#### 4.8 Error States (`tests/e2e/web/error-states.spec.ts`)

- API server down -> error boundary shown (not blank page)
- Network error during export -> retry prompt or error message
- Invalid input in forms -> validation messages visible
- 401 response -> auth error shown, prompt to check settings
- 429 rate limit -> rate limit message with retry info
- 402 quota exceeded -> upgrade prompt

#### 4.9 Cross-Browser + Responsive + Visual Regression

- All tests above run on: Chromium, Firefox, WebKit
- All tests above run on: desktop (1280x720), tablet (768x1024)
- Visual regression via `expect(page).toHaveScreenshot()` with `maxDiffPixelRatio: 0.01`
- Baseline update: `pnpm test:e2e --update-snapshots`
- Verify no horizontal scroll on tablet viewport
- Zero console.error in browser during all tests

### Success Criteria

- All user flows pass on 6 browser/viewport combos
- Zero console errors in browser during tests
- Visual regression baselines captured
- Responsive layout verified on tablet
- Billing/quota error flows tested

---

## Phase 5 — Security + Accessibility Audit

### Objective

Penetration testing for security vulnerabilities + WCAG 2.1 AA compliance.

### Deliverables

#### 5.1 Security Tests (`tests/security/`)

**XSS Prevention:**

- Inject `<script>alert(1)</script>` in all API input fields
- Verify React uses safe rendering (no raw innerHTML)
- Verify API JSON responses do not reflect unescaped input
- Test markdown rendering for XSS in summary viewer (via Playwright)

**Auth Security:**

- JWT algorithm confusion (alg: none) -> rejected
- JWT with tampered payload -> rejected
- API key timing attack resistance (constant-time comparison)
- CORS preflight with malicious origin -> not reflected when wildcard disabled

**File Upload Security:**

- Malicious filename: `../../../etc/passwd` -> sanitized
- Polyglot file (JPEG header + script content) -> handled safely
- Oversized file (beyond 50MB limit) -> 413
- Null byte in filename -> sanitized or rejected

**SSRF Deep Test:**

- IPv6 loopback `[::1]` -> blocked
- URL with credentials `http://user:pass@internal` -> blocked
- Redirect to internal (302 -> localhost) -> blocked (if applicable)
- Decimal IP `0x7f000001` -> blocked

**Header Security:**

- Verify: X-Content-Type-Options: nosniff
- Verify: X-Frame-Options or CSP frame-ancestors
- Verify: no server version disclosure (Server header)
- Verify: no stack traces in production error responses

#### 5.2 Accessibility Tests (`tests/e2e/a11y/`)

**axe-core Scan (via @axe-core/playwright):**

- Every page scanned: dashboard, export wizard (each step), import, summary viewer, settings
- Zero critical/serious violations
- Warnings logged but do not fail test
- Scan in both light and dark mode

**Keyboard Navigation:**

- Tab through entire export wizard — all controls reachable
- Enter/Space activate buttons and links
- Escape closes modals/dialogs
- Focus visible indicator on all interactive elements

**Screen Reader:**

- All images have alt text (or role="presentation")
- Form inputs have associated labels
- Error messages linked to inputs (aria-describedby)
- Status changes announced (aria-live regions for export progress)
- Page title changes on navigation (document.title)

**Color Contrast:**

- All text meets 4.5:1 ratio (normal text) / 3:1 (large text)
- Test in both light and dark mode
- Interactive elements meet 3:1 against background

### Success Criteria

- Zero XSS vulnerabilities
- Zero auth bypass paths
- Zero file upload exploits
- axe-core: zero critical/serious violations on all pages in both themes
- Keyboard: full wizard completable without mouse
- Color contrast: all text passes WCAG AA

---

## Phase 6 — Performance + Stress Testing

### Objective

Benchmark response times, throughput, memory usage. Identify bottlenecks.

### Deliverables

#### 6.1 API Benchmarks (`tests/perf/api-benchmarks.test.ts`)

- GET /health: p50 < 10ms, p95 < 50ms, p99 < 100ms
- POST /export: p50 < 100ms (initiation only), p95 < 500ms
- GET /billing/plans: p50 < 20ms
- 100 sequential requests -> measure average throughput (req/s)
- Memory usage baseline (RSS) after 1000 requests

#### 6.2 Data Processing Benchmarks (`tests/perf/data-benchmarks.test.ts`)

- CSV import 1K rows: < 2s, RSS < 100MB
- CSV import 10K rows: < 10s, RSS < 200MB
- CSV import 100K rows: < 60s, RSS < 500MB
- Bundle serialization (1K resources): < 500ms
- Bundle serialization (5K resources): < 2s
- FHIR validation (1K resources): < 1s
- De-identification (1K resources): < 1s

#### 6.3 Rate Limiter Stress (`tests/perf/rate-limiter-stress.test.ts`)

- Burst 100 sequential requests in rapid succession -> verify at most 10 pass (free tier, sliding window)
- Sustained load: 5 req/s for 60s -> verify rate limiting holds consistently
- Multiple users simultaneously -> verify per-user isolation (use autocannon or similar)

#### 6.4 Web UI Performance (Lighthouse CI)

- Run via `@lhci/cli` with `lighthouserc.json` config
- Targets: Performance > 80, Accessibility > 90, Best Practices > 90
- First Contentful Paint < 1.5s
- Largest Contentful Paint < 2.5s
- Reports saved to `tests/perf/lighthouse-reports/`

#### 6.5 Web UI Stress (Playwright)

- Dashboard with 100 exports in table -> no jank (check frame timing)
- File upload 10MB CSV -> no browser freeze
- Memory stable after 10 navigation cycles (no leak — check JS heap via CDP)

#### 6.6 Memory Leak Detection (`tests/perf/memory-leak.test.ts`)

- API: 1000 export initiation cycles -> RSS delta < 50MB
- CLI: 50 sequential validate commands -> RSS stable (delta < 20MB)

### Success Criteria

- All p95 benchmarks met
- No memory leaks detected
- Lighthouse scores above thresholds
- 100K CSV import completes within budget
- Rate limiter holds under burst

---

## Execution Strategy

**Phase ordering:**

```
Phase 1 (infra + unit gaps)
  then Phase 2 (API integration)
    then Phase 3 (CLI E2E) + Phase 4 (Playwright E2E) -- parallel
      then Phase 5 (security + a11y) + Phase 6 (perf + stress) -- parallel
```

Each phase runs as a loop:

1. Implement tests for the phase
2. Run tests — collect failures
3. Fix bugs found
4. Re-run tests
5. Repeat until 100% pass
6. Commit and move to next phase

Bugs found in any phase are fixed immediately — not deferred.

## Files Created/Modified Summary

### New files (~70 files)

- `playwright.config.ts`
- `vitest.integration.config.ts`
- `vitest.security.config.ts`
- `vitest.perf.config.ts`
- `lighthouserc.json`
- `docker/docker-compose.test.yml`
- `.env.test`
- `scripts/test-setup.sh` (update)
- `scripts/test-teardown.sh`
- `tests/e2e/**/*.spec.ts` (~15 spec files)
- `tests/e2e/web/helpers/*.ts` (~3 files)
- `tests/e2e/web/pages/*.ts` (~5 Page Object Models)
- `tests/e2e/cli/*.spec.ts` (~6 files)
- `tests/e2e/a11y/*.spec.ts` (~2 files)
- `tests/integration/**/*.integration.test.ts` (~8 files)
- `tests/security/**/*.test.ts` (~4 files)
- `tests/perf/**/*.test.ts` (~5 files)
- Missing unit tests (~35 files across core/api/cli/web)

### Modified files

- `package.json` — add test scripts + devDependencies
- Existing source files — bug fixes found during testing
