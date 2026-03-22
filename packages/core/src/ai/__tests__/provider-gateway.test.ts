/**
 * Provider gateway tests.
 * Verifies pipeline orchestration, fallback behavior, and event emission.
 * Uses module mocking to inject stub providers without real AI calls.
 */

import { describe, it, expect, vi } from 'vitest';
import type { AiProvider } from '../ai-provider-interface.js';
import type { AiResponse, GenerateOptions } from '@fhirbridge/types';

// Build deterministic stub responses
function makeStubResponse(content: string): AiResponse {
  return {
    content,
    tokenUsage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    model: 'stub',
    finishReason: 'stop',
  };
}

/** A stub provider that always succeeds */
function makeStubProvider(name: string, response: string): AiProvider {
  return {
    name,
    model: 'stub-model',
    async generate(_prompt: string, _options: GenerateOptions): Promise<AiResponse> {
      return makeStubResponse(response);
    },
    async isAvailable(): Promise<boolean> {
      return true;
    },
  };
}

/** A stub provider that always throws */
function makeFailingProvider(name: string, message = 'provider error'): AiProvider {
  return {
    name,
    model: 'stub-model',
    async generate(): Promise<AiResponse> {
      throw new Error(message);
    },
    async isAvailable(): Promise<boolean> {
      return false;
    },
  };
}

// Mock both provider classes so ProviderGateway uses our stubs
let primaryStub: AiProvider = makeStubProvider('claude', 'section content');
let fallbackStub: AiProvider = makeStubProvider('openai', 'fallback content');

vi.mock('../claude-provider.js', () => ({
  ClaudeProvider: vi.fn().mockImplementation(() => primaryStub),
  CLAUDE_DEFAULT_MODEL: 'claude-sonnet-4-20250514',
}));

vi.mock('../openai-provider.js', () => ({
  OpenAiProvider: vi.fn().mockImplementation(() => fallbackStub),
  OPENAI_DEFAULT_MODEL: 'gpt-4o',
}));

// Import gateway AFTER mocks are set up
import { ProviderGateway } from '../provider-gateway.js';

const BASE_PROVIDER_CONFIG = {
  provider: 'claude' as const,
  model: 'claude-test',
  apiKey: 'key',
  maxTokens: 512,
  temperature: 0.2,
};

const FALLBACK_PROVIDER_CONFIG = {
  provider: 'openai' as const,
  model: 'gpt-test',
  apiKey: 'key',
  maxTokens: 512,
  temperature: 0.2,
};

const BASE_SUMMARY_CONFIG = {
  language: 'en' as const,
  detailLevel: 'standard' as const,
  outputFormats: ['markdown' as const],
  providerConfig: BASE_PROVIDER_CONFIG,
  hmacSecret: 'test-secret-32-chars-long-padded!',
};

/** Minimal FHIR bundle for testing */
const MINIMAL_BUNDLE = {
  resourceType: 'Bundle' as const,
  type: 'collection' as const,
  entry: [
    {
      resource: {
        resourceType: 'Condition',
        id: 'cond-1',
        subject: { reference: 'Patient/p1' },
        code: { coding: [{ system: 'http://snomed.info/sct', code: '73211009' }] },
      },
    },
  ],
};

describe('ProviderGateway', () => {
  describe('summarize() pipeline', () => {
    it('returns a PatientSummary with sections and synthesis', async () => {
      primaryStub = makeStubProvider('claude', 'stub summary content');
      const gateway = new ProviderGateway(BASE_SUMMARY_CONFIG);

      const result = await gateway.summarize(MINIMAL_BUNDLE, BASE_SUMMARY_CONFIG);

      expect(result).toHaveProperty('sections');
      expect(result).toHaveProperty('synthesis');
      expect(result).toHaveProperty('metadata');
      expect(Array.isArray(result.sections)).toBe(true);
      expect(result.sections.length).toBeGreaterThan(0);
      expect(typeof result.synthesis).toBe('string');
    });

    it('sets deidentified flag to true in metadata', async () => {
      primaryStub = makeStubProvider('claude', 'stub summary content');
      const gateway = new ProviderGateway(BASE_SUMMARY_CONFIG);

      const result = await gateway.summarize(MINIMAL_BUNDLE, BASE_SUMMARY_CONFIG);
      expect(result.metadata.deidentified).toBe(true);
    });

    it('sets metadata provider from config', async () => {
      primaryStub = makeStubProvider('claude', 'stub summary content');
      const gateway = new ProviderGateway(BASE_SUMMARY_CONFIG);

      const result = await gateway.summarize(MINIMAL_BUNDLE, BASE_SUMMARY_CONFIG);
      expect(result.metadata.provider).toBe('claude');
    });

    it('emits generation-complete event on success', async () => {
      primaryStub = makeStubProvider('claude', 'stub summary content');
      const gateway = new ProviderGateway(BASE_SUMMARY_CONFIG);

      const completedSummaries: unknown[] = [];
      gateway.on('generation-complete', (summary) => completedSummaries.push(summary));

      await gateway.summarize(MINIMAL_BUNDLE, BASE_SUMMARY_CONFIG);
      expect(completedSummaries).toHaveLength(1);
    });
  });

  describe('fallback behavior', () => {
    it('uses fallback provider when primary fails', async () => {
      primaryStub = makeFailingProvider('claude', 'primary error');
      fallbackStub = makeStubProvider('openai', 'fallback response');

      const configWithFallback = {
        ...BASE_SUMMARY_CONFIG,
        fallbackProviderConfig: FALLBACK_PROVIDER_CONFIG,
      };

      const gateway = new ProviderGateway(configWithFallback);
      const result = await gateway.summarize(MINIMAL_BUNDLE, configWithFallback);

      // Should succeed via fallback
      expect(result).toHaveProperty('synthesis');
      expect(result.metadata.provider).toBe('openai');
    });

    it('emits provider-switch event on fallback', async () => {
      primaryStub = makeFailingProvider('claude', 'rate limit');
      fallbackStub = makeStubProvider('openai', 'fallback');

      const configWithFallback = {
        ...BASE_SUMMARY_CONFIG,
        fallbackProviderConfig: FALLBACK_PROVIDER_CONFIG,
      };

      const gateway = new ProviderGateway(configWithFallback);

      const switchEvents: Array<[string, string, string]> = [];
      gateway.on('provider-switch', (from, to, reason) => switchEvents.push([from, to, reason]));

      await gateway.summarize(MINIMAL_BUNDLE, configWithFallback);

      expect(switchEvents).toHaveLength(1);
      expect(switchEvents[0][0]).toBe('claude');
      expect(switchEvents[0][1]).toBe('openai');
      expect(switchEvents[0][2]).toContain('rate limit');
    });

    it('throws when primary fails and no fallback configured', async () => {
      primaryStub = makeFailingProvider('claude', 'fatal error');

      const gateway = new ProviderGateway(BASE_SUMMARY_CONFIG);
      await expect(gateway.summarize(MINIMAL_BUNDLE, BASE_SUMMARY_CONFIG)).rejects.toThrow(
        'fatal error',
      );
    });
  });
});
