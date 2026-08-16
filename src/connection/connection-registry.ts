import { ConnectionContext } from './connection.types';

export class ConnectionRegistry {
  private connectionsBySocketId = new Map<string, ConnectionContext>();
  private socketsByUserId = new Map<string, Set<string>>();

  /**
   * Registers an active connection session.
   */
  public register(context: ConnectionContext): void {
    this.connectionsBySocketId.set(context.socketId, context);

    if (context.userId) {
      if (!this.socketsByUserId.has(context.userId)) {
        this.socketsByUserId.set(context.userId, new Set());
      }
      this.socketsByUserId.get(context.userId)!.add(context.socketId);
    }
  }

  /**
   * Unregisters a connection session when a socket disconnects.
   */
  public unregister(socketId: string): ConnectionContext | undefined {
    const context = this.connectionsBySocketId.get(socketId);
    if (!context) return undefined;

    this.connectionsBySocketId.delete(socketId);

    if (context.userId && this.socketsByUserId.has(context.userId)) {
      const userSockets = this.socketsByUserId.get(context.userId)!;
      userSockets.delete(socketId);
      if (userSockets.size === 0) {
        this.socketsByUserId.delete(context.userId);
      }
    }

    return context;
  }

  /**
   * Get context by socket ID.
   */
  public getBySocketId(socketId: string): ConnectionContext | undefined {
    return this.connectionsBySocketId.get(socketId);
  }

  /**
   * Get all active socket IDs for a given user.
   */
  public getSocketsByUserId(userId: string): string[] {
    const sockets = this.socketsByUserId.get(userId);
    return sockets ? Array.from(sockets) : [];
  }

  /**
   * Get total number of active connections.
   */
  public getActiveConnectionCount(): number {
    return this.connectionsBySocketId.size;
  }

  /**
   * Get total number of unique active users.
   */
  public getActiveUserCount(): number {
    return this.socketsByUserId.size;
  }
}

export const connectionRegistry = new ConnectionRegistry();
