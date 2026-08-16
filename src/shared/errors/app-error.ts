import { HttpStatusCode, ErrorCode, HTTP_STATUS_CODE, ERROR_CODES } from './error.constants';

export class AppError extends Error {
  constructor(
    message: string,
    public readonly statusCode: HttpStatusCode = HTTP_STATUS_CODE.INTERNAL_SERVER_ERROR,
    public readonly code: ErrorCode = ERROR_CODES.INTERNAL_SERVER_ERROR,
    public readonly details?: Record<string, unknown>
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }

  public toJSON() {
    return {
      status: 'error',
      code: this.code,
      message: this.message,
      ...(this.details && { details: this.details }),
    };
  }
}
