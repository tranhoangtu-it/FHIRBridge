/**
 * AI provider interface.
 * All provider adapters (Claude, OpenAI, etc.) must implement this interface.
 * This enables provider-agnostic summary generation and easy fallback switching.
 */

import type { AiResponse, GenerateOptions } from '@fhirbridge/types';

/**
 * Common interface for all AI provider adapters.
 * Implementations must never log prompt content or responses — only token counts.
 */
export interface AiProvider {
  /** Provider display name (e.g. 'claude', 'openai') */
  readonly name: string;

  /** Model identifier being used */
  readonly model: string;

  /**
   * Generate a completion from a user prompt.
   * @param prompt - The user message (de-identified content only)
   * @param options - Generation parameters (tokens, temperature, system prompt)
   * @returns AiResponse with content and token usage
   * @throws Error on API failure after retries
   */
  generate(prompt: string, options: GenerateOptions): Promise<AiResponse>;

  /**
   * Check whether this provider is reachable and the API key is valid.
   * Used by the gateway for health checks before switching providers.
   */
  isAvailable(): Promise<boolean>;
}
