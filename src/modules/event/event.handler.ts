import { Socket } from 'socket.io';
import { eventService } from './event.service';
import { rateLimiterService } from '../../shared/rate-limiter/rate-limiter.service';
import { featureGuardService } from '../application/feature-guard.service';
import { formatErrorResponse } from '../../shared/errors';
import { auditLogger } from '../../shared/logger/audit-logger';
import { securitySanitizer } from '../../shared/security/security-sanitizer';
import { AckResponseFormatter, AckCallback } from '../../shared/responses/ack-response.formatter';
import { EmitEventPayload } from './IEvent';

export function registerEventHandlers(socket: Socket): void {
  // Automatically join socket to its application space "app:<appId>"
  const appId = socket.data.applicationId;
  if (appId) {
    socket.join(`app:${appId}`);
  }

  // Handle generic custom event emitting
  socket.on('event:emit', async (rawPayload: EmitEventPayload, ack?: AckCallback) => {
    const startTime = performance.now();
    const correlationId = auditLogger.generateCorrelationId();

    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      await featureGuardService.assertFeature(socket, 'events');

      const payload = securitySanitizer.sanitize(rawPayload);
      eventService.emitEvent(socket, payload);

      const responseData = {
        event: 'event:emitted',
        targetType: payload.targetType,
        targetId: payload.targetId,
        eventName: payload.eventName,
      };

      AckResponseFormatter.sendAck(ack, AckResponseFormatter.success(responseData));

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
      AckResponseFormatter.sendAck(
        ack,
        AckResponseFormatter.error(errorResponse.code, errorResponse.message)
      );

      auditLogger.log({
        correlationId,
        applicationId: socket.data.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'event:emit',
        status: 'FAILURE',
        durationMs: performance.now() - startTime,
        details: { targetType: rawPayload?.targetType, targetId: rawPayload?.targetId, error: errorResponse.message },
      });
    }
  });
}
