import { Socket } from 'socket.io';
import { eventService } from './event.service';
import { rateLimiterService } from '../../shared/rate-limiter/rate-limiter.service';
import { featureGuardService } from '../application/feature-guard.service';
import { formatErrorResponse } from '../../shared/errors';
import { auditLogger } from '../../shared/logger/audit-logger';
import { EmitEventPayload } from './IEvent';

export function registerEventHandlers(socket: Socket): void {
  // Automatically join socket to its application space "app:<appId>"
  const appId = socket.data.applicationId;
  if (appId) {
    socket.join(`app:${appId}`);
  }

  // Handle generic custom event emitting
  socket.on('event:emit', async (payload: EmitEventPayload, ack?: (res: unknown) => void) => {
    const startTime = performance.now();
    const correlationId = auditLogger.generateCorrelationId();

    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      await featureGuardService.assertFeature(socket, 'events');

      eventService.emitEvent(socket, payload);

      const response = {
        status: 'success',
        event: 'event:emitted',
        targetType: payload.targetType,
        targetId: payload.targetId,
        eventName: payload.eventName,
      };

      if (ack) ack(response);

      auditLogger.log({
        correlationId,
        applicationId: socket.data.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'event:emit',
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        details: { targetType: payload.targetType, targetId: payload.targetId, eventName: payload.eventName },
      });
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('event:error', errorResponse);
      if (ack) ack(errorResponse);

      auditLogger.log({
        correlationId,
        applicationId: socket.data.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'event:emit',
        status: 'FAILURE',
        durationMs: performance.now() - startTime,
        details: { targetType: payload.targetType, targetId: payload.targetId, error: errorResponse.message },
      });
    }
  });
}
