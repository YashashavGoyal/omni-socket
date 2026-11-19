import { Socket } from 'socket.io';
import { applicationService } from '../../services/application/application.service';
import { applicationRepository } from '../../services/application/application.repository';
import { tokenService } from '../../services/auth/token.service';
import { connectionRegistry } from '../connection/connection-registry';
import { UnauthorizedError, ERROR_MESSAGES } from '../../shared/errors';
import { auditLogger } from '../../shared/logger/audit-logger';
import { AuthHandshakePayload, CONNECTION_TYPE } from '../../services/auth/IAuth';

export async function authenticateHandshake(
  socket: Socket,
  next: (err?: Error) => void
): Promise<void> {
  const startTime = performance.now();
  const correlationId = auditLogger.generateCorrelationId();
  socket.data.correlationId = correlationId;

  try {
    const auth = (socket.handshake.auth || {}) as AuthHandshakePayload;

    const isClientMode =
      auth.type === CONNECTION_TYPE.CLIENT || (Boolean(auth.token) && !auth.apiKey);
    const isServerMode =
      auth.type === CONNECTION_TYPE.SERVER || (Boolean(auth.applicationId) && Boolean(auth.apiKey));

    // 1. Client Mode: Authenticate via Ephemeral Token
    if (isClientMode) {
      if (!auth.token) {
        auditLogger.log({
          correlationId,
          socketId: socket.id,
          action: 'auth:handshake:client',
          status: 'BLOCKED',
          durationMs: performance.now() - startTime,
          details: { reason: ERROR_MESSAGES.MISSING_TOKEN },
        });
        return next(new UnauthorizedError(ERROR_MESSAGES.MISSING_TOKEN));
      }

      let payload;
      try {
        payload = tokenService.verifyClientToken(auth.token);
      } catch (err: any) {
        auditLogger.log({
          correlationId,
          socketId: socket.id,
          action: 'auth:handshake:client',
          status: 'FAILURE',
          durationMs: performance.now() - startTime,
          details: { reason: err?.message || ERROR_MESSAGES.INVALID_OR_EXPIRED_TOKEN },
        });
        return next(new UnauthorizedError(err?.message || ERROR_MESSAGES.INVALID_OR_EXPIRED_TOKEN));
      }

      // Verify tenant app is valid and enabled
      const app = await applicationRepository.findByApplicationId(payload.appId);
      if (!app || !app.enabled) {
        auditLogger.log({
          correlationId,
          applicationId: payload.appId,
          socketId: socket.id,
          userId: payload.sub,
          action: 'auth:handshake:client',
          status: 'FAILURE',
          durationMs: performance.now() - startTime,
          details: { reason: ERROR_MESSAGES.INVALID_CREDENTIALS },
        });
        return next(new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS));
      }

      // Attach client authenticated context to socket.data
      socket.data.role = CONNECTION_TYPE.CLIENT;
      socket.data.applicationId = payload.appId;
      socket.data.userId = payload.sub;
      socket.data.grants = payload.grants;
      socket.data.metadata = payload.metadata;
      socket.data.authenticatedAt = new Date();

      connectionRegistry.register({
        socketId: socket.id,
        applicationId: payload.appId,
        userId: payload.sub,
        connectedAt: socket.data.authenticatedAt,
        metadata: payload.metadata,
      });

      auditLogger.log({
        correlationId,
        applicationId: payload.appId,
        socketId: socket.id,
        userId: payload.sub,
        action: 'auth:handshake:client',
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
        details: { grants: payload.grants },
      });

      return next();
    }

    // 2. Server Mode: Authenticate via Master applicationId & apiKey
    if (isServerMode) {
      if (!auth.applicationId || !auth.apiKey) {
        auditLogger.log({
          correlationId,
          socketId: socket.id,
          action: 'auth:handshake:server',
          status: 'BLOCKED',
          durationMs: performance.now() - startTime,
          details: { reason: ERROR_MESSAGES.MISSING_HANDSHAKE_AUTH },
        });
        return next(new UnauthorizedError(ERROR_MESSAGES.MISSING_HANDSHAKE_AUTH));
      }

      const isValid = await applicationService.validateAppCredentials(
        auth.applicationId,
        auth.apiKey
      );
      if (!isValid) {
        auditLogger.log({
          correlationId,
          applicationId: auth.applicationId,
          socketId: socket.id,
          userId: auth.userId,
          action: 'auth:handshake:server',
          status: 'FAILURE',
          durationMs: performance.now() - startTime,
          details: { reason: ERROR_MESSAGES.INVALID_CREDENTIALS },
        });
        return next(new UnauthorizedError(ERROR_MESSAGES.INVALID_CREDENTIALS));
      }

      // Attach server authenticated context to socket.data
      socket.data.role = CONNECTION_TYPE.SERVER;
      socket.data.applicationId = auth.applicationId;
      socket.data.userId = auth.userId || 'system';
      socket.data.authenticatedAt = new Date();

      connectionRegistry.register({
        socketId: socket.id,
        applicationId: auth.applicationId,
        userId: socket.data.userId,
        connectedAt: socket.data.authenticatedAt,
      });

      auditLogger.log({
        correlationId,
        applicationId: auth.applicationId,
        socketId: socket.id,
        userId: socket.data.userId,
        action: 'auth:handshake:server',
        status: 'SUCCESS',
        durationMs: performance.now() - startTime,
      });

      return next();
    }

    // 3. Neither client nor server auth credentials supplied
    auditLogger.log({
      correlationId,
      socketId: socket.id,
      action: 'auth:handshake',
      status: 'BLOCKED',
      durationMs: performance.now() - startTime,
      details: { reason: ERROR_MESSAGES.MISSING_HANDSHAKE_AUTH },
    });
    return next(new UnauthorizedError(ERROR_MESSAGES.MISSING_HANDSHAKE_AUTH));
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
