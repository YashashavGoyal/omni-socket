import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { tokenService } from '../../services/auth/token.service';
import { tenantAuthMiddleware } from '../../middleware';
import { ValidationError } from '../../shared/errors';

const mintTokenBodySchema = z.object({
  userId: z.string().min(1, { message: 'userId must be a non-empty string' }).max(256),
  ttlSeconds: z.number().int().min(10).max(86400).optional(),
  grants: z
    .object({
      allowedRooms: z.array(z.string().min(1)).optional(),
      canPublish: z.boolean().optional(),
      canSubscribe: z.boolean().optional(),
    })
    .optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export function registerAuthRoutes(server: FastifyInstance): void {
  /**
   * POST /api/v1/auth/tokens
   * Allows tenant backends to mint short-lived client connection tokens.
   * Authentication is strictly performed in headers via tenantAuthMiddleware:
   *   - x-application-id: <applicationId>
   *   - x-api-key: <apiKey>
   */
  server.post(
    '/api/v1/auth/tokens',
    { preHandler: [tenantAuthMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = mintTokenBodySchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError(
          parseResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join(', ')
        );
      }

      const body = parseResult.data;
      const applicationId = request.tenantApplicationId!;

      const tokenResult = tokenService.mintClientToken({
        applicationId,
        userId: body.userId,
        ttlSeconds: body.ttlSeconds,
        grants: body.grants,
        metadata: body.metadata,
      });

      return reply.status(201).send({
        status: 'success',
        data: tokenResult,
      });
    }
  );
}
