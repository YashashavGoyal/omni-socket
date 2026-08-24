import { FastifyInstance } from 'fastify';
import { healthService } from './health.service';
import { HTTP_STATUS_CODE } from '../../shared/errors';

export async function registerHealthRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/health/live', async (_request, reply) => {
    return reply.status(HTTP_STATUS_CODE.OK).send(healthService.getLiveness());
  });

  fastify.get('/health/ready', async (_request, reply) => {
    const readiness = await healthService.getReadiness();
    const statusCode = readiness.status === 'ready'
      ? HTTP_STATUS_CODE.OK
      : HTTP_STATUS_CODE.SERVICE_UNAVAILABLE;
    return reply.status(statusCode).send(readiness);
  });

  fastify.get('/health/metrics', async (_request, reply) => {
    return reply.status(HTTP_STATUS_CODE.OK).send(healthService.getMetrics());
  });
}
