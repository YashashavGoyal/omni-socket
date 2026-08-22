export interface AckEnvelope<T = any> {
  status: 'success' | 'error';
  code?: string;
  message?: string;
  data?: T;
  timestamp: string;
}

export type AckCallback<T = any> = (response: AckEnvelope<T>) => void;

export class AckResponseFormatter {
  public static success<T>(data?: T, message?: string): AckEnvelope<T> {
    return {
      status: 'success',
      ...(message && { message }),
      ...(data !== undefined && { data }),
      timestamp: new Date().toISOString(),
    };
  }

  public static error(code: string, message: string, data?: any): AckEnvelope {
    return {
      status: 'error',
      code,
      message,
      ...(data !== undefined && { data }),
      timestamp: new Date().toISOString(),
    };
  }

  public static sendAck<T>(ack: AckCallback<T> | undefined, envelope: AckEnvelope<T>): void {
    if (typeof ack === 'function') {
      try {
        ack(envelope);
      } catch (err) {
        // Suppress client ACK execution errors
      }
    }
  }
}
