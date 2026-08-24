import { Socket } from 'socket.io';
import { authorizationService } from '../../../services/auth/authorization.service';
import { ValidationError } from '../../../shared/errors';
import { JoinRoomPayload, LeaveRoomPayload, BroadcastRoomPayload } from './IRoom';

export class RoomService {
  /**
   * Joins a socket to a tenant-isolated room.
   */
  public async joinRoom(socket: Socket, payload: JoinRoomPayload): Promise<string> {
    if (!payload || !payload.roomId || typeof payload.roomId !== 'string' || payload.roomId.trim() === '') {
      throw new ValidationError('Invalid roomId: Room ID must be a non-empty string');
    }

    const scopedRoomKey = authorizationService.assertRoomAccess(socket, payload.roomId.trim());
    await socket.join(scopedRoomKey);

    return scopedRoomKey;
  }

  /**
   * Leaves a tenant-isolated room.
   */
  public async leaveRoom(socket: Socket, payload: LeaveRoomPayload): Promise<string> {
    if (!payload || !payload.roomId || typeof payload.roomId !== 'string' || payload.roomId.trim() === '') {
      throw new ValidationError('Invalid roomId: Room ID must be a non-empty string');
    }

    const scopedRoomKey = authorizationService.assertRoomAccess(socket, payload.roomId.trim());
    await socket.leave(scopedRoomKey);

    return scopedRoomKey;
  }

  /**
   * Broadcasts a generic payload to a tenant-isolated room.
   */
  public broadcastToRoom(socket: Socket, payload: BroadcastRoomPayload): string {
    if (!payload || !payload.roomId || typeof payload.roomId !== 'string' || payload.roomId.trim() === '') {
      throw new ValidationError('Invalid roomId: Room ID must be a non-empty string');
    }

    if (!payload.event || typeof payload.event !== 'string' || payload.event.trim() === '') {
      throw new ValidationError('Invalid event: Event name must be a non-empty string');
    }

    const scopedRoomKey = authorizationService.assertRoomAccess(socket, payload.roomId.trim());

    if (payload.includeSelf) {
      socket.nsp.to(scopedRoomKey).emit(payload.event, payload.data);
    } else {
      socket.to(scopedRoomKey).emit(payload.event, payload.data);
    }

    return scopedRoomKey;
  }
}

export const roomService = new RoomService();
