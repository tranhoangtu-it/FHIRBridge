# Code Standards

## Language & Compiler

| Setting | Value |
|---|---|
| Language | TypeScript 5.x |
| `strict` mode | `true` |
| `target` | `ES2022` |
| `module` | `NodeNext` (packages) / `ESNext` (web) |
| `moduleResolution` | `NodeNext` |
| `noUncheckedIndexedAccess` | `true` |

All packages compile without errors before merge.

---

## File Conventions

- **Naming:** kebab-case for all files. Names must describe purpose without reading content.
  - Good: `fhir-endpoint-connector.ts`, `bundle-serializer.ts`, `export-wizard-page.tsx`
  - Bad: `utils.ts`, `helpers.ts`, `index2.ts`
- **Size:** max 200 lines per file. Split by concern when approaching limit.
- **Barrel exports:** each feature directory has an `index.ts` re-exporting public API.
- **Test files:** co-located in `__tests__/` subdirectory beside the file under test.

---

## Package Structure

Each package follows:

```
packages/{name}/
├── src/
│   ├── {feature}/
│   │   ├── {feature-module}.ts
│   │   ├── index.ts           # barrel export
│   │   └── __tests__/
│   │       └── {feature-module}.test.ts
│   └── index.ts               # package public API
├── package.json
└── tsconfig.json
```

---

## Inter-Package Dependencies

Use `workspace:*` protocol:

```json
{
  "dependencies": {
    "@fhirbridge/types": "workspace:*",
    "@fhirbridge/core": "workspace:*"
  }
}
```

`@fhirbridge/web` depends on `@fhirbridge/api` only via HTTP — no workspace dependency.

---

## Error Handling

### Validators — `ValidationResult` Pattern

All validators return `ValidationResult`, never throw:

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
}
```

Callers check `result.valid` before proceeding. Never swallow errors silently.

### Services and Connectors

- Use `try/catch` around all external I/O (HTTP, file reads).
- Log errors at `error` level with context (no PHI in log messages).
- Re-throw domain errors with descriptive messages.
- HTTP errors from connectors are wrapped with status codes.

---

## Privacy Rules (Enforced in Code)

These are not guidelines — they are code requirements:

1. No PHI in log messages, error strings, or audit records.
2. Always call `deidentify()` on a bundle before passing to any AI provider.
3. No PHI in browser storage (`localStorage`, `sessionStorage`, cookies).
4. HMAC secret (`DEIDENTIFY_HMAC_SECRET`) read from env only — never hardcoded.
5. Audit records store: hashed user ID, action string, resource count integer — nothing else.

---

## Testing

**Framework:** Vitest

**Rules:**
- No mocks for healthcare data — use inline fixture objects.
- Each test file imports only the module under test.
- No `any` casts in test files.
- Test names describe behavior, not implementation: `"returns invalid when birthDate is missing"` not `"test validator"`.
- Core package target: all logic covered. Web components: deferred (no `@testing-library/react` in MVP).

**Running tests:**
```bash
pnpm test                          # all packages
pnpm --filter @fhirbridge/core test
```

---

## AI / Summary Code

- Section summaries use `section-summarizer.ts` — never build raw prompts inline.
- Prompt strings live in `prompt-templates.ts` only.
- Token usage must be tracked via `token-tracker.ts`.
- De-identification is mandatory — calling an AI provider directly with a raw bundle is a bug.

---

## API Route Conventions

- All routes prefixed `/api/v1/`.
- Route files register handlers and attach JSON Schema from `schemas/` directory.
- Request body types are defined as local interfaces in the route file.
- Services contain business logic — route handlers are thin.
- Auth check: `request.authUser?.id` for user identity (set by `auth-plugin.ts`).

---

## Commit Message Format

Conventional commits:

```
feat: add Excel connector with SheetJS
fix: strip valueString PHI from de-identifier
refactor: split bundle-builder into serializer module
test: add deidentifier round-trip tests
chore: upgrade Fastify to 4.x
```

No AI references in commit messages.

---

## Build Commands

```bash
pnpm build       # compile all packages (tsc)
pnpm dev         # watch mode
pnpm test        # Vitest all packages
pnpm typecheck   # tsc --noEmit all packages
pnpm lint        # ESLint
pnpm format      # Prettier
```

Turborepo caches build outputs — clean with `pnpm exec turbo run build --force`.
