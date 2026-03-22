---
title: "Phase 3 — HIS Connectors"
status: pending
priority: P1
effort: 16h
owner: Dev 1
---

# Phase 3 — HIS Connectors

## Context Links
- [Plan Overview](./plan.md)
- [SMART on FHIR](https://docs.smarthealthit.org/)
- [fhirclient](https://github.com/smart-on-fhir/client-js)
- Phase dependency: [Phase 2](./phase-02-core-fhir-engine.md)

## Overview
Implement adapter-pattern HIS connectors: (1) Generic FHIR R4 endpoint via SMART on FHIR OAuth2, (2) CSV/Excel import with configurable column-to-FHIR mapping. Both produce `AsyncIterable<RawRecord>` consumed by the core pipeline.

## Priority
**P1** — Required for any data ingestion.

## Requirements

### Functional
- FHIR R4 endpoint connector with SMART on FHIR OAuth2 (standalone launch)
- Support `$everything` operation on Patient
- CSV import: parse, map columns to FHIR paths via config
- Excel import: read .xlsx sheets, same mapping logic
- Adapter interface: all connectors implement `HisConnector`
- Connection testing / health check per connector
- Pagination handling for large FHIR result sets

### Non-Functional
- Stream results — never load full CSV/Excel into memory
- Configurable timeout (default 30s per request)
- Retry with exponential backoff (3 attempts)
- <200 LOC per file

## Architecture

```
@fhirbridge/core/connectors/
├── his-connector-interface.ts   # HisConnector interface
├── fhir-endpoint-connector.ts   # SMART on FHIR R4 client
├── csv-connector.ts             # CSV file parser + mapper
├── excel-connector.ts           # XLSX parser + mapper
├── column-mapper.ts             # Config-driven column→FHIR mapping
├── retry-handler.ts             # Exponential backoff utility
└── index.ts

@fhirbridge/types/connectors/
├── connector-config.ts          # ConnectorConfig, FhirEndpointConfig, FileImportConfig
├── mapping-config.ts            # ColumnMapping, CodeMapping
└── index.ts
```

### Connector Interface
```typescript
interface HisConnector {
  readonly type: 'fhir-endpoint' | 'csv' | 'excel';
  connect(config: ConnectorConfig): Promise<void>;
  testConnection(): Promise<ConnectionStatus>;
  fetchPatientData(patientId: string): AsyncIterable<RawRecord>;
  disconnect(): Promise<void>;
}
```

### Data Flow
```
FHIR Endpoint                    CSV/Excel File
     │                                │
     ▼                                ▼
fhir-endpoint-connector          csv-connector / excel-connector
     │                                │
     ▼                                ▼
  FHIR Resources                 column-mapper
     │                                │
     ▼                                ▼
  AsyncIterable<RawRecord>  →  Transform Pipeline (Phase 2)
```

## Related Code Files

### Files to Create — @fhirbridge/types
- `packages/types/src/connectors/connector-config.ts` — `ConnectorConfig`, `FhirEndpointConfig { baseUrl, clientId, clientSecret, scope, tokenEndpoint }`, `FileImportConfig { filePath, sheetName?, mapping }`
- `packages/types/src/connectors/mapping-config.ts` — `ColumnMapping { sourceColumn: string; fhirPath: string; codeSystem?: string; transform?: 'date' | 'code' | 'string' | 'number' }`, `CodeMapping { sourceValue: string; system: string; code: string; display: string }`
- `packages/types/src/connectors/index.ts`

### Files to Create — @fhirbridge/core
- `packages/core/src/connectors/his-connector-interface.ts` — `HisConnector` interface, `ConnectionStatus`, `RawRecord` type
- `packages/core/src/connectors/fhir-endpoint-connector.ts` — SMART on FHIR client using `fhirclient`
- `packages/core/src/connectors/csv-connector.ts` — CSV parser using `csv-parse` (streaming)
- `packages/core/src/connectors/excel-connector.ts` — XLSX parser using `xlsx` package
- `packages/core/src/connectors/column-mapper.ts` — Map CSV/Excel columns to FHIR resources
- `packages/core/src/connectors/retry-handler.ts` — `withRetry<T>(fn, maxRetries, baseDelay): Promise<T>`
- `packages/core/src/connectors/index.ts`

### Test Files
- `packages/core/src/connectors/__tests__/fhir-endpoint-connector.test.ts` — test against HAPI FHIR public server
- `packages/core/src/connectors/__tests__/csv-connector.test.ts` — test with sample CSV fixtures
- `packages/core/src/connectors/__tests__/excel-connector.test.ts` — test with sample XLSX fixtures
- `packages/core/src/connectors/__tests__/column-mapper.test.ts` — mapping config tests
- `tests/fixtures/csv/sample-patients.csv`
- `tests/fixtures/csv/sample-observations.csv`
- `tests/fixtures/excel/sample-patient-data.xlsx`
- `tests/fixtures/csv/mapping-config.json` — sample column mapping

## Implementation Steps

1. **Define connector types** (`packages/types/src/connectors/`)
   - `FhirEndpointConfig`: baseUrl, clientId, clientSecret, scope (e.g., `patient/*.read`), tokenEndpoint, redirectUri
   - `FileImportConfig`: filePath, sheetName (for Excel), delimiter (for CSV), headerRow, mapping: ColumnMapping[]
   - `ColumnMapping`: sourceColumn, fhirPath, resourceType, codeSystem?, transform?, valueMappings?: CodeMapping[]
   - `CodeMapping`: sourceValue → { system, code, display } for coded fields

2. **Define HisConnector interface** (`his-connector-interface.ts`)
   - `connect(config)`: establish connection / validate file
   - `testConnection()`: return `{ connected: boolean; serverVersion?: string; error?: string }`
   - `fetchPatientData(patientId)`: AsyncGenerator yielding RawRecord
   - `disconnect()`: cleanup resources
   - `RawRecord = { resourceType: string; data: Record<string, unknown>; source: string }`

3. **Implement retry handler** (`retry-handler.ts`)
   - Exponential backoff: `baseDelay * 2^attempt` (100ms, 200ms, 400ms)
   - Max 3 retries by default
   - Retry on: network errors, 429, 5xx
   - Do NOT retry: 401, 403, 404, 4xx

4. **Implement FHIR endpoint connector** (`fhir-endpoint-connector.ts`)
   - Use `fhirclient` for SMART OAuth2 token exchange
   - `fetchPatientData`: call `Patient/{id}/$everything` with `_count=100`
   - Handle pagination via `Bundle.link` with `relation: 'next'`
   - Yield each resource in Bundle.entry as RawRecord
   - Apply retry handler on each HTTP request
   - Respect `Retry-After` header

5. **Implement CSV connector** (`csv-connector.ts`)
   - Use `csv-parse` with streaming API
   - `connect()`: validate file exists, detect delimiter, read headers
   - `fetchPatientData(patientId)`: filter rows by patient identifier column
   - Yield rows as `RawRecord` with column values
   - Handle encoding: UTF-8, UTF-16, shift-JIS (for Japan market)

6. **Implement Excel connector** (`excel-connector.ts`)
   - Use `xlsx` package (SheetJS)
   - `connect()`: read workbook, validate sheet exists
   - `fetchPatientData(patientId)`: iterate rows, filter by patient column
   - Convert cell types: dates, numbers, strings
   - Yield as RawRecord

7. **Implement column mapper** (`column-mapper.ts`)
   - `mapRow(row: Record<string, unknown>, mappings: ColumnMapping[]): MappedRecord[]`
   - Group mappings by resourceType → produce one RawRecord per resource type
   - Apply transforms: `date` (parse various formats → ISO 8601), `code` (lookup CodeMapping), `number` (parse + validate), `string` (trim)
   - Code system resolution: when mapping has `codeSystem`, wrap value in CodeableConcept with system URI
   - Handle multi-value columns (pipe-delimited, comma-delimited)

8. **Create test fixtures**
   - `sample-patients.csv`: 5 patients with name, DOB, gender, address, phone
   - `sample-observations.csv`: vital signs (BP, HR, temp) with LOINC codes
   - `sample-patient-data.xlsx`: combined patient + encounters + conditions
   - `mapping-config.json`: example mapping from CSV columns to FHIR paths

9. **Integration tests**
   - Test FHIR connector against public HAPI FHIR server (http://hapi.fhir.org/baseR4)
   - Test CSV connector with sample fixtures → verify RawRecord output
   - Test Excel connector with .xlsx fixtures
   - Test column mapper with various transforms
   - Test full pipeline: CSV → mapper → transformer → validator → bundle

## Todo List
- [ ] Connector config types
- [ ] Column mapping types with code mappings
- [ ] HisConnector interface
- [ ] Retry handler with exponential backoff
- [ ] FHIR R4 endpoint connector (SMART OAuth2)
- [ ] Patient/$everything with pagination
- [ ] CSV connector (streaming, multi-encoding)
- [ ] Excel connector
- [ ] Column mapper (transform + code resolution)
- [ ] Test fixtures (CSV, Excel, mapping config)
- [ ] FHIR endpoint integration test
- [ ] CSV connector unit tests
- [ ] Excel connector unit tests
- [ ] Column mapper unit tests
- [ ] End-to-end: CSV → FHIR Bundle test

## Success Criteria
- FHIR connector fetches patient data from HAPI FHIR public server
- CSV with 10K rows streams without memory spike (RSS <100MB)
- Column mapper correctly maps to all 8 FHIR resource types
- Japanese CSV (shift-JIS encoded) parses correctly
- All connectors implement HisConnector interface identically

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| SMART OAuth2 complexity | High | Start with public endpoints (no auth), add OAuth later |
| CSV encoding detection | Medium | Use `chardet` for auto-detection, default UTF-8 |
| Excel large files | Medium | Stream rows, don't load full workbook |
| HAPI FHIR public server downtime | Low | Cache test responses in fixtures for CI |

## Security Considerations
- OAuth2 tokens stored only in memory, never logged
- File paths validated against directory traversal
- CSV/Excel content never logged (may contain PHI)
- Connection configs support TLS client certificates

## File Ownership
```
packages/types/src/connectors/** → Dev 1
packages/core/src/connectors/**  → Dev 1
tests/fixtures/csv/**            → Dev 1 (create), Dev 3 (maintain)
tests/fixtures/excel/**          → Dev 1 (create), Dev 3 (maintain)
```
