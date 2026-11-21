import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../config/env';
import { UnauthorizedError } from '../shared/errors';

/**
 * Safely extracts a single trimmed string from a header value (handles string, array, or undefined).
 */
function extractHeaderString(val: string | string[] | undefined): string | undefined {
  if (Array.isArray(val)) return val[0]?.trim() || undefined;
  if (typeof val === 'string') return val.trim() || undefined;
  return undefined;
}

export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const providedKey = extractHeaderString(request.headers['x-admin-key']);

  if (!providedKey || providedKey !== config.ADMIN_API_KEY) {
    throw new UnauthorizedError('Unauthorized: Invalid or missing Master Admin Key');
  }
}
