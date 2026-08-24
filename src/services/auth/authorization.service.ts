import { Socket } from 'socket.io';
import { applicationService } from '../application/application.service';
import { ForbiddenError, ERROR_MESSAGES } from '../../shared/errors';

export class AuthorizationService {
  /**
   * Checks if a socket is authorized to access a given room.
   */
  public canAccessRoom(socket: Socket, targetRoomId: string): boolean {
    const socketAppId = socket.data.applicationId as string | undefined;

    if (!socketAppId) {
      return false;
    }

    // If targetRoomId is already scoped (e.g. "ourtime:lobby"), ensure it starts with socketAppId
    if (targetRoomId.includes(':')) {
      const [roomAppId] = targetRoomId.split(':');
      return roomAppId === socketAppId;
    }

    // Unscoped room ID belongs to socketAppId by default
    return true;
  }

  /**
   * Asserts room access, throwing ForbiddenError if unauthorized.
   */
  public assertRoomAccess(socket: Socket, targetRoomId: string): string {
    const isAuthorized = this.canAccessRoom(socket, targetRoomId);

    if (!isAuthorized) {
      throw new ForbiddenError(ERROR_MESSAGES.FORBIDDEN_RESOURCE, {
        clientApplicationId: socket.data.applicationId,
        targetRoomId,
      });
    }

    // Return properly scoped tenant room key (e.g. "ourtime:lobby")
    if (targetRoomId.includes(':')) {
      return targetRoomId;
    }
    return applicationService.getScopedRoomKey(socket.data.applicationId, targetRoomId);
  }
}

export const authorizationService = new AuthorizationService();
