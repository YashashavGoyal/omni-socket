import { io, Socket } from 'socket.io-client';

export interface AckEnvelope<T = any> {
  status: 'success' | 'error';
  code?: string;
  message?: string;
  data?: T;
  timestamp: string;
}

export type EventTargetType = 'room' | 'user' | 'socket' | 'application';

export const CONNECTION_TYPE = {
  SERVER: 'server',
  CLIENT: 'client',
} as const;

export type ConnectionType = (typeof CONNECTION_TYPE)[keyof typeof CONNECTION_TYPE];

export interface OmniSocketBaseOptions {
  url: string;
  autoHeartbeat?: boolean;
  heartbeatIntervalMs?: number;
  transports?: string[];
}

export interface OmniSocketServerOptions extends OmniSocketBaseOptions {
  type?: typeof CONNECTION_TYPE.SERVER;
  applicationId: string;
  apiKey: string;
  userId?: string;
}

export interface OmniSocketClientTokenOptions extends OmniSocketBaseOptions {
  type?: typeof CONNECTION_TYPE.CLIENT;
  token?: string;
  tokenProvider?: () => Promise<string> | string;
  userId?: string;
  applicationId?: string;
}

export type OmniSocketClientOptions = OmniSocketServerOptions | OmniSocketClientTokenOptions;

export interface PresenceUser {
  userId: string;
  applicationId: string;
  status: string;
  customStatusMessage?: string;
  activeSocketsCount: number;
  lastSeenAt: string;
}

export class OmniSocketClient {
  private socket: Socket | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private currentToken: string | null = null;

  constructor(private options: OmniSocketClientOptions) {
    if ('token' in options && options.token) {
      this.currentToken = options.token;
    }
  }

  /**
   * Helper to resolve the active application ID.
   */
  public getApplicationId(): string {
    if ('applicationId' in this.options && this.options.applicationId) {
      return this.options.applicationId;
    }
    const token = this.currentToken || ('token' in this.options ? this.options.token : undefined);
    if (token) {
      try {
        const parts = token.split('.');
        if (parts.length === 3) {
          const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
          const payloadJson =
            typeof atob === 'function'
              ? atob(base64)
              : typeof (globalThis as any).Buffer !== 'undefined'
              ? (globalThis as any).Buffer.from(base64, 'base64').toString('utf8')
              : '';

          if (payloadJson) {
            const payload = JSON.parse(payloadJson);
            if (payload?.appId) return payload.appId;
          }
        }
      } catch {}
    }
    return '';
  }

  /**
   * Connect to the OmniSocket real-time engine with auth credentials (server key or client token).
   */
  public async connect(): Promise<void> {
    const isClientMode =
      'token' in this.options ||
      'tokenProvider' in this.options ||
      ('type' in this.options && this.options.type === CONNECTION_TYPE.CLIENT);

    const resolveAuthPayload = async (): Promise<Record<string, any>> => {
      if (isClientMode) {
        const clientOpts = this.options as OmniSocketClientTokenOptions;
        let token = clientOpts.token;
        if (clientOpts.tokenProvider) {
          token = await clientOpts.tokenProvider();
        }
        if (token) {
          this.currentToken = token;
        }
        return {
          type: CONNECTION_TYPE.CLIENT,
          token,
          ...(clientOpts.userId ? { userId: clientOpts.userId } : {}),
        };
      } else {
        const serverOpts = this.options as OmniSocketServerOptions;
        return {
          type: CONNECTION_TYPE.SERVER,
          applicationId: serverOpts.applicationId,
          apiKey: serverOpts.apiKey,
          ...(serverOpts.userId ? { userId: serverOpts.userId } : {}),
        };
      }
    };

    return new Promise(async (resolve, reject) => {
      try {
        // Resolve initial auth payload to validate tokenProvider early
        await resolveAuthPayload();
      } catch (err) {
        return reject(err);
      }

      this.socket = io(this.options.url, {
        transports: this.options.transports || ['websocket'],
        auth: (cb) => {
          resolveAuthPayload()
            .then((payload) => cb(payload))
            .catch(() => cb({}));
        },
      });

      this.socket.on('connect', () => {
        if (this.options.autoHeartbeat !== false) {
          this.startHeartbeatTimer();
        }
        resolve();
      });

      this.socket.on('connect_error', (err) => {
        reject(err);
      });
    });
  }

  /**
   * Get underlying Socket.IO instance
   */
  public getSocket(): Socket | null {
    return this.socket;
  }

  /**
   * Check connection status
   */
  public isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /**
   * Join a room within your application space
   */
  public joinRoom(roomId: string): Promise<AckEnvelope> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('OmniSocketClient is not connected'));
      this.socket.emit('room:join', { roomId }, (response: AckEnvelope) => {
        if (response.status === 'error') {
          reject(new Error(response.message || 'Failed to join room'));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Leave a room
   */
  public leaveRoom(roomId: string): Promise<AckEnvelope> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('OmniSocketClient is not connected'));
      this.socket.emit('room:leave', { roomId }, (response: AckEnvelope) => {
        if (response.status === 'error') {
          reject(new Error(response.message || 'Failed to leave room'));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Broadcast an event to members in a room
   */
  public broadcastToRoom(roomId: string, event: string, data: any, includeSelf = false): Promise<AckEnvelope> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('OmniSocketClient is not connected'));
      this.socket.emit('room:broadcast', { roomId, event, data, includeSelf }, (response: AckEnvelope) => {
        if (response.status === 'error') {
          reject(new Error(response.message || 'Failed to broadcast to room'));
        } else {
          resolve(response);
        }
      });
    });
  }

  /**
   * Emit a generic custom event routed by target (room, user, socket, or application)
   */
  public emitCustomEvent(
    targetType: EventTargetType,
    targetId: string,
    eventName: string,
    payload: any,
    includeSelf = false
  ): Promise<AckEnvelope> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('OmniSocketClient is not connected'));
      this.socket.emit(
        'event:emit',
        { targetType, targetId, eventName, payload, includeSelf },
        (response: AckEnvelope) => {
          if (response.status === 'error') {
            reject(new Error(response.message || `Failed to emit event ${eventName}`));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Direct helper to emit a custom event to a specific user
   */
  public emitToUser(targetUserId: string, eventName: string, payload: any): Promise<AckEnvelope> {
    return this.emitCustomEvent('user', targetUserId, eventName, payload);
  }

  /**
   * Direct helper to emit a custom event to the entire application space
   */
  public emitToApp(eventName: string, payload: any, applicationId?: string): Promise<AckEnvelope> {
    const targetAppId = applicationId || this.getApplicationId();
    return this.emitCustomEvent('application', targetAppId, eventName, payload);
  }

  /**
   * Listen for events emitted to room, user, or app socket
   */
  public on<T = any>(event: string, callback: (data: T) => void): void {
    if (!this.socket) return;
    this.socket.on(event, callback);
  }

  /**
   * Remove listener for an event
   */
  public off(event: string, callback?: (...args: any[]) => void): void {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  /**
   * Update presence status (e.g. online, busy, away)
   */
  public updatePresence(roomId: string, status: string, customStatusMessage?: string): Promise<AckEnvelope> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('OmniSocketClient is not connected'));
      this.socket.emit(
        'presence:update',
        { roomId, status, customStatusMessage },
        (response: AckEnvelope) => {
          if (response.status === 'error') {
            reject(new Error(response.message || 'Failed to update presence'));
          } else {
            resolve(response);
          }
        }
      );
    });
  }

  /**
   * Listen for room presence updates
   */
  public onPresenceChange(callback: (presence: PresenceUser) => void): void {
    this.on('presence:changed', callback);
  }

  /**
   * Send presence ping heartbeat
   */
  public ping(): Promise<AckEnvelope> {
    return new Promise((resolve, reject) => {
      if (!this.socket) return reject(new Error('OmniSocketClient is not connected'));
      this.socket.emit('presence:ping', (response: AckEnvelope) => {
        resolve(response);
      });
    });
  }

  /**
   * Listen for graceful server shutdown notice
   */
  public onShutdown(callback: (message: string) => void): void {
    if (!this.socket) return;
    this.socket.on('server:shutdown', (payload: { message: string }) => {
      callback(payload.message);
    });
  }

  /**
   * Disconnect socket and stop background timers
   */
  public disconnect(): void {
    this.stopHeartbeatTimer();
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  private startHeartbeatTimer(): void {
    this.stopHeartbeatTimer();
    const interval = this.options.heartbeatIntervalMs || 30000;
    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.ping().catch(() => {});
      }
    }, interval);
  }

  private stopHeartbeatTimer(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
