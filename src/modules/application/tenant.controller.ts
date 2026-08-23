import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { applicationService } from './application.service';
import { adminAuthMiddleware } from '../auth/admin-auth.middleware';
import { ValidationError } from '../../shared/errors';

const createAppSchema = z.object({
  name: z.string().min(2).max(100),
  enabled: z.boolean().optional(),
  features: z
    .object({
      presence: z.boolean().optional(),
      rooms: z.boolean().optional(),
      events: z.boolean().optional(),
    })
    .optional(),
});

const updateAppSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  enabled: z.boolean().optional(),
  features: z
    .object({
      presence: z.boolean().optional(),
      rooms: z.boolean().optional(),
      events: z.boolean().optional(),
    })
    .optional(),
});

export function registerTenantRoutes(server: FastifyInstance): void {
  // Guard all /api/v1/apps routes with admin auth middleware
  server.register(async function (tenantRoutes) {
    tenantRoutes.addHook('preHandler', adminAuthMiddleware);

    // 1. List all apps
    tenantRoutes.get('/api/v1/apps', async (request: FastifyRequest, reply: FastifyReply) => {
      const apps = await applicationService.listApps();
      const sanitizedApps = apps.map(({ apiKeyHash, ...app }) => app);
      return reply.send({
        status: 'success',
        count: sanitizedApps.length,
        data: sanitizedApps,
      });
    });

    // 2. Get single app by applicationId
    tenantRoutes.get('/api/v1/apps/:applicationId', async (request: FastifyRequest, reply: FastifyReply) => {
      const { applicationId } = request.params as { applicationId: string };
      const app = await applicationService.getApp(applicationId);
      const { apiKeyHash, ...sanitized } = app;

      return reply.send({
        status: 'success',
        data: sanitized,
      });
    });

    // 3. Register a new tenant application (system generates applicationId & apiKey)
    tenantRoutes.post('/api/v1/apps', async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createAppSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid application registration payload', {
          issues: parseResult.error.format(),
        });
      }

      const result = await applicationService.registerApp(parseResult.data);
      const { apiKeyHash, ...sanitizedRecord } = result.record;

      return reply.status(201).send({
        status: 'success',
        message: 'Application registered successfully. Store the API key safely as it will not be shown again.',
        data: {
          ...sanitizedRecord,
          apiKey: result.apiKey,
        },
      });
    });

    // 4. Update tenant application or feature flags
    tenantRoutes.patch('/api/v1/apps/:applicationId', async (request: FastifyRequest, reply: FastifyReply) => {
      const { applicationId } = request.params as { applicationId: string };
      const parseResult = updateAppSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid application update payload', {
          issues: parseResult.error.format(),
        });
      }

      const updated = await applicationService.updateApp(applicationId, parseResult.data);
      const { apiKeyHash, ...sanitized } = updated;

      return reply.send({
        status: 'success',
        message: 'Application updated successfully',
        data: sanitized,
      });
    });

    // 5. Rotate tenant API key
    tenantRoutes.post('/api/v1/apps/:applicationId/rotate-key', async (request: FastifyRequest, reply: FastifyReply) => {
      const { applicationId } = request.params as { applicationId: string };
      const result = await applicationService.rotateApiKey(applicationId);

      return reply.send({
        status: 'success',
        message: 'API key rotated successfully. Store the new API key safely.',
        data: result,
      });
    });

    // 6. Delete tenant application
    tenantRoutes.delete('/api/v1/apps/:applicationId', async (request: FastifyRequest, reply: FastifyReply) => {
      const { applicationId } = request.params as { applicationId: string };
      await applicationService.deleteApp(applicationId);

      return reply.send({
        status: 'success',
        message: `Application '${applicationId}' deleted successfully`,
      });
    });
  });
}
