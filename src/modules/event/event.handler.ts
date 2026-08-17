import { Socket } from 'socket.io';
import { eventService } from './event.service';
import { rateLimiterService } from '../../shared/rate-limiter/rate-limiter.service';
import { formatErrorResponse } from '../../shared/errors';
import { EmitEventPayload } from './IEvent';

export function registerEventHandlers(socket: Socket): void {
  // Automatically join socket to its application space "app:<appId>"
  const appId = socket.data.applicationId;
  if (appId) {
    socket.join(`app:${appId}`);
  }

  // Handle generic custom event emitting
  socket.on('event:emit', (payload: EmitEventPayload, ack?: (res: unknown) => void) => {
    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      eventService.emitEvent(socket, payload);

      const response = {
        status: 'success',
        event: 'event:emitted',
        targetType: payload.targetType,
        targetId: payload.targetId,
        eventName: payload.eventName,
      };

      if (ack) ack(response);
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('event:error', errorResponse);
      if (ack) ack(errorResponse);
    }
  });
}
