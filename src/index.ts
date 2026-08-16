import Fastify from 'fastify';
import { config } from './config/env';

const server = Fastify({
  logger: {
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
