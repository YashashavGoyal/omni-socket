import { AppError } from './app-error';
import { ERROR_CODES, ERROR_MESSAGES } from './error.constants';

export * from './error.constants';
export * from './app-error';
export * from './domain-errors';
export * from './fastify-error.handler';

export function formatErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return error.toJSON();
  }

  return {
    status: 'error',
    code: ERROR_CODES.INTERNAL_SERVER_ERROR,
    message: error instanceof Error ? error.message : ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
  };
}
