import { Socket } from 'socket.io';
import { applicationService } from '../../services/application/application.service';
import { connectionRegistry } from '../connection/connection-registry';
import { UnauthorizedError, ERROR_MESSAGES } from '../../shared/errors';
import { auditLogger } from '../../shared/logger/audit-logger';
import { AuthHandshakePayload } from '../../services/auth/IAuth';

export async function authenticateHandshake(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const startTime = performance.now();
  const correlationId = auditLogger.generateCorrelationId();
  socket.data.correlationId = correlationId;

  try {
    const auth = socket.handshake.auth as AuthHandshakePayload;

    if (!auth || !auth.applicationId || !auth.apiKey) {
      auditLogger.log({
        correlationId,
        socketId: socket.id,
        action: 'auth:handshake',
        status: 'BLOCKED',
        durationMs: performance.now() - startTime,
        details: { reason: ERROR_MESSAGES.MISSING_HANDSHAKE_AUTH },
      });
      return next(new UnauthorizedError(ERROR_MESSAGES.MISSING_HANDSHAKE_AUTH));
    }

    const isValid = await applicationService.validateAppCredentials(auth.applicationId, auth.apiKey);
    if (!isValid) {
      auditLogger.log({
        correlationId,
        applicationId: auth.applicationId,
        socketId: socket.id,
        userId: auth.userId,
        action: 'auth:handshake',
        status: 'FAILURE',
        durationMs: performance.now() - startTime,
        details: { reason: ERROR_MESSAGES.INVALID_CREDENTIALS },
      });
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

    auditLogger.log({
      correlationId,
      applicationId: auth.applicationId,
      socketId: socket.id,
      userId: auth.userId,
      action: 'auth:handshake',
      status: 'SUCCESS',
      durationMs: performance.now() - startTime,
    });

    return next();
  } catch (error) {
    auditLogger.log({
      correlationId,
      socketId: socket.id,
      action: 'auth:handshake',
      status: 'FAILURE',
      durationMs: performance.now() - startTime,
      details: { reason: 'Internal error' },
    });
    return next(new UnauthorizedError('Authentication failed: Internal server error'));
  }
}
