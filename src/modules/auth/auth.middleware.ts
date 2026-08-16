import { Socket } from 'socket.io';
import { applicationService } from '../application/application.service';
import { connectionRegistry } from '../connection/connection-registry';
import { UnauthorizedError, ERROR_MESSAGES } from '../../shared/errors';
import { AuthHandshakePayload } from './IAuth';

export async function authenticateHandshake(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const auth = socket.handshake.auth as AuthHandshakePayload;

    if (!auth || !auth.applicationId || !auth.apiKey) {
      return next(new UnauthorizedError(ERROR_MESSAGES.MISSING_HANDSHAKE_AUTH));
    }

    const isValid = await applicationService.validateAppCredentials(auth.applicationId, auth.apiKey);
    if (!isValid) {
      return next(new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS));
    }

    // Attach authenticated context to socket.data
    socket.data.applicationId = auth.applicationId;
    socket.data.userId = auth.userId;
    socket.data.authenticatedAt = new Date();

    // Register authenticated connection session
    connectionRegistry.register({
      socketId: socket.id,
      applicationId: auth.applicationId,
      userId: auth.userId,
      connectedAt: new Date(),
    });

    return next();
  } catch (error) {
    return next(new UnauthorizedError('Authentication failed: Internal server error'));
  }
}
