/**
 * Section summarizer — groups FHIR resources by type and generates per-section summaries.
 * Operates only on de-identified bundles. Never receives PHI.
 */

import type { DeidentifiedBundle, SectionSummary, SummaryConfig } from '@fhirbridge/types';
import type { AiProvider } from './ai-provider-interface.js';
import type { TokenTracker } from './token-tracker.js';
import type { SectionName } from './prompt-templates.js';
import { getSectionPrompt } from './prompt-templates.js';

/** FHIR resourceType → section name mapping */
const RESOURCE_TYPE_TO_SECTION: Record<string, SectionName> = {
  Condition: 'Conditions',
  MedicationRequest: 'Medications',
  MedicationStatement: 'Medications',
  AllergyIntolerance: 'Allergies',
  Observation: 'Observations',
  Procedure: 'Procedures',
  Encounter: 'Encounters',
  DiagnosticReport: 'DiagnosticReports',
  Patient: 'Demographics',
};

/** Observation category codes for vital signs */
const VITAL_SIGNS_CATEGORY_CODES = new Set(['vital-signs', 'VSCat']);

/** Determine whether an Observation is a vital sign or lab result */
function isVitalSign(resource: Record<string, unknown>): boolean {
  const category = resource['category'];
  if (!Array.isArray(category)) return false;
  return category.some((cat: unknown) => {
    if (typeof cat !== 'object' || cat === null) return false;
    const coding = (cat as Record<string, unknown>)['coding'];
    if (!Array.isArray(coding)) return false;
    return coding.some((c: unknown) => {
      if (typeof c !== 'object' || c === null) return false;
      const code = (c as Record<string, unknown>)['code'];
      return typeof code === 'string' && VITAL_SIGNS_CATEGORY_CODES.has(code);
    });
  });
}

/**
 * Group bundle entries by section name.
 * Returns a map of section name → array of resource objects.
 */
function groupResourcesBySection(
  bundle: DeidentifiedBundle,
): Map<SectionName, Record<string, unknown>[]> {
  const groups = new Map<SectionName, Record<string, unknown>[]>();

  for (const entry of bundle.entry ?? []) {
    const resource = entry.resource as Record<string, unknown> | undefined;
    if (!resource) continue;

    const resourceType = resource['resourceType'] as string | undefined;
    if (!resourceType) continue;

    let section = RESOURCE_TYPE_TO_SECTION[resourceType];
    if (!section) continue;

    // Split Observations into Vitals and Labs
    if (section === 'Observations' && isVitalSign(resource)) {
      section = 'Vitals';
    }

    const existing = groups.get(section) ?? [];
    existing.push(resource);
    groups.set(section, existing);
  }

  return groups;
}

/**
 * Summarize a single section using the AI provider.
 */
async function summarizeSection(
  section: SectionName,
  resources: Record<string, unknown>[],
  provider: AiProvider,
  config: SummaryConfig,
  tracker: TokenTracker,
): Promise<SectionSummary> {
  if (resources.length === 0) {
    return {
      section,
      content: 'No data available for this section.',
      tokenCount: 0,
      resourceCount: 0,
    };
  }

  const resourceData = JSON.stringify(resources, null, 2);
  const { systemPrompt, userPrompt } = getSectionPrompt(section, {
    language: config.language,
    detailLevel: config.detailLevel,
    resourceData,
  });

  const response = await provider.generate(userPrompt, {
    maxTokens: config.providerConfig.maxTokens,
    temperature: config.providerConfig.temperature,
    systemPrompt,
    timeoutMs: config.providerConfig.timeoutMs,
  });

  tracker.track(
    config.providerConfig.provider,
    provider.model,
    section,
    response.tokenUsage.inputTokens,
    response.tokenUsage.outputTokens,
  );

  return {
    section,
    content: response.content,
    tokenCount: response.tokenUsage.totalTokens,
    resourceCount: resources.length,
  };
}

/**
 * Generate summaries for all resource sections in the de-identified bundle.
 * Processes sections sequentially to respect rate limits.
 * Empty sections produce a "No data available" placeholder.
 */
export async function summarizeSections(
  bundle: DeidentifiedBundle,
  provider: AiProvider,
  config: SummaryConfig,
  tracker: TokenTracker,
): Promise<SectionSummary[]> {
  const groups = groupResourcesBySection(bundle);

  // Process all sections that have data, plus standard empty sections
  const allSections: SectionName[] = [
    'Demographics',
    'Conditions',
    'Medications',
    'Allergies',
    'Vitals',
    'Observations',
    'Procedures',
    'Encounters',
    'DiagnosticReports',
  ];

  const results: SectionSummary[] = [];

  for (const section of allSections) {
    const resources = groups.get(section) ?? [];
    const summary = await summarizeSection(section, resources, provider, config, tracker);
    results.push(summary);
  }

  return results;
}
