import { FastifyError, FastifyReply, FastifyRequest } from 'fastify';
import { AppError } from './app-error';
import { HTTP_STATUS_CODE, ERROR_CODES } from './error.constants';
import { formatErrorResponse } from './index';

export function fastifyErrorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  // 1. Domain AppErrors (UnauthorizedError, ForbiddenError, NotFoundError, etc.)
  if (error instanceof AppError) {
    request.log.warn({ err: error }, `[DomainError] ${error.code}: ${error.message}`);
    reply.status(error.statusCode).send(formatErrorResponse(error));
    return;
  }

  // 2. Fastify Validation Errors (Zod / Schema Validation)
  if ('validation' in error && Array.isArray((error as any).validation)) {
    reply.status(HTTP_STATUS_CODE.BAD_REQUEST).send({
      status: 'error',
      code: ERROR_CODES.VALIDATION_ERROR,
      message: 'Request validation failed',
      details: { errors: (error as any).validation },
    });
    return;
  }

  // 3. Unhandled Server Errors (500 Internal Server Error)
  request.log.error({ err: error }, '[UnhandledServerError]');
  reply.status(HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR).send(formatErrorResponse(error));
}
