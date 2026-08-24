export interface ConnectionContext {
  socketId: string;
  userId?: string;
  applicationId?: string;
  connectedAt: Date;
  metadata?: Record<string, unknown>;
}
