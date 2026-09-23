import Fastify from 'fastify';
import { config } from './config/env';
import { redisService } from './services/redis/redis.service';
import { setupSocketIO } from './socket';
import { fastifyErrorHandler } from './shared/errors';
import { registerHealthRoutes } from './api/health';
import { registerDocsRoutes } from './api/docs';
import { registerTenantRoutes } from './api/apps';
import { registerAdminRoutes } from './api/admin';
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

// Register operational readiness health, tenant REST management, admin dashboard & docs routes
registerHealthRoutes(server);
registerDocsRoutes(server);
registerTenantRoutes(server);
registerAdminRoutes(server);

const start = async () => {
  try {
    // 1. Initialize Redis connections if enabled (fails fast on error)
    await redisService.initRedis();

    // 2. Attach Socket.IO transport layer & Redis adapter
    const io = setupSocketIO(server);

    // 3. Attach OS signal graceful shutdown handler
    registerGracefulShutdown(server, io);

    await server.listen({ port: config.PORT, host: config.HOST });
    server.log.info(`[OmniSocket] Fastify server running on http://${config.HOST}:${config.PORT}`);
    if (config.NODE_ENV === "development") {
      server.log.info(`[OmniSocket] Master Admin Dashboard available at http://${config.HOST}:${config.PORT}${config.ADMIN_PANEL_PATH}`);
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
