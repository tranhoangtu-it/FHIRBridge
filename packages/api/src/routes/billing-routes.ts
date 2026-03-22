/**
 * Billing routes:
 *   GET  /api/v1/billing/usage           — current usage for authenticated user
 *   GET  /api/v1/billing/plans           — list available plans
 *   POST /api/v1/billing/subscribe       — create subscription (redirect to provider)
 *   POST /api/v1/billing/webhook/:provider — handle payment webhooks (no auth)
 */

import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { getPlan, PLANS, StripeProvider, SepayProvider } from '@fhirbridge/core';
import type { PaymentProvider } from '@fhirbridge/types';
import type { AuthUser } from '../plugins/auth-plugin.js';
import { BillingService } from '../services/billing-service.js';
import {
  getBillingUsageSchema,
  getBillingPlansSchema,
  postBillingSubscribeSchema,
} from '../schemas/billing-schemas.js';

interface SubscribeBody {
  provider: PaymentProvider;
}

interface ProviderParams {
  provider: string;
}

const billingService = new BillingService();

/** Return authenticated user from request, or throw 401 */
function requireAuth(request: FastifyRequest, reply: FastifyReply): AuthUser | null {
  const user = request.authUser;
  if (!user) {
    void reply
      .status(401)
      .send({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' });
    return null;
  }
  return user;
}

/** Build a provider instance from environment variables */
function buildProvider(providerName: PaymentProvider): StripeProvider | SepayProvider {
  if (providerName === 'stripe') {
    const key = process.env['STRIPE_SECRET_KEY'];
    const webhookSecret = process.env['STRIPE_WEBHOOK_SECRET'];
    if (!key || !webhookSecret) {
      throw new Error('STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET must be set');
    }
    return new StripeProvider(key, webhookSecret);
  }

  const key = process.env['SEPAY_API_KEY'];
  if (!key) throw new Error('SEPAY_API_KEY must be set');
  return new SepayProvider(key);
}

export async function billingRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /api/v1/billing/usage
  fastify.get(
    '/api/v1/billing/usage',
    { schema: getBillingUsageSchema },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const user = requireAuth(request, reply);
      if (!user) return;

      const usage = billingService.getUsageSummary(user.id);
      return reply.send(usage);
    },
  );

  // GET /api/v1/billing/plans
  fastify.get(
    '/api/v1/billing/plans',
    { schema: getBillingPlansSchema },
    async (_request: FastifyRequest, reply: FastifyReply) => {
      const plans = Object.values(PLANS);
      return reply.send(plans);
    },
  );

  // POST /api/v1/billing/subscribe
  fastify.post<{ Body: SubscribeBody }>(
    '/api/v1/billing/subscribe',
    { schema: postBillingSubscribeSchema },
    async (request: FastifyRequest<{ Body: SubscribeBody }>, reply: FastifyReply) => {
      const user = requireAuth(request, reply);
      if (!user) return;

      const { provider: providerName } = request.body;
      const plan = getPlan('paid');

      let provider: StripeProvider | SepayProvider;
      try {
        provider = buildProvider(providerName);
      } catch (err) {
        return reply.status(503).send({
          statusCode: 503,
          error: 'Service Unavailable',
          message: String(err),
        });
      }

      const intent = await provider.createSubscription(user.id, plan);
      return reply.send({
        intentId: intent.id,
        checkoutUrl: intent.metadata['checkoutUrl'] ?? '',
        provider: intent.provider,
        status: intent.status,
      });
    },
  );

  // POST /api/v1/billing/webhook/:provider — no authentication (provider calls this)
  fastify.post<{ Params: ProviderParams }>(
    '/api/v1/billing/webhook/:provider',
    async (request: FastifyRequest<{ Params: ProviderParams }>, reply: FastifyReply) => {
      const providerName = request.params.provider as PaymentProvider;
      const signature =
        (request.headers['stripe-signature'] as string | undefined) ??
        (request.headers['x-sepay-signature'] as string | undefined) ??
        '';

      let provider: StripeProvider | SepayProvider;
      try {
        provider = buildProvider(providerName);
      } catch {
        return reply
          .status(400)
          .send({ statusCode: 400, error: 'Bad Request', message: 'Unknown provider' });
      }

      try {
        const event = await provider.handleWebhook(
          (request as FastifyRequest<{ Params: ProviderParams }> & { rawBody?: Buffer }).rawBody ??
            request.body,
          signature,
        );
        fastify.log.info({ event }, 'billing webhook received');
        return reply.status(200).send({ received: true });
      } catch (err) {
        fastify.log.warn({ err }, 'billing webhook signature verification failed');
        return reply
          .status(400)
          .send({ statusCode: 400, error: 'Bad Request', message: 'Invalid signature' });
      }
    },
  );
}
