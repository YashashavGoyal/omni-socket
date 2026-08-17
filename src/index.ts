import Fastify from 'fastify';
import { config } from './config/env';
import { setupSocketIO } from './socket';
import { fastifyErrorHandler } from './shared/errors';
import { registerHealthRoutes } from './modules/health';
import { registerDocsRoutes } from './modules/docs/docs.controller';
import { registerGracefulShutdown } from './shared/lifecycle';

const server = Fastify({
  logger: config.NODE_ENV === 'development'
    ? {
      transport: {
        target: 'pino-pretty',
        options: {
          translateTime: 'HH:MM:ss Z',
          ignore: 'pid,hostname',
        },
      },
      level: config.LOG_LEVEL,
    }
    : {
      level: config.LOG_LEVEL,
    },
});

// Attach central Fastify error handler middleware
server.setErrorHandler(fastifyErrorHandler);

// Register operational readiness health endpoints & self-documenting REST routes
registerHealthRoutes(server);
registerDocsRoutes(server);

// Attach Socket.IO transport layer
const io = setupSocketIO(server);

// Attach OS signal graceful shutdown handler
registerGracefulShutdown(server, io);

const start = async () => {
  try {
    await server.listen({ port: config.PORT, host: config.HOST });
    server.log.info(`[OmniSocket] Fastify server running on http://${config.HOST}:${config.PORT}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
