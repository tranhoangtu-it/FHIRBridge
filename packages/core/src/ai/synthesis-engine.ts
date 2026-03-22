/**
 * Synthesis engine — combines section summaries into a coherent patient narrative.
 * This is the final AI call in the two-step summary pipeline.
 * Operates only on de-identified section summaries.
 */

import type { SectionSummary, SummaryConfig } from '@fhirbridge/types';
import type { AiProvider } from './ai-provider-interface.js';
import type { TokenTracker } from './token-tracker.js';
import { getSynthesisPrompt } from './prompt-templates.js';

/** Synthesis section label in token tracker */
const SYNTHESIS_SECTION = 'synthesis';

/**
 * Combine section summaries into a unified patient narrative.
 * Filters out empty sections before synthesis.
 *
 * @param sections - De-identified section summaries from section-summarizer
 * @param provider - AI provider to use for synthesis
 * @param config - Summary configuration
 * @param tracker - Token tracker for billing
 * @returns Synthesized narrative string
 */
export async function synthesize(
  sections: SectionSummary[],
  provider: AiProvider,
  config: SummaryConfig,
  tracker: TokenTracker,
): Promise<string> {
  // Only include sections with meaningful content
  const meaningfulSections = sections.filter(
    (s) =>
      s.content.trim().length > 0 &&
      !s.content.includes('No data available'),
  );

  if (meaningfulSections.length === 0) {
    return 'Insufficient data available to generate a patient summary.';
  }

  const { systemPrompt, userPrompt } = getSynthesisPrompt(
    meaningfulSections.map((s) => ({ section: s.section, content: s.content })),
    {
      language: config.language,
      detailLevel: config.detailLevel,
    },
  );

  const response = await provider.generate(userPrompt, {
    maxTokens: config.providerConfig.maxTokens,
    temperature: config.providerConfig.temperature,
    systemPrompt,
    timeoutMs: config.providerConfig.timeoutMs,
  });

  tracker.track(
    config.providerConfig.provider,
    provider.model,
    SYNTHESIS_SECTION,
    response.tokenUsage.inputTokens,
    response.tokenUsage.outputTokens,
  );

  return response.content;
}
