import { io, Socket } from 'socket.io-client';
import { AckEnvelope } from '../shared/responses/ack-response.formatter';
import { EventTargetType } from '../socket/handlers/event/IEvent';

export interface OmniSocketClientOptions {
  url: string;
  applicationId: string;
  apiKey: string;
  userId: string;
  autoHeartbeat?: boolean;
  heartbeatIntervalMs?: number;
  transports?: string[];
}

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
  private heartbeatTimer: NodeJS.Timeout | null = null;

  constructor(private options: OmniSocketClientOptions) {}

  /**
   * Connect to the OmniSocket real-time engine with auth credentials
   */
  public connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.socket = io(this.options.url, {
        transports: this.options.transports || ['websocket'],
        auth: {
          applicationId: this.options.applicationId,
          apiKey: this.options.apiKey,
          userId: this.options.userId,
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
  public emitToApp(eventName: string, payload: any): Promise<AckEnvelope> {
    return this.emitCustomEvent('application', this.options.applicationId, eventName, payload);
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
