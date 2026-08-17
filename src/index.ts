import Fastify from 'fastify';
import { config } from './config/env';
import { setupSocketIO } from './socket';
import { fastifyErrorHandler } from './shared/errors';
import { registerHealthRoutes } from './modules/health';

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

// Register operational readiness health endpoints
registerHealthRoutes(server);

// Attach Socket.IO transport layer
setupSocketIO(server);

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
