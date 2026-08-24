import { Socket } from 'socket.io';
import { roomService } from './room.service';
import { rateLimiterService } from '../../../shared/rate-limiter/rate-limiter.service';
import { featureGuardService } from '../../../services/feature-guard/feature-guard.service';
import { formatErrorResponse } from '../../../shared/errors';
import { auditLogger } from '../../../shared/logger/audit-logger';
import { securitySanitizer } from '../../../shared/security/security-sanitizer';
import { AckResponseFormatter, AckCallback } from '../../../shared/responses/ack-response.formatter';
import { JoinRoomPayload, LeaveRoomPayload, BroadcastRoomPayload } from './IRoom';

export function registerRoomHandlers(socket: Socket): void {
  // Handle room:join
  socket.on('room:join', async (rawPayload: JoinRoomPayload, ack?: AckCallback) => {
    const startTime = performance.now();
    const correlationId = auditLogger.generateCorrelationId();

    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      await featureGuardService.assertFeature(socket, 'rooms');

      const payload = securitySanitizer.sanitize(rawPayload);
      const scopedRoomKey = await roomService.joinRoom(socket, payload);

      const responseData = {
        event: 'room:joined',
        roomId: payload.roomId,
        scopedRoomKey,
      };

      const legacyResponse = {
        status: 'success',
        ...responseData,
      };

      socket.emit('room:joined', legacyResponse);
      AckResponseFormatter.sendAck(ack, AckResponseFormatter.success(responseData));

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
      AckResponseFormatter.sendAck(
        ack,
        AckResponseFormatter.error(errorResponse.code, errorResponse.message)
      );

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
  socket.on('room:leave', async (rawPayload: LeaveRoomPayload, ack?: AckCallback) => {
    const startTime = performance.now();
    const correlationId = auditLogger.generateCorrelationId();

    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      await featureGuardService.assertFeature(socket, 'rooms');

      const payload = securitySanitizer.sanitize(rawPayload);
      const scopedRoomKey = await roomService.leaveRoom(socket, payload);

      const responseData = {
        event: 'room:left',
        roomId: payload.roomId,
        scopedRoomKey,
      };

      const legacyResponse = {
        status: 'success',
        ...responseData,
      };

      socket.emit('room:left', legacyResponse);
      AckResponseFormatter.sendAck(ack, AckResponseFormatter.success(responseData));

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
      AckResponseFormatter.sendAck(
        ack,
        AckResponseFormatter.error(errorResponse.code, errorResponse.message)
      );

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
  socket.on('room:broadcast', async (rawPayload: BroadcastRoomPayload, ack?: AckCallback) => {
    const startTime = performance.now();
    const correlationId = auditLogger.generateCorrelationId();

    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      await featureGuardService.assertFeature(socket, 'rooms');

      const payload = securitySanitizer.sanitize(rawPayload);
      const scopedRoomKey = roomService.broadcastToRoom(socket, payload);

      const responseData = {
        event: 'room:broadcast_sent',
        roomId: payload.roomId,
        scopedRoomKey,
      };

      AckResponseFormatter.sendAck(ack, AckResponseFormatter.success(responseData));

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
      AckResponseFormatter.sendAck(
        ack,
        AckResponseFormatter.error(errorResponse.code, errorResponse.message)
      );

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
