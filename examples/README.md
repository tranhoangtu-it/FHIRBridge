# Examples

Drop-in starter assets for self-host operators.

## Column-mapping configs

`column-mappings/` — JSON files for `CsvConnector` / `ExcelConnector` to map an HIS export's column names onto FHIR R4 fields. Pick the one closest to your HIS, then edit columns to match your actual export schema.

| File                                                                               | Source                                                               | Use when                                                                    |
| ---------------------------------------------------------------------------------- | -------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| [column-mappings/csv-vneid-vn.json](column-mappings/csv-vneid-vn.json)             | Vietnamese hospital CSV (VneID-style identifiers, ICD-10 dx codes)   | Vietnamese hospital exports a flat CSV one row per encounter                |
| [column-mappings/csv-generic-hl7.json](column-mappings/csv-generic-hl7.json)       | Generic HL7-flavored CSV with `MRN`, `DOB`, `ICD10`, `LOINC` columns | Hospital exports follow standard HL7 column conventions                     |
| [column-mappings/excel-japan-clinic.json](column-mappings/excel-japan-clinic.json) | Japanese small-clinic Excel sheet (Kanji headers + ICD-10)           | JP outpatient clinic uses an `.xlsx` with two sheets (Patients, Encounters) |

### How to apply

```bash
# Via CLI
fhirbridge import --file ./patients.csv --mapping ./examples/column-mappings/csv-vneid-vn.json --output ./out.bundle.json

# Via API
curl -X POST http://localhost:3001/api/v1/connectors/import \
  -H "Authorization: Bearer $JWT" \
  -F "file=@./patients.csv" \
  -F "mapping=@./examples/column-mappings/csv-vneid-vn.json"
```

The `mapping` payload is read by `CsvConnector` / `ExcelConnector`. Each entry maps a raw column → a FHIR resource path. Unknown columns are dropped silently; missing columns produce a `connector.error` audit entry.

## Synthetic test data

`tests/fixtures/synthea/` (in the test tree, not here) ships pre-generated synthetic FHIR Bundles that exercise every supported resource type. They contain no real PHI. Use them to smoke-test an end-to-end export → summary flow without touching a real HIS.

## Contributing examples

If your HIS export differs from these and you want others to benefit, open a PR adding a new `column-mappings/<vendor>.json` file. Anonymize column names in your sample so the file does not leak vendor-specific schema details that you do not own. See [CONTRIBUTING.md](../CONTRIBUTING.md).
