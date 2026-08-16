import Fastify from 'fastify';
import { config } from './config/env';
import { setupSocketIO } from './socket';
import { fastifyErrorHandler } from './shared/errors';

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

// Operational health endpoint
server.get('/health', async (_request, reply) => {
  return reply.status(200).send({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

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
