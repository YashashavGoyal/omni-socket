import { Socket } from 'socket.io';
import { applicationService } from '../application/application.service';
import { ForbiddenError, ERROR_MESSAGES } from '../../shared/errors';
import { ClientTokenGrants } from './IAuth';

export class AuthorizationService {
  /**
   * Checks if a socket is authorized to access a given room.
   */
  public canAccessRoom(socket: Socket, targetRoomId: string): boolean {
    const socketAppId = socket.data.applicationId as string | undefined;

    if (!socketAppId) {
      return false;
    }

    // Check grants if present
    const grants = socket.data.grants as ClientTokenGrants | undefined;
    if (grants && Array.isArray(grants.allowedRooms) && grants.allowedRooms.length > 0) {
      const cleanTarget = targetRoomId.includes(':') ? targetRoomId.split(':')[1] : targetRoomId;
      const isAllowed = grants.allowedRooms.some(
        (room) => room === targetRoomId || room === cleanTarget || room === '*'
      );
      if (!isAllowed) {
        return false;
      }
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
      const grants = socket.data.grants as ClientTokenGrants | undefined;
      const message =
        grants && Array.isArray(grants.allowedRooms) && grants.allowedRooms.length > 0
          ? ERROR_MESSAGES.TOKEN_ROOM_FORBIDDEN
          : ERROR_MESSAGES.FORBIDDEN_RESOURCE;

      throw new ForbiddenError(message, {
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

  /**
   * Asserts whether a socket has permission to publish / broadcast messages based on token grants.
   */
  public assertCanPublish(socket: Socket): void {
    const grants = socket.data.grants as ClientTokenGrants | undefined;
    if (grants && grants.canPublish === false) {
      throw new ForbiddenError(ERROR_MESSAGES.TOKEN_PUBLISH_FORBIDDEN, {
        clientApplicationId: socket.data.applicationId,
        userId: socket.data.userId,
      });
    }
  }
}

export const authorizationService = new AuthorizationService();
