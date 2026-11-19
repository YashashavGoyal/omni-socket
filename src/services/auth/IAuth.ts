export const CONNECTION_TYPE = {
  SERVER: 'server',
  CLIENT: 'client',
} as const;

export type ConnectionType = (typeof CONNECTION_TYPE)[keyof typeof CONNECTION_TYPE];

export interface ClientTokenGrants {
  allowedRooms?: string[];
  canPublish?: boolean;
  canSubscribe?: boolean;
}

export interface ClientTokenPayload {
  sub: string; // userId
  appId: string; // applicationId slug
  type: typeof CONNECTION_TYPE.CLIENT;
  grants?: ClientTokenGrants;
  metadata?: Record<string, any>;
  iat: number;
  exp: number;
}

export interface MintClientTokenInput {
  applicationId: string;
  userId: string;
  ttlSeconds?: number;
  grants?: ClientTokenGrants;
  metadata?: Record<string, any>;
}

export interface MintClientTokenResult {
  token: string;
  tokenType: 'Bearer';
  expiresAt: string;
  expiresInSeconds: number;
}

export interface AuthHandshakePayload {
  type?: ConnectionType;
  applicationId?: string;
  apiKey?: string;
  userId?: string;
  token?: string;
}

export interface AuthenticatedSocketData {
  role: ConnectionType;
  applicationId: string;
  userId?: string;
  authenticatedAt: Date;
  grants?: ClientTokenGrants;
  metadata?: Record<string, any>;
}
