export interface ConnectionContext {
    socketId: string;
    userId?: string;
    connectedAt: Date;
    metadata?: Record<string, unknown>;
}
