import { Server as SocketIOServer } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { config } from '../config/env';
import { authenticateHandshake } from './middleware/auth.middleware';
import { registerRoomHandlers } from './handlers/room/room.handler';
import { registerEventHandlers } from './handlers/event/event.handler';
import { registerPresenceHandlers } from './handlers/presence/presence.handler';
import { presenceService } from './handlers/presence/presence.service';
import { connectionRegistry } from './connection/connection-registry';

export let io: SocketIOServer;

export function setupSocketIO(fastifyServer: FastifyInstance): SocketIOServer {
  io = new SocketIOServer(fastifyServer.server, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 1e6, // Safety Limit: 1MB Max WebSocket Payload Size
  });

  // Intercept connection handshakes with generic authentication
  io.use(authenticateHandshake);

  io.on('connection', (socket) => {
    const appId = socket.data.applicationId;
    const userId = socket.data.userId || 'anonymous';

    fastifyServer.log.info(
      `[Socket.IO] Authenticated client connected: ${socket.id} | App: ${appId} | User: ${userId}`
    );

    // Register module event handlers
    registerRoomHandlers(socket);
    registerEventHandlers(socket);
    registerPresenceHandlers(socket);

    socket.on('disconnect', (reason) => {
      connectionRegistry.unregister(socket.id);

      if (appId && userId) {
        presenceService.onUserDisconnect(appId, userId);
      }

      fastifyServer.log.info(
        `[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason}) | Remaining connections: ${connectionRegistry.getActiveConnectionCount()}`
      );
    });
  });

  return io;
}
