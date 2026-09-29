import { Socket } from 'socket.io';
import { connectionRegistry } from '../../connection/connection-registry';
import { authorizationService } from '../../../services/auth/authorization.service';
import { PresenceRecord, PresenceUpdatePayload, UserPresenceStatus } from './IPresence';
import { ValidationError } from '../../../shared/errors';
import { redisService } from '../../../services/redis/redis.service';

export class PresenceService {
  private presenceMap = new Map<string, PresenceRecord>();
  private readonly PRESENCE_TTL_SECONDS = 60;

  private getPresenceKey(applicationId: string, userId: string): string {
    return `${applicationId}:${userId}`;
  }

  private syncToRedis(record: PresenceRecord): void {
    if (redisService.isRedisEnabled()) {
      const redisClient = redisService.getDataClient();
      if (redisClient) {
        const redisKey = `omni:presence:${record.applicationId}:${record.userId}`;
        redisClient.setex(redisKey, this.PRESENCE_TTL_SECONDS, JSON.stringify(record)).catch((err) => {
          console.error(`[Redis Presence Sync Error] ${redisKey}:`, err);
        });
      }
    }
  }

  /**
   * Registers or updates connection presence when a user connects.
   */
  public onUserConnect(applicationId: string, userId: string): PresenceRecord {
    const key = this.getPresenceKey(applicationId, userId);
    const activeSockets = connectionRegistry.getSocketsByUserId(userId).length;
    const now = new Date();

    const existing = this.presenceMap.get(key);
    const record: PresenceRecord = {
      userId,
      applicationId,
      status: existing?.status && existing.status !== 'offline' ? existing.status : 'online',
      customStatusMessage: existing?.customStatusMessage,
      activeSocketsCount: activeSockets,
      lastSeenAt: now,
      updatedAt: now,
    };

    this.presenceMap.set(key, record);
    this.syncToRedis(record);
    return record;
  }

  /**
   * Updates presence state when a socket disconnects.
   */
  public onUserDisconnect(applicationId: string, userId: string): { isFullyOffline: boolean; record: PresenceRecord } {
    const key = this.getPresenceKey(applicationId, userId);
    const activeSockets = connectionRegistry.getSocketsByUserId(userId).length;
    const now = new Date();

    const existing = this.presenceMap.get(key);
    const isFullyOffline = activeSockets === 0;

    const record: PresenceRecord = {
      userId,
      applicationId,
      status: isFullyOffline ? 'offline' : (existing?.status && existing.status !== 'offline' ? existing.status : 'online'),
      customStatusMessage: existing?.customStatusMessage,
      activeSocketsCount: activeSockets,
      lastSeenAt: now,
      updatedAt: now,
    };

    this.presenceMap.set(key, record);
    this.syncToRedis(record);
    return { isFullyOffline, record };
  }

  /**
   * Allows a user to manually update their presence status ('online' | 'away' | 'busy').
   * Only broadcasts to a room if `payload.roomId` is explicitly provided.
   */
  public updateStatus(socket: Socket, payload: PresenceUpdatePayload): PresenceRecord {
    if (!payload || !payload.status) {
      throw new ValidationError('Invalid presence update: status is required');
    }

    const appId = socket.data.applicationId as string;
    const userId = socket.data.userId as string;

    if (!appId || !userId) {
      throw new ValidationError('Unauthenticated socket cannot update presence');
    }

    const validStatuses: UserPresenceStatus[] = ['online', 'away', 'busy'];
    if (!validStatuses.includes(payload.status)) {
      throw new ValidationError(`Invalid presence status: ${payload.status}`);
    }

    const key = this.getPresenceKey(appId, userId);
    const activeSockets = connectionRegistry.getSocketsByUserId(userId).length;
    const now = new Date();

    const record: PresenceRecord = {
      userId,
      applicationId: appId,
      status: payload.status,
      customStatusMessage: payload.customStatusMessage,
      activeSocketsCount: activeSockets,
      lastSeenAt: now,
      updatedAt: now,
    };

    this.presenceMap.set(key, record);
    this.syncToRedis(record);

    // Broadcast only if a specific room is targeted
    if (payload.roomId) {
      const scopedRoomKey = authorizationService.assertRoomAccess(socket, payload.roomId);
      socket.to(scopedRoomKey).emit('presence:changed', record);
    }

    return record;
  }

  /**
   * Updates lastSeenAt timestamp on client heartbeat ping.
   */
  public recordHeartbeat(socket: Socket): PresenceRecord | null {
    const appId = socket.data.applicationId as string;
    const userId = socket.data.userId as string;
    if (!appId || !userId) return null;

    const key = this.getPresenceKey(appId, userId);
    const existing = this.presenceMap.get(key);
    if (!existing) return null;

    existing.lastSeenAt = new Date();
    existing.updatedAt = new Date();
    this.presenceMap.set(key, existing);
    this.syncToRedis(existing);
    return existing;
  }

  /**
   * Retrieves current presence record for a user from local memory cache.
   */
  public getPresence(applicationId: string, userId: string): PresenceRecord | null {
    return this.presenceMap.get(this.getPresenceKey(applicationId, userId)) || null;
  }

  /**
   * Asynchronously retrieves presence record across cluster nodes from Redis if not present in local node memory.
   */
  public async getPresenceAsync(applicationId: string, userId: string): Promise<PresenceRecord | null> {
    const localRecord = this.getPresence(applicationId, userId);
    if (localRecord) {
      return localRecord;
    }

    if (redisService.isRedisEnabled()) {
      const redisClient = redisService.getDataClient();
      if (redisClient) {
        const redisKey = `omni:presence:${applicationId}:${userId}`;
        const rawJson = await redisClient.get(redisKey);
        if (rawJson) {
          try {
            const record = JSON.parse(rawJson) as PresenceRecord;
            record.lastSeenAt = new Date(record.lastSeenAt);
            record.updatedAt = new Date(record.updatedAt);
            return record;
          } catch {
            return null;
          }
        }
      }
    }

    return null;
  }
}

export const presenceService = new PresenceService();
