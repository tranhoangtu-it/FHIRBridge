---
title: "Phase 4 — AI Summary Engine"
status: complete
priority: P1
effort: 20h
owner: Dev 1
---

# Phase 4 — AI Summary Engine

## Context Links
- [Plan Overview](./plan.md)
- [Anthropic SDK](https://docs.anthropic.com/en/api)
- [OpenAI SDK](https://platform.openai.com/docs/api-reference)
- Phase dependency: [Phase 2](./phase-02-core-fhir-engine.md)

## Overview
Provider-agnostic AI summary engine. Two-step "summarize-then-prompt": section summaries per resource type → synthesis into patient summary. De-identify PHI before AI calls (HMAC-SHA256 identifiers, date shifting). Output: PDF, Markdown, FHIR Composition resource.

## Priority
**P1** — Core differentiator feature.

## Requirements

### Functional
- Provider gateway: adapter pattern for Claude + OpenAI
- De-identification pipeline: hash identifiers, shift dates, strip names
- Two-step summary: (1) per-section summaries, (2) synthesized patient narrative
- Output formats: PDF (via Puppeteer), Markdown, FHIR Composition resource
- Configurable: provider, model, language (English, Vietnamese, Japanese), detail level
- Token usage tracking for billing ($5/export tier)
- Graceful fallback if primary provider unavailable

### Non-Functional
- De-identification happens BEFORE any data leaves process
- AI calls use only de-identified data — never raw PHI
- Timeout: 60s per AI call, 5min total for full summary
- Token budget: configurable max tokens per section + synthesis

## Architecture

```
@fhirbridge/core/ai/
├── ai-provider-interface.ts     # AiProvider interface
├── claude-provider.ts           # Anthropic Claude adapter
├── openai-provider.ts           # OpenAI adapter
├── provider-gateway.ts          # Provider selection + fallback
├── deidentifier.ts              # PHI de-identification
├── section-summarizer.ts        # Per-resource-type summaries
├── synthesis-engine.ts          # Final patient narrative
├── prompt-templates.ts          # Structured prompts per section
├── summary-formatter.ts         # Output: MD, PDF, Composition
├── token-tracker.ts             # Token usage accounting
└── index.ts
```

### Two-Step Flow
```
FHIR Bundle
  │
  ▼
deidentifier (HMAC-SHA256 names/IDs, shift dates ±30 days)
  │
  ▼
section-summarizer
  ├── Conditions summary
  ├── Medications summary
  ├── Allergies summary
  ├── Observations (vitals + labs) summary
  ├── Procedures summary
  ├── Encounters summary
  └── Diagnostic Reports summary
  │
  ▼
synthesis-engine (combine sections → patient narrative)
  │
  ▼
summary-formatter
  ├── Markdown output
  ├── PDF output (Puppeteer)
  └── FHIR Composition resource
```

## Related Code Files

### Files to Create — @fhirbridge/types
- `packages/types/src/ai/ai-config.ts` — `AiProviderConfig { provider: 'claude' | 'openai'; model: string; apiKey: string; maxTokens: number }`, `SummaryConfig { language, detailLevel, outputFormats[], provider }`
- `packages/types/src/ai/summary-types.ts` — `SectionSummary { section: string; content: string; tokenCount: number }`, `PatientSummary { sections: SectionSummary[]; synthesis: string; metadata: SummaryMetadata }`
- `packages/types/src/ai/index.ts`

### Files to Create — @fhirbridge/core
- `packages/core/src/ai/ai-provider-interface.ts` — `AiProvider { generate(prompt, options): Promise<AiResponse> }`
- `packages/core/src/ai/claude-provider.ts` — Anthropic SDK adapter
- `packages/core/src/ai/openai-provider.ts` — OpenAI SDK adapter
- `packages/core/src/ai/provider-gateway.ts` — `ProviderGateway { summarize(bundle, config): Promise<PatientSummary> }`
- `packages/core/src/ai/deidentifier.ts` — `deidentify(bundle, secret): DeidentifiedBundle`, `reidentifyDates(summary, shiftMap)`
- `packages/core/src/ai/section-summarizer.ts` — `summarizeSections(deidentifiedBundle, provider): Promise<SectionSummary[]>`
- `packages/core/src/ai/synthesis-engine.ts` — `synthesize(sections, provider, config): Promise<string>`
- `packages/core/src/ai/prompt-templates.ts` — structured prompts per section type + synthesis
- `packages/core/src/ai/summary-formatter.ts` — `formatMarkdown()`, `formatPdf()`, `formatComposition()`
- `packages/core/src/ai/token-tracker.ts` — `TokenTracker { track(provider, input, output), getUsage(): TokenUsage }`
- `packages/core/src/ai/index.ts`

### Test Files
- `packages/core/src/ai/__tests__/deidentifier.test.ts`
- `packages/core/src/ai/__tests__/section-summarizer.test.ts`
- `packages/core/src/ai/__tests__/synthesis-engine.test.ts`
- `packages/core/src/ai/__tests__/prompt-templates.test.ts`
- `packages/core/src/ai/__tests__/summary-formatter.test.ts`

## Implementation Steps

1. **Define AI types** (`packages/types/src/ai/`)
   - `AiProviderConfig`: provider enum, model string, apiKey, maxTokens, temperature
   - `SummaryConfig`: language ('en' | 'vi' | 'ja'), detailLevel ('brief' | 'standard' | 'detailed'), outputFormats ('markdown' | 'pdf' | 'composition')[], providerConfig
   - `AiResponse`: content, tokenUsage { inputTokens, outputTokens }, model, finishReason
   - `SectionSummary`: section name, content string, tokenCount, resourceCount
   - `PatientSummary`: sections[], synthesis, metadata { generatedAt, provider, model, totalTokens, language }

2. **Implement AiProvider interface** (`ai-provider-interface.ts`)
   ```typescript
   interface AiProvider {
     readonly name: string;
     generate(prompt: string, options: GenerateOptions): Promise<AiResponse>;
     isAvailable(): Promise<boolean>;
   }
   type GenerateOptions = { maxTokens: number; temperature: number; systemPrompt?: string };
   ```

3. **Implement Claude provider** (`claude-provider.ts`)
   - Use `@anthropic-ai/sdk`
   - Map to `messages.create()` API
   - Default model: `claude-sonnet-4-20250514`
   - Handle rate limits with retry (429 + Retry-After)
   - Track input/output tokens from response

4. **Implement OpenAI provider** (`openai-provider.ts`)
   - Use `openai` package
   - Map to `chat.completions.create()` API
   - Default model: `gpt-4o`
   - Handle rate limits with retry
   - Track token usage from response.usage

5. **Implement provider gateway** (`provider-gateway.ts`)
   - Accept config with primary + fallback provider
   - Try primary, if fails after 3 retries → switch to fallback
   - Emit events: `provider-switch`, `rate-limited`, `generation-complete`
   - `summarize(bundle, config)`: orchestrate full deidentify → sections → synthesis flow

6. **Implement de-identifier** (`deidentifier.ts`) **CRITICAL FOR PRIVACY**
   - `deidentify(bundle: Bundle, hmacSecret: string): { bundle: DeidentifiedBundle; shiftMap: DateShiftMap }`
   - Hash all identifiers: `HMAC-SHA256(identifier, secret)` → truncated hex
   - Replace patient names with `[PATIENT]`, practitioner names with `[PROVIDER]`
   - Shift all dates by random offset (±30 days), consistent per patient
   - Strip address details (keep only city/state for geographic context)
   - Remove phone numbers, emails, SSNs
   - Preserve: medical codes (LOINC, SNOMED), observation values, medication dosages
   - `reidentifyDates(text, shiftMap)`: restore original dates in final output

7. **Build prompt templates** (`prompt-templates.ts`)
   - Per-section prompts: structured input format + expected output
   - Example for Conditions:
     ```
     Summarize the following medical conditions for a patient record export.
     Focus on: active conditions, severity, onset dates, clinical significance.
     Language: {language}. Detail level: {detailLevel}.
     Conditions: {deidentifiedConditions}
     ```
   - Synthesis prompt: combine section summaries into coherent narrative
   - Language-specific instructions for Vietnamese and Japanese

8. **Build section summarizer** (`section-summarizer.ts`)
   - Group resources by type from deidentified bundle
   - Generate prompt per section using templates
   - Call AI provider for each section (parallel where possible)
   - Collect SectionSummary results with token counts
   - Sections: Demographics, Conditions, Medications, Allergies, Vitals & Labs, Procedures, Encounters, Diagnostic Reports

9. **Build synthesis engine** (`synthesis-engine.ts`)
   - Input: all SectionSummary results
   - Prompt: combine into patient-friendly narrative
   - Include: key concerns, medication list, allergy warnings, recent visits
   - Output: single coherent summary string
   - Re-identify dates in final output using shiftMap

10. **Build summary formatter** (`summary-formatter.ts`)
    - `formatMarkdown(summary: PatientSummary): string` — structured MD with headers per section
    - `formatPdf(summary: PatientSummary): Promise<Buffer>` — use Puppeteer to render MD→HTML→PDF
    - `formatComposition(summary: PatientSummary, patientRef: string): FhirComposition` — FHIR Composition resource with sections

11. **Build token tracker** (`token-tracker.ts`)
    - Track per-request: provider, model, inputTokens, outputTokens
    - Calculate estimated cost per provider's pricing
    - Expose `getUsage()` for billing integration
    - Emit warning when approaching token budget

12. **Write tests**
    - Deidentifier: verify ALL PHI stripped, dates shifted, codes preserved
    - Section summarizer: test with Synthea data, verify section coverage
    - Prompt templates: verify language switching, detail levels
    - Summary formatter: MD output structure, Composition resource validity
    - Token tracker: accumulation, budget warnings

## Todo List
- [x] AI config + summary types
- [x] AiProvider interface
- [x] Claude provider adapter
- [x] OpenAI provider adapter
- [x] Provider gateway with fallback
- [x] De-identifier (HMAC-SHA256 + date shift) **PRIVACY CRITICAL**
- [x] Prompt templates (EN/VI/JA, 3 detail levels)
- [x] Section summarizer (8 sections)
- [x] Synthesis engine
- [x] Markdown formatter
- [ ] PDF formatter (Puppeteer) — TODO deferred, stub with comment in summary-formatter.ts
- [x] FHIR Composition formatter
- [x] Token tracker
- [x] Deidentifier tests (PHI removal verification)
- [ ] Section summarizer tests — deferred (requires mocked AI provider)
- [x] Formatter tests
- [x] Token tracker tests
- [ ] Integration test: Synthea → deidentify → summarize → format — deferred (requires real/mock API)

## Success Criteria
- De-identifier removes 100% of PHI (names, IDs, addresses, contacts)
- AI receives ONLY de-identified data — verified by test
- Summary generated in <30s for typical patient (50 resources)
- PDF output renders correctly with sections
- FHIR Composition validates against R4 spec
- Provider fallback works when primary returns 429
- Vietnamese and Japanese summaries generate correctly

## Risk Assessment
| Risk | Impact | Mitigation |
|------|--------|------------|
| De-identification misses PHI | Critical | Whitelist approach — only pass known-safe fields to AI |
| AI hallucination in medical context | High | Include disclaimer, cross-ref with source data |
| Token costs unpredictable | Medium | Hard token budget per request, track usage |
| Puppeteer PDF rendering issues | Low | Fallback to markdown-pdf if Puppeteer fails |
| Multilingual prompt quality | Medium | Native speaker review for VI/JA prompts |

## Security Considerations
- HMAC secret stored in env var, never in code
- De-identified data exists only in memory during AI call
- AI provider API keys: env vars only, never logged
- PDF output includes "AI-generated summary" watermark/disclaimer
- Token tracker logs counts only, never prompt content

## File Ownership
```
packages/types/src/ai/**  → Dev 1
packages/core/src/ai/**   → Dev 1
```
