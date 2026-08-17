import { AppError } from './app-error';
import { HTTP_STATUS_CODE, ERROR_CODES, ERROR_MESSAGES } from './error.constants';

export class UnauthorizedError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.UNAUTHORIZED_ACCESS,
    details?: Record<string, unknown>
  ) {
    super(message, HTTP_STATUS_CODE.UNAUTHORIZED, ERROR_CODES.UNAUTHORIZED, details);
  }
}

export class ForbiddenError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.FORBIDDEN_RESOURCE,
    details?: Record<string, unknown>
  ) {
    super(message, HTTP_STATUS_CODE.FORBIDDEN, ERROR_CODES.FORBIDDEN, details);
  }
}

export class NotFoundError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.RESOURCE_NOT_FOUND,
    details?: Record<string, unknown>
  ) {
    super(message, HTTP_STATUS_CODE.NOT_FOUND, ERROR_CODES.NOT_FOUND, details);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, HTTP_STATUS_CODE.BAD_REQUEST, ERROR_CODES.VALIDATION_ERROR, details);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, HTTP_STATUS_CODE.CONFLICT, ERROR_CODES.CONFLICT, details);
  }
}

export class TooManyRequestsError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.RATE_LIMIT_EXCEEDED,
    details?: Record<string, unknown>
  ) {
    super(message, HTTP_STATUS_CODE.TOO_MANY_REQUESTS, ERROR_CODES.TOO_MANY_REQUESTS, details);
  }
}

export class InternalServerError extends AppError {
  constructor(
    message: string = ERROR_MESSAGES.INTERNAL_SERVER_ERROR,
    details?: Record<string, unknown>
  ) {
    super(message, HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR, ERROR_CODES.INTERNAL_SERVER_ERROR, details);
  }
}
