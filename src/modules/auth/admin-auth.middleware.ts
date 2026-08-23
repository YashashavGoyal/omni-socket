import { FastifyRequest, FastifyReply } from 'fastify';
import { config } from '../../config/env';
import { UnauthorizedError } from '../../shared/errors';

export async function adminAuthMiddleware(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const headerKey = request.headers['x-admin-key'] as string | undefined;
  const authHeader = request.headers['authorization'] as string | undefined;
  let bearerKey: string | undefined;

  if (authHeader && authHeader.startsWith('Bearer ')) {
    bearerKey = authHeader.substring(7).trim();
  }

  const providedKey = headerKey || bearerKey;

  if (!providedKey || providedKey !== config.ADMIN_API_KEY) {
    throw new UnauthorizedError('Unauthorized: Invalid or missing Master Admin Key');
  }
}
