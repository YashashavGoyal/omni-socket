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

    // Strict validation: Reject immediately if type is missing or invalid
    if (auth.type !== CONNECTION_TYPE.CLIENT && auth.type !== CONNECTION_TYPE.SERVER) {
      auditLogger.log({
        correlationId,
        socketId: socket.id,
        action: 'auth:handshake',
        status: 'BLOCKED',
        durationMs: performance.now() - startTime,
        details: { reason: ERROR_MESSAGES.INVALID_CONNECTION_TYPE },
      });
      return next(new UnauthorizedError(ERROR_MESSAGES.INVALID_CONNECTION_TYPE));
    }

    // 1. Client Mode: Strictly requires token; must NOT include server credentials
    if (auth.type === CONNECTION_TYPE.CLIENT) {
      if (!auth.token || auth.apiKey || auth.applicationId) {
        auditLogger.log({
          correlationId,
          socketId: socket.id,
          action: 'auth:handshake:client',
          status: 'BLOCKED',
          durationMs: performance.now() - startTime,
          details: { reason: ERROR_MESSAGES.INVALID_CLIENT_HANDSHAKE },
        });
        return next(new UnauthorizedError(ERROR_MESSAGES.INVALID_CLIENT_HANDSHAKE));
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

    // 2. Server Mode: Strictly requires applicationId, apiKey, and userId; must NOT include token
    if (auth.type === CONNECTION_TYPE.SERVER) {
      if (!auth.applicationId || !auth.apiKey || !auth.userId || auth.token) {
        auditLogger.log({
          correlationId,
          socketId: socket.id,
          action: 'auth:handshake:server',
          status: 'BLOCKED',
          durationMs: performance.now() - startTime,
          details: { reason: ERROR_MESSAGES.INVALID_SERVER_HANDSHAKE },
        });
        return next(new UnauthorizedError(ERROR_MESSAGES.INVALID_SERVER_HANDSHAKE));
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
      socket.data.userId = auth.userId;
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
