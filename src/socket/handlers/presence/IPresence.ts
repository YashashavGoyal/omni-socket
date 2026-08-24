export type UserPresenceStatus = 'online' | 'offline' | 'away' | 'busy';

export interface PresenceRecord {
  userId: string;
  applicationId: string;
  status: UserPresenceStatus;
  customStatusMessage?: string;
  activeSocketsCount: number;
  lastSeenAt: Date;
  updatedAt: Date;
}

export interface PresenceUpdatePayload {
  status: UserPresenceStatus;
  customStatusMessage?: string;
  roomId?: string; // Optional target room for room-scoped presence broadcasts
}
