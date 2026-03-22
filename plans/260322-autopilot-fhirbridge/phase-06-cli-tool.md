---
title: "Phase 6 — CLI Tool"
status: completed
priority: P2
effort: 10h
owner: Dev 2
---

# Phase 6 — CLI Tool

## Context Links
- [Plan Overview](./plan.md)
- [Commander.js](https://github.com/tj/commander.js)
- Phase dependency: [Phase 2](./phase-02-core-fhir-engine.md)

## Overview
CLI tool (`fhirbridge`) for local patient data export. Supports FHIR endpoint fetch, CSV/Excel import, bundle generation, and AI summary — all from terminal. Interactive prompts for configuration, progress bars for long operations.

## Priority
**P2** — Developer/power-user interface. Can ship after core engine.

## Requirements

### Functional
- `fhirbridge export` — export patient data from FHIR endpoint
- `fhirbridge import` — import from CSV/Excel file
- `fhirbridge summarize` — generate AI summary from bundle
- `fhirbridge validate` — validate a FHIR bundle file
- `fhirbridge config` — manage connection profiles
- Interactive mode: prompt for missing args
- Progress bar for long operations
- Output to file or stdout
- JSON and table output formats

### Non-Functional
- Single binary-like distribution via `npx @fhirbridge/cli`
- Startup time <500ms
- Colored output with chalk
- Configurable via `.fhirbridgerc.json` or env vars

## Architecture

```
@fhirbridge/cli/
├── src/
│   ├── index.ts                 # Entry: Commander program setup
│   ├── commands/
│   │   ├── export-command.ts    # fhirbridge export
│   │   ├── import-command.ts    # fhirbridge import
│   │   ├── summarize-command.ts # fhirbridge summarize
│   │   ├── validate-command.ts  # fhirbridge validate
│   │   └── config-command.ts    # fhirbridge config
│   ├── prompts/
│   │   ├── export-prompts.ts    # Interactive export config
│   │   ├── import-prompts.ts    # File selection + mapping
│   │   └── provider-prompts.ts  # AI provider selection
│   ├── formatters/
│   │   ├── table-formatter.ts   # CLI table output
│   │   ├── json-formatter.ts    # Pretty JSON output
│   │   └── progress-display.ts  # Progress bar wrapper
│   ├── config/
│   │   ├── config-manager.ts    # Read/write .fhirbridgerc.json
│   │   └── profile-store.ts     # Connection profiles CRUD
│   └── utils/
│       ├── file-writer.ts       # Write output to file
│       └── logger.ts            # Colored console output
```

## Related Code Files

### Files to Create
- `packages/cli/src/index.ts` — Commander program, register all commands, version, help
- `packages/cli/src/commands/export-command.ts` — `program.command('export')` with options: --patient-id, --endpoint, --profile, --output, --format
- `packages/cli/src/commands/import-command.ts` — `program.command('import')` with options: --file, --mapping, --output, --format
- `packages/cli/src/commands/summarize-command.ts` — `program.command('summarize')` with options: --input, --provider, --language, --output, --format
- `packages/cli/src/commands/validate-command.ts` — `program.command('validate')` with options: --input
- `packages/cli/src/commands/config-command.ts` — subcommands: set, get, list, add-profile, remove-profile
- `packages/cli/src/prompts/export-prompts.ts` — inquirer prompts for endpoint URL, patient ID, auth
- `packages/cli/src/prompts/import-prompts.ts` — file picker, sheet selection, column mapping
- `packages/cli/src/prompts/provider-prompts.ts` — AI provider, model, language, detail level
- `packages/cli/src/formatters/table-formatter.ts` — `formatTable(data, columns): string`
- `packages/cli/src/formatters/json-formatter.ts` — `formatJson(data, pretty?): string`
- `packages/cli/src/formatters/progress-display.ts` — `createProgressBar(total, label): ProgressBar`
- `packages/cli/src/config/config-manager.ts` — read/write `~/.fhirbridgerc.json`
- `packages/cli/src/config/profile-store.ts` — CRUD for named connection profiles
- `packages/cli/src/utils/file-writer.ts` — `writeOutput(data, path?, format?)`
- `packages/cli/src/utils/logger.ts` — `info()`, `success()`, `warn()`, `error()` with chalk colors
- `packages/cli/bin/fhirbridge.js` — `#!/usr/bin/env node` shebang entry

### Test Files
- `packages/cli/src/commands/__tests__/export-command.test.ts`
- `packages/cli/src/commands/__tests__/import-command.test.ts`
- `packages/cli/src/commands/__tests__/validate-command.test.ts`
- `packages/cli/src/config/__tests__/config-manager.test.ts`

## Implementation Steps

1. **Setup Commander program** (`index.ts`)
   ```typescript
   const program = new Command()
     .name('fhirbridge')
     .description('FHIR R4 Patient Data Export Tool')
     .version(packageJson.version);
   ```
   - Register commands: export, import, summarize, validate, config
   - Global options: `--verbose`, `--quiet`, `--no-color`

2. **Export command** (`export-command.ts`)
   - Options: `--patient-id <id>`, `--endpoint <url>`, `--profile <name>`, `--output <path>`, `--format <json|ndjson>`, `--include-summary`, `--summary-provider <claude|openai>`
   - If missing args → trigger interactive prompts
   - Flow: load profile → create FHIR connector → fetch data → pipeline → bundle → write output
   - Show progress: connecting → fetching (X resources) → validating → building bundle → writing
   - Display summary: resource counts by type, total size, output path

3. **Import command** (`import-command.ts`)
   - Options: `--file <path>`, `--mapping <path>`, `--output <path>`, `--format <json|ndjson>`
   - If no mapping → interactive column mapping wizard
   - Flow: open file → detect type (CSV/Excel) → apply mapping → pipeline → bundle → write
   - Progress bar: rows processed / total rows

4. **Summarize command** (`summarize-command.ts`)
   - Options: `--input <bundle.json>`, `--provider <claude|openai>`, `--language <en|vi|ja>`, `--detail <brief|standard|detailed>`, `--output <path>`, `--format <pdf|markdown|composition>`
   - Flow: read bundle → deidentify → AI summarize → format → write
   - Show: section progress, token usage, estimated cost

5. **Validate command** (`validate-command.ts`)
   - Options: `--input <bundle.json>`
   - Load bundle → validate each resource → report
   - Table output: resource type, id, valid/invalid, error messages
   - Exit code: 0 if valid, 1 if errors

6. **Config command** (`config-command.ts`)
   - `config set <key> <value>` — set default config
   - `config get <key>` — read config value
   - `config list` — show all config
   - `config add-profile <name>` — interactive profile creation (endpoint, auth)
   - `config remove-profile <name>` — delete profile
   - Store in `~/.fhirbridgerc.json`

7. **Interactive prompts** (`prompts/`)
   - Use `@inquirer/prompts` (modular inquirer)
   - Export: input → select profile or enter new endpoint → patient ID → output format
   - Import: file path → auto-detect type → sheet selection (Excel) → column mapping wizard
   - Provider: select provider → model → language → detail level

8. **Formatters** (`formatters/`)
   - Table: use `cli-table3` for aligned columns
   - JSON: `JSON.stringify(data, null, 2)` with syntax highlighting via `chalk`
   - Progress: use `cli-progress` with ETA, percentage, resource count

9. **Config manager** (`config/`)
   - Read/write `~/.fhirbridgerc.json`
   - Schema: `{ defaultProvider, defaultLanguage, profiles: { [name]: ConnectorConfig } }`
   - Profile store: CRUD operations on profiles
   - Sensitive fields (API keys): warn about plaintext storage, suggest env vars

10. **Write tests**
    - Test command parsing with various arg combinations
    - Test config manager read/write
    - Test validate command with valid + invalid bundles
    - Test formatters output

## Todo List
- [x] Commander program setup with global options
- [x] Export command with FHIR endpoint fetch
- [x] Import command with CSV/Excel support
- [x] Summarize command with AI provider selection
- [x] Validate command with table output
- [x] Config command with profile management
- [x] Interactive prompts (export, import, provider)
- [x] Table + JSON + Progress formatters
- [x] Config manager (.fhirbridgerc.json)
- [x] Logger with colored output
- [x] File writer utility
- [x] bin/fhirbridge.js entry point
- [x] Command tests
- [x] Config manager tests

## Success Criteria
- `fhirbridge export --patient-id 123 --endpoint http://hapi.fhir.org/baseR4 --output bundle.json` produces valid bundle
- `fhirbridge import --file patients.csv --mapping mapping.json --output bundle.json` works
- `fhirbridge validate --input bundle.json` reports all validation errors
- Interactive mode fills missing args via prompts
- Progress bars show during long operations
- Config profiles persist across sessions

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| inquirer compatibility with CI | Low | Detect non-TTY → require all args |
| Large file import memory | Medium | Stream processing from core |
| API key storage in config | Medium | Warn user, recommend env vars |

## Security Considerations
- API keys in config file: warn about plaintext, suggest `FHIRBRIDGE_API_KEY` env var
- File paths validated against traversal
- No PHI written to logs (--verbose shows progress, not data)
- Config file permissions: warn if world-readable

## File Ownership
```
packages/cli/src/**  → Dev 2
packages/cli/bin/**  → Dev 2
```
