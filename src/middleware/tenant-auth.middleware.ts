import { FastifyRequest, FastifyReply } from 'fastify';
import { applicationService } from '../services/application/application.service';
import { UnauthorizedError, ERROR_MESSAGES } from '../shared/errors';

declare module 'fastify' {
  interface FastifyRequest {
    tenantApplicationId?: string;
  }
}

/**
 * Fastify preHandler hook to authenticate tenant REST requests via headers only.
 * Strictly requires both 'x-application-id' and 'x-api-key' headers.
 */
export async function tenantAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const applicationId = request.headers['x-application-id'] as string | undefined;
  const apiKey = request.headers['x-api-key'] as string | undefined;

  if (!applicationId || !apiKey) {
    throw new UnauthorizedError(ERROR_MESSAGES.MISSING_HANDSHAKE_AUTH);
  }

  const isValid = await applicationService.validateAppCredentials(applicationId.trim(), apiKey.trim());
  if (!isValid) {
    throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  request.tenantApplicationId = applicationId.trim();
}
