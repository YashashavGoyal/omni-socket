export interface JoinRoomPayload {
  roomId: string;
}

export interface LeaveRoomPayload {
  roomId: string;
}

export interface BroadcastRoomPayload {
  roomId: string;
  event: string;
  data: unknown;
  includeSelf?: boolean;
}

export interface RoomEventResponse<T = unknown> {
  status: 'success' | 'error';
  event: string;
  roomId: string;
  data?: T;
  error?: unknown;
}
