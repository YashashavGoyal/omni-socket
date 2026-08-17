import { randomBytes } from 'crypto';

export interface AuditEventPayload {
  correlationId?: string;
  applicationId?: string;
  socketId?: string;
  userId?: string;
  action: string;
  status: 'SUCCESS' | 'FAILURE' | 'BLOCKED';
  durationMs?: number;
  details?: Record<string, unknown>;
}

export class AuditLogger {
  /**
   * Generates a unique correlation ID for tracking request lifecycle.
   */
  public generateCorrelationId(): string {
    return `corr_${Date.now()}_${randomBytes(4).toString('hex')}`;
  }

  /**
   * Logs a structured audit record.
   */
  public log(event: AuditEventPayload): void {
    const auditRecord = {
      timestamp: new Date().toISOString(),
      correlationId: event.correlationId || this.generateCorrelationId(),
      applicationId: event.applicationId || 'unknown',
      socketId: event.socketId || 'N/A',
      userId: event.userId || 'anonymous',
      action: event.action,
      status: event.status,
      durationMs: event.durationMs !== undefined ? Number(event.durationMs.toFixed(2)) : undefined,
      details: event.details || {},
    };

    // Output formatted JSON audit log
    console.log(`[AUDIT] ${JSON.stringify(auditRecord)}`);
  }
}

export const auditLogger = new AuditLogger();
