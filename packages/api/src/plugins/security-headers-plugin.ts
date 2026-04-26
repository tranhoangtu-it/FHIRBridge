/**
 * Security headers plugin — đăng ký @fastify/helmet với cấu hình production-grade.
 *
 * Bảo mật C-3:
 * - Content-Security-Policy tuned cho SPA (self + data URIs)
 * - HSTS max-age 1 năm, includeSubDomains, preload
 * - X-Content-Type-Options: nosniff
 * - X-Frame-Options: DENY
 * - Referrer-Policy: strict-origin-when-cross-origin
 */

import helmet from '@fastify/helmet';
import type { FastifyInstance } from 'fastify';
import { skipOverride } from './plugin-utils.js';

async function _securityHeadersPlugin(fastify: FastifyInstance): Promise<void> {
  await fastify.register(helmet, {
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

    hsts: {
      maxAge: 31_536_000,
      includeSubDomains: true,
      preload: true,
    },

    noSniff: true,
    frameguard: { action: 'deny' },
    referrerPolicy: { policy: 'strict-origin-when-cross-origin' },

    crossOriginEmbedderPolicy: false, // SPA cần load resources cross-origin
    crossOriginOpenerPolicy: { policy: 'same-origin-allow-popups' },
    crossOriginResourcePolicy: { policy: 'cross-origin' },
  });
}

export const securityHeadersPlugin = skipOverride(_securityHeadersPlugin);
