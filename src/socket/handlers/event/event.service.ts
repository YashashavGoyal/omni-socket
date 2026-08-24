import { Socket } from 'socket.io';
import { authorizationService } from '../../../services/auth/authorization.service';
import { connectionRegistry } from '../../connection/connection-registry';
import { ValidationError } from '../../../shared/errors';
import { EmitEventPayload, RoutedEventMessage } from './IEvent';

export class EventService {
  /**
   * Routes a generic custom event to room, user, socket, or application target.
   */
  public emitEvent(socket: Socket, payload: EmitEventPayload): void {
    if (!payload || !payload.targetType || !payload.targetId || !payload.eventName) {
      throw new ValidationError('Invalid emit payload: targetType, targetId, and eventName are required');
    }

    const senderAppId = socket.data.applicationId as string;
    const senderUserId = socket.data.userId as string | undefined;

    const eventMessage: RoutedEventMessage = {
      event: payload.eventName,
      payload: payload.payload,
      sender: {
        socketId: socket.id,
        applicationId: senderAppId,
        userId: senderUserId,
      },
      timestamp: new Date().toISOString(),
    };

    switch (payload.targetType) {
      case 'room': {
        const scopedRoomKey = authorizationService.assertRoomAccess(socket, payload.targetId);
        if (payload.includeSelf) {
          socket.nsp.to(scopedRoomKey).emit(payload.eventName, eventMessage);
        } else {
          socket.to(scopedRoomKey).emit(payload.eventName, eventMessage);
        }
        break;
      }

      case 'user': {
        // Find all active socket connections for the target userId
        const targetSockets = connectionRegistry.getSocketsByUserId(payload.targetId);
        for (const targetSocketId of targetSockets) {
          if (!payload.includeSelf && targetSocketId === socket.id) {
            continue;
          }
          socket.nsp.to(targetSocketId).emit(payload.eventName, eventMessage);
        }
        break;
      }

      case 'socket': {
        socket.nsp.to(payload.targetId).emit(payload.eventName, eventMessage);
        break;
      }

      case 'application': {
        // Broadcast across the entire tenant application space
        const appRoomKey = `app:${senderAppId}`;
        if (payload.includeSelf) {
          socket.nsp.to(appRoomKey).emit(payload.eventName, eventMessage);
        } else {
          socket.to(appRoomKey).emit(payload.eventName, eventMessage);
        }
        break;
      }

      default:
        throw new ValidationError(`Unsupported targetType: ${payload.targetType}`);
    }
  }
}

export const eventService = new EventService();
