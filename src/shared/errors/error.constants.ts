export const HTTP_STATUS_CODE = {
  OK: 200,
  CREATED: 201,
  ACCEPTED: 202,
  NO_CONTENT: 204,

  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  UNPROCESSABLE_ENTITY: 422,
  TOO_MANY_REQUESTS: 429,

  INTERNAL_SERVER_ERROR: 500,
  NOT_IMPLEMENTED: 501,
  BAD_GATEWAY: 502,
  SERVICE_UNAVAILABLE: 503
} as const;

export type HttpStatusCode = (typeof HTTP_STATUS_CODE)[keyof typeof HTTP_STATUS_CODE];


export const ERROR_CODES = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  TOO_MANY_REQUESTS: 'TOO_MANY_REQUESTS',
  INTERNAL_SERVER_ERROR: 'INTERNAL_SERVER_ERROR',
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];


export const ERROR_MESSAGES = {
  MISSING_HANDSHAKE_AUTH: 'Missing authentication credentials in handshake.auth',
  INVALID_CONNECTION_TYPE: "Missing or invalid connection type in handshake.auth (must be 'server' or 'client')",
  INVALID_CLIENT_HANDSHAKE: 'Client connection requires token and must not include apiKey or applicationId',
  INVALID_SERVER_HANDSHAKE: 'Server connection requires applicationId, apiKey, and userId, and must not include token',
  MISSING_TOKEN: 'Missing client connection token in handshake.auth',
  INVALID_OR_EXPIRED_TOKEN: 'Authentication failed: Invalid or expired client connection token',
  INVALID_CREDENTIALS: 'Authentication failed: Invalid application credentials',
  UNAUTHORIZED_ACCESS: 'Authentication required to perform this action',
  FORBIDDEN_RESOURCE: 'Access denied: You do not have permission for this resource',
  TOKEN_ROOM_FORBIDDEN: 'Access denied: Token grants do not permit joining this room',
  TOKEN_PUBLISH_FORBIDDEN: 'Access denied: Token grants do not permit publishing',
  APPLICATION_NOT_FOUND: 'Application not found',
  RESOURCE_NOT_FOUND: 'The requested resource was not found',
  RATE_LIMIT_EXCEEDED: 'Rate limit exceeded. Please try again later',
  DATABASE_NOT_CONNECTED: 'Database connection is not configured or available',
  INTERNAL_SERVER_ERROR: 'An unexpected internal server error occurred',
  INVALID_APP_NAME: 'Application name must contain at least one alphanumeric character',
} as const;
