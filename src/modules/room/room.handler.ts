import { Socket } from 'socket.io';
import { roomService } from './room.service';
import { formatErrorResponse } from '../../shared/errors';
import { JoinRoomPayload, LeaveRoomPayload, BroadcastRoomPayload } from './IRoom';

export function registerRoomHandlers(socket: Socket): void {
  // Handle room:join
  socket.on('room:join', async (payload: JoinRoomPayload, ack?: (res: unknown) => void) => {
    try {
      const scopedRoomKey = await roomService.joinRoom(socket, payload);

      const response = {
        status: 'success',
        event: 'room:joined',
        roomId: payload.roomId,
        scopedRoomKey,
      };

      socket.emit('room:joined', response);
      if (ack) ack(response);
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('room:error', errorResponse);
      if (ack) ack(errorResponse);
    }
  });

  // Handle room:leave
  socket.on('room:leave', async (payload: LeaveRoomPayload, ack?: (res: unknown) => void) => {
    try {
      const scopedRoomKey = await roomService.leaveRoom(socket, payload);

      const response = {
        status: 'success',
        event: 'room:left',
        roomId: payload.roomId,
        scopedRoomKey,
      };

      socket.emit('room:left', response);
      if (ack) ack(response);
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('room:error', errorResponse);
      if (ack) ack(errorResponse);
    }
  });

  // Handle room:broadcast
  socket.on('room:broadcast', (payload: BroadcastRoomPayload, ack?: (res: unknown) => void) => {
    try {
      const scopedRoomKey = roomService.broadcastToRoom(socket, payload);

      const response = {
        status: 'success',
        event: 'room:broadcast_sent',
        roomId: payload.roomId,
        scopedRoomKey,
      };

      if (ack) ack(response);
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('room:error', errorResponse);
      if (ack) ack(errorResponse);
    }
  });
}
