import { Socket } from 'socket.io';
import { roomService } from './room.service';
import { rateLimiterService } from '../../shared/rate-limiter/rate-limiter.service';
import { featureGuardService } from '../application/feature-guard.service';
import { formatErrorResponse } from '../../shared/errors';
import { auditLogger } from '../../shared/logger/audit-logger';
import { securitySanitizer } from '../../shared/security/security-sanitizer';
import { JoinRoomPayload, LeaveRoomPayload, BroadcastRoomPayload } from './IRoom';

export function registerRoomHandlers(socket: Socket): void {
  // Handle room:join
  socket.on('room:join', async (rawPayload: JoinRoomPayload, ack?: (res: unknown) => void) => {
    const startTime = performance.now();
    const correlationId = auditLogger.generateCorrelationId();

    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      await featureGuardService.assertFeature(socket, 'rooms');

      const payload = securitySanitizer.sanitize(rawPayload);
      const scopedRoomKey = await roomService.joinRoom(socket, payload);

      const response = {
        status: 'success',
        event: 'room:joined',
        roomId: payload.roomId,
        scopedRoomKey,
      };

      socket.emit('room:joined', response);
      if (ack) ack(response);

      auditLogger.log({
        correlationId,
        applicationId: socket.data.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'room:join',
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        details: { roomId: payload.roomId, scopedRoomKey },
      });
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('room:error', errorResponse);
      if (ack) ack(errorResponse);

      auditLogger.log({
        correlationId,
        applicationId: socket.data.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'room:join',
        status: 'FAILURE',
        durationMs: performance.now() - startTime,
        details: { roomId: rawPayload?.roomId, error: errorResponse.message },
      });
    }
  });

  // Handle room:leave
  socket.on('room:leave', async (rawPayload: LeaveRoomPayload, ack?: (res: unknown) => void) => {
    const startTime = performance.now();
    const correlationId = auditLogger.generateCorrelationId();

    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      await featureGuardService.assertFeature(socket, 'rooms');

      const payload = securitySanitizer.sanitize(rawPayload);
      const scopedRoomKey = await roomService.leaveRoom(socket, payload);

      const response = {
        status: 'success',
        event: 'room:left',
        roomId: payload.roomId,
        scopedRoomKey,
      };

      socket.emit('room:left', response);
      if (ack) ack(response);

      auditLogger.log({
        correlationId,
        applicationId: socket.data.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'room:leave',
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        details: { roomId: payload.roomId },
      });
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('room:error', errorResponse);
      if (ack) ack(errorResponse);

      auditLogger.log({
        correlationId,
        applicationId: socket.data.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'room:leave',
        status: 'FAILURE',
        durationMs: performance.now() - startTime,
        details: { roomId: rawPayload?.roomId, error: errorResponse.message },
      });
    }
  });

  // Handle room:broadcast
  socket.on('room:broadcast', async (rawPayload: BroadcastRoomPayload, ack?: (res: unknown) => void) => {
    const startTime = performance.now();
    const correlationId = auditLogger.generateCorrelationId();

    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      await featureGuardService.assertFeature(socket, 'rooms');

      const payload = securitySanitizer.sanitize(rawPayload);
      const scopedRoomKey = roomService.broadcastToRoom(socket, payload);

      const response = {
        status: 'success',
        event: 'room:broadcast_sent',
        roomId: payload.roomId,
        scopedRoomKey,
      };

      if (ack) ack(response);

      auditLogger.log({
        correlationId,
        applicationId: socket.data.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'room:broadcast',
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        details: { roomId: payload.roomId, eventName: payload.event },
      });
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('room:error', errorResponse);
      if (ack) ack(errorResponse);

      auditLogger.log({
        correlationId,
        applicationId: socket.data.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'room:broadcast',
        status: 'FAILURE',
        durationMs: performance.now() - startTime,
        details: { roomId: rawPayload?.roomId, error: errorResponse.message },
      });
    }
  });
}
