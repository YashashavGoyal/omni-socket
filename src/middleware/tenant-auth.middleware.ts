import { FastifyRequest, FastifyReply } from 'fastify';
import { applicationService } from '../services/application/application.service';
import { UnauthorizedError, ERROR_MESSAGES } from '../shared/errors';

declare module 'fastify' {
  interface FastifyRequest {
    tenantApplicationId?: string;
  }
}

/**
 * Safely extracts a single trimmed string from a header value (handles string, array, or undefined).
 */
function extractHeaderString(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0]?.trim() || undefined;
  if (typeof val === 'string') return val.trim() || undefined;
  return undefined;
}

/**
 * Fastify preHandler hook to authenticate tenant REST requests via headers only.
 * Strictly requires both 'x-application-id' and 'x-api-key' headers.
 */
export async function tenantAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const applicationId = extractHeaderString(request.headers['x-application-id']);
  const apiKey = extractHeaderString(request.headers['x-api-key']);

  if (!applicationId || !apiKey) {
    throw new UnauthorizedError(ERROR_MESSAGES.MISSING_HANDSHAKE_AUTH);
  }

  const isValid = await applicationService.validateAppCredentials(applicationId, apiKey);
  if (!isValid) {
    throw new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS);
  }

  request.tenantApplicationId = applicationId;
}
