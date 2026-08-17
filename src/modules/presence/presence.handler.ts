import { Socket } from 'socket.io';
import { presenceService } from './presence.service';
import { rateLimiterService } from '../../shared/rate-limiter/rate-limiter.service';
import { formatErrorResponse } from '../../shared/errors';
import { PresenceUpdatePayload } from './IPresence';

export function registerPresenceHandlers(socket: Socket): void {
  const appId = socket.data.applicationId as string;
  const userId = socket.data.userId as string;

  if (appId && userId) {
    presenceService.onUserConnect(appId, userId);
  }

  // Handle manual status update (e.g. user toggles to 'busy' or 'away')
  socket.on('presence:update', (payload: PresenceUpdatePayload, ack?: (res: unknown) => void) => {
    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      const updatedPresence = presenceService.updateStatus(socket, payload);

      const response = {
        status: 'success',
        event: 'presence:updated',
        presence: updatedPresence,
      };

      if (ack) ack(response);
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('presence:error', errorResponse);
      if (ack) ack(errorResponse);
    }
  });

  // Handle heartbeat ping
  socket.on('presence:ping', (ack?: (res: unknown) => void) => {
    try {
      rateLimiterService.assertDualTierRateLimit(socket);
      const updatedPresence = presenceService.recordHeartbeat(socket);

      const response = {
        status: 'success',
        event: 'presence:pong',
        lastSeenAt: updatedPresence?.lastSeenAt.toISOString(),
      };

      if (ack) ack(response);
    } catch (error) {
      const errorResponse = formatErrorResponse(error);
      socket.emit('presence:error', errorResponse);
      if (ack) ack(errorResponse);
    }
  });
}
