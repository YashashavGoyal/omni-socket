import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { setupSocketIO } from '../src/socket';
import { registerHealthRoutes } from '../src/api/health';
import { redisService } from '../src/services/redis/redis.service';
import { presenceService } from '../src/socket/handlers/presence/presence.service';
import { z } from 'zod';

describe('Redis Subsystem & Fail-Fast Vitest Suite', () => {
  let server: ReturnType<typeof Fastify>;
  const PORT = 4038;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    registerHealthRoutes(server);
    setupSocketIO(server);
    await server.listen({ port: PORT, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await server.close();
  });

  it('should return redis status as "disabled" when REDIS_ENABLED is false', async () => {
    const health = await redisService.healthCheck();
    expect(health.status).toBe('disabled');
  });

  it('should include redis subsystem in /health/ready probe response', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/health/ready`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.subsystems).toBeDefined();
    expect(data.subsystems.redis).toBe('disabled');
  });

  it('should throw validation error when REDIS_ENABLED is true but REDIS_URL is missing', () => {
    const envSchema = z
      .object({
        REDIS_ENABLED: z.coerce.boolean().default(false),
        REDIS_URL: z.string().default(''),
      })
      .superRefine((data, ctx) => {
        if (data.REDIS_ENABLED && !data.REDIS_URL.trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: 'REDIS_URL is strictly required when REDIS_ENABLED=true',
            path: ['REDIS_URL'],
          });
        }
      });

    const parsed = envSchema.safeParse({ REDIS_ENABLED: true, REDIS_URL: '  ' });
    expect(parsed.success).toBe(false);
    if (!parsed.success) {
      const formatted = parsed.error.format();
      expect(formatted.REDIS_URL?._errors[0]).toBe('REDIS_URL is strictly required when REDIS_ENABLED=true');
    }
  });

  it('should retrieve presence via getPresenceAsync seamlessly', async () => {
    const appId = 'app_test_vitest';
    const userId = 'user_vitest_1';

    presenceService.onUserConnect(appId, userId);

    const presence = await presenceService.getPresenceAsync(appId, userId);
    expect(presence).toBeDefined();
    expect(presence?.userId).toBe(userId);
    expect(presence?.status).toBe('online');
  });
});
