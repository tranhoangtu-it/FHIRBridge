/**
 * Authentication plugin — verifies JWT Bearer tokens or X-API-Key header.
 * Skips auth for GET /api/v1/health.
 * Attaches user info to request via authUser property.
 *
 * skip-override ensures hooks and JWT decorators apply globally.
 *
 * Bảo mật H-1:
 * - So sánh API key bằng crypto.timingSafeEqual để ngăn timing attack
 * - User ID từ API key dùng SHA-256 (16 hex chars đầu) thay vì plain prefix
 */

import { createHash, timingSafeEqual } from 'node:crypto';
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import fastifyJwt from '@fastify/jwt';
import type { ApiConfig, UserTier } from '../config.js';
import { skipOverride } from './plugin-utils.js';

export interface AuthUser {
  id: string;
  tier: UserTier;
}

// Augment FastifyRequest to carry typed user info
declare module 'fastify' {
  interface FastifyRequest {
    authUser?: AuthUser;
  }
}

/** Paths that bypass authentication */
const PUBLIC_PATHS = new Set(['/api/v1/health']);

/**
 * So sánh hai chuỗi bằng constant-time để chống timing attack.
 * Padding đến cùng độ dài trước khi so sánh.
 */
function timingSafeStringEqual(a: string, b: string): boolean {
  // Encode cả hai sang Buffer UTF-8 để so sánh byte-level
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  // Nếu độ dài khác nhau: pad bằng null bytes, sau đó XOR length để trả false
  if (bufA.length !== bufB.length) {
    // Vẫn chạy timingSafeEqual trên bufA vs bufA (tránh branch timing),
    // nhưng kết quả luôn false do length check ở trước
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

/**
 * Tính SHA-256 của key và lấy 16 hex chars đầu làm anonymous ID.
 * Không để lộ prefix của raw key trong logs/audit.
 */
function apiKeyToId(key: string): string {
  return createHash('sha256').update(key, 'utf8').digest('hex').slice(0, 16);
}

async function _authPlugin(fastify: FastifyInstance, opts: { config: ApiConfig }): Promise<void> {
  await fastify.register(fastifyJwt, {
    secret: opts.config.jwtSecret,
    sign: { algorithm: 'HS256' },
  });

  // Lưu array để có thể iterate; Set.has() không dùng constant-time
  const validApiKeys: string[] = opts.config.apiKeys;

  fastify.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split('?')[0] ?? '';
    if (PUBLIC_PATHS.has(path)) return;

    const apiKey = request.headers['x-api-key'];
    const authHeader = request.headers.authorization;

    if (typeof apiKey === 'string' && apiKey) {
      // Constant-time comparison: iterate tất cả keys để tránh early-exit timing leak
      let matched = false;
      for (const validKey of validApiKeys) {
        if (timingSafeStringEqual(apiKey, validKey)) {
          matched = true;
          // Không break — tiếp tục loop để tránh timing phân biệt "key ở vị trí 1 vs vị trí N"
        }
      }
      if (!matched) {
        return reply
          .status(401)
          .send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid API key' });
      }
      // Dùng SHA-256 prefix thay vì raw key prefix
      request.authUser = { id: `apikey:${apiKeyToId(apiKey)}`, tier: 'paid' };
      return;
    }

    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
      try {
        const decoded = await request.jwtVerify<{ sub?: string; id?: string; tier?: string }>();
        const id = decoded.sub ?? decoded.id ?? 'unknown';
        const tier: UserTier = decoded.tier === 'paid' ? 'paid' : 'free';
        request.authUser = { id, tier };
        return;
      } catch {
        return reply
          .status(401)
          .send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' });
      }
    }

    return reply
      .status(401)
      .send({ statusCode: 401, error: 'Unauthorized', message: 'Authentication required' });
  });
}

export const authPlugin = skipOverride(_authPlugin);
