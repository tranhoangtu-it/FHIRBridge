/**
 * Security headers plugin — đăng ký @fastify/helmet với cấu hình production-grade.
 *
 * Bảo mật C-3:
 * - Content-Security-Policy tuned cho SPA (self + data URIs)
 * - HSTS max-age 1 năm, includeSubDomains, preload
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy: strict-origin-when-cross-origin
 *
 * Webhook path (/api/v1/billing/webhook/*) được exempt khỏi CSP
 * vì Stripe không gửi CSP-compliant requests.
 */

import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import { skipOverride } from './plugin-utils.js';

/** Paths không áp dụng CSP header (payment provider webhooks) */
const CSP_EXEMPT_PREFIXES = ['/api/v1/billing/webhook/'];

async function _securityHeadersPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(helmet, {
    // Áp dụng hook theo request, cho phép exempt webhook path
    enableCSPNonces: false,

    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"], // Tailwind inline styles
        imgSrc: ["'self'", 'data:', 'blob:'],
        fontSrc: ["'self'", 'data:'],
        connectSrc: ["'self'"],
        frameSrc: ["'none'"],
        objectSrc: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },

    // HSTS: 1 năm, subdomains, sẵn sàng preload list
    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },

    // Ngăn browser MIME sniff
    noSniff: true,

    // Chặn iframe embedding
    frameguard: { action: 'deny' },

    // Referrer an toàn: chỉ gửi origin khi cross-origin
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    // Cross-Origin policies
    crossOriginEmbedderPolicy: false, // SPA cần load resources cross-origin
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });

  // Hook: bỏ CSP header cho webhook paths vì Stripe không cần/muốn nó.
  // Helmet set headers trực tiếp lên reply.raw (Node ServerResponse) qua
  // express-middleware callback, nên phải dùng reply.raw.removeHeader().
  fastify.addHook('onSend', async (request, reply) => {
    const path = request.url.split('?')[0] ?? '';
    const isWebhook = CSP_EXEMPT_PREFIXES.some((prefix) => path.startsWith(prefix));
    if (isWebhook) {
      reply.raw.removeHeader('content-security-policy');
    }
  });
}

export const securityHeadersPlugin = skipOverride(_securityHeadersPlugin);
