import { Server as SocketIOServer } from 'socket.io';
import { FastifyInstance } from 'fastify';
import { config } from '../config/env';

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
        fastifyServer.log.info(`[Socket.IO] Transport connection established: ${socket.id}`);

        socket.on('disconnect', (reason) => {
            fastifyServer.log.info(`[Socket.IO] Transport disconnected: ${socket.id} (Reason: ${reason})`);
        });
    });

    return io;
}
