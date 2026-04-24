/**
 * Barrel export for core billing module.
 */

// Plan logic
export { PLANS, getPlan, canExport, canUseSummary, calculateOverageCost } from './plan-manager.js';

// Usage tracking
export {
  InMemoryUsageTracker,
  recordExport,
  recordSummary,
  getUsage,
  resetPeriod,
  currentPeriod,
} from './usage-tracker.js';
export type { IUsageTracker } from './usage-tracker.js';

// Provider interface
export type { PaymentProviderAdapter, WebhookEvent } from './payment-provider-interface.js';

// Concrete providers
export { StripeProvider } from './stripe-provider.js';
export { SepayProvider } from './sepay-provider.js';
