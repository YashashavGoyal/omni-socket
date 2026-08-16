import { Socket } from 'socket.io';
import { applicationService } from '../application/application.service';
import { connectionRegistry } from '../connection/connection-registry';
import { AuthHandshakePayload } from './IAuth';

export async function authenticateHandshake(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  try {
    const auth = socket.handshake.auth as AuthHandshakePayload;

    if (!auth || !auth.applicationId || !auth.apiKey) {
      return next(new Error('Authentication failed: Missing applicationId or apiKey in handshake.auth'));
    }

    const isValid = await applicationService.validateAppCredentials(auth.applicationId, auth.apiKey);
    if (!isValid) {
      return next(new Error('Authentication failed: Invalid application credentials'));
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
    return next(new Error('Authentication failed: Internal server error'));
  }
}
