import Fastify from 'fastify';
import { config } from './config/env';
import { setupSocketIO } from './socket';

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

// Operational health endpoint for monitoring
server.get('/health', async (_request, reply) => {
  return reply.status(200).send({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
});

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
