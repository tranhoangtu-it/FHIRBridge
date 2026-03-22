/**
 * Provider gateway — orchestrates full summary generation pipeline.
 * Handles provider selection, fallback on failure, and event emission.
 * Flow: deidentify → section summaries → synthesis → return PatientSummary
 */

import { EventEmitter } from 'node:events';
import type { Bundle, SummaryConfig, PatientSummary } from '@fhirbridge/types';
import type { AiProvider } from './ai-provider-interface.js';
import { ClaudeProvider } from './claude-provider.js';
import { OpenAiProvider } from './openai-provider.js';
import { deidentify } from './deidentifier.js';
import { summarizeSections } from './section-summarizer.js';
import { synthesize } from './synthesis-engine.js';
import { TokenTracker } from './token-tracker.js';

/** Events emitted by ProviderGateway */
export interface GatewayEvents {
  'provider-switch': [from: string, to: string, reason: string];
  'rate-limited': [provider: string, retryAfterMs: number];
  'generation-complete': [summary: PatientSummary];
}

/**
 * Orchestrates the full AI summary pipeline with provider fallback.
 * Emits events for monitoring and observability.
 */
export class ProviderGateway extends EventEmitter {
  private readonly primaryProvider: AiProvider;
  private readonly fallbackProvider: AiProvider | undefined;

  constructor(config: SummaryConfig) {
    super();
    this.primaryProvider = this.createProvider(config.providerConfig);

    if (config.fallbackProviderConfig) {
      this.fallbackProvider = this.createProvider(config.fallbackProviderConfig);
    }
  }

  /**
   * Run the full summary pipeline on a FHIR Bundle.
   * De-identifies the bundle first, then generates section summaries,
   * then synthesizes into a coherent patient narrative.
   */
  async summarize(bundle: Bundle, config: SummaryConfig): Promise<PatientSummary> {
    const tracker = new TokenTracker();

    // Step 1: De-identify — MUST happen before any AI call
    const { bundle: deidentifiedBundle } = deidentify(bundle, config.hmacSecret);

    // Step 2: Try primary provider, fall back if needed
    let provider = this.primaryProvider;

    try {
      const sections = await summarizeSections(deidentifiedBundle, provider, config, tracker);
      const synthesis = await synthesize(sections, provider, config, tracker);

      const usage = tracker.getUsage();
      const summary: PatientSummary = {
        sections,
        synthesis,
        metadata: {
          generatedAt: new Date().toISOString(),
          provider: config.providerConfig.provider,
          model: provider.model,
          totalTokens: usage.totalTokens,
          language: config.language,
          deidentified: true,
        },
      };

      this.emit('generation-complete', summary);
      return summary;
    } catch (primaryErr) {
      if (!this.fallbackProvider) {
        throw primaryErr;
      }

      const reason = primaryErr instanceof Error ? primaryErr.message : 'unknown error';
      this.emit('provider-switch', provider.name, this.fallbackProvider.name, reason);
      provider = this.fallbackProvider;

      const sections = await summarizeSections(deidentifiedBundle, provider, config, tracker);
      const synthesis = await synthesize(sections, provider, config, tracker);

      const usage = tracker.getUsage();
      const fallbackConfig = config.fallbackProviderConfig!;

      const summary: PatientSummary = {
        sections,
        synthesis,
        metadata: {
          generatedAt: new Date().toISOString(),
          provider: fallbackConfig.provider,
          model: provider.model,
          totalTokens: usage.totalTokens,
          language: config.language,
          deidentified: true,
        },
      };

      this.emit('generation-complete', summary);
      return summary;
    }
  }

  private createProvider(config: SummaryConfig['providerConfig']): AiProvider {
    if (config.provider === 'claude') {
      return new ClaudeProvider(config);
    }
    if (config.provider === 'openai') {
      return new OpenAiProvider(config);
    }
    throw new Error(`ProviderGateway: unknown provider "${config.provider}"`);
  }
}
