import { Server as SocketIOServer } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { config } from '../config/env';
import { authenticateHandshake } from '../modules/auth/auth.middleware';
import { registerRoomHandlers } from '../modules/room/room.handler';
import { registerEventHandlers } from '../modules/event/event.handler';
import { connectionRegistry } from '../modules/connection/connection-registry';

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

    socket.on('disconnect', (reason) => {
      connectionRegistry.unregister(socket.id);
      fastifyServer.log.info(
        `[Socket.IO] Client disconnected: ${socket.id} (Reason: ${reason}) | Remaining connections: ${connectionRegistry.getActiveConnectionCount()}`
      );
    });
  });

  return io;
}
