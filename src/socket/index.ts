import { Server as SocketIOServer } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { config } from '../config/env';
import { connectionRegistry } from '../connection/connection-registry';

export let io: SocketIOServer;

export function setupSocketIO(fastifyServer: FastifyInstance): SocketIOServer {
  io = new SocketIOServer(fastifyServer.server, {
    cors: {
      origin: config.CORS_ORIGIN,
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  io.on('connection', (socket) => {
    // Register initial connection context
    connectionRegistry.register({
      socketId: socket.id,
      connectedAt: new Date(),
    });

    fastifyServer.log.info(
      `[Socket.IO] Connected: ${socket.id} (Active connections: ${connectionRegistry.getActiveConnectionCount()})`
    );

    socket.on('disconnect', (reason) => {
      connectionRegistry.unregister(socket.id);
      fastifyServer.log.info(
        `[Socket.IO] Disconnected: ${socket.id} (Reason: ${reason}) | Remaining connections: ${connectionRegistry.getActiveConnectionCount()}`
      );
    });
  });

  return io;
}
