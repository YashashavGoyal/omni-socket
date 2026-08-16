export interface AuthHandshakePayload {
  applicationId: string;
  apiKey: string;
  userId?: string;
  token?: string;
}

export interface AuthenticatedSocketData {
  applicationId: string;
  userId?: string;
  authenticatedAt: Date;
}
