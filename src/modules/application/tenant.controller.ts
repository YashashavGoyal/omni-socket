import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { applicationService } from './application.service';
import { adminAuthMiddleware } from '../auth/admin-auth.middleware';
import { ValidationError } from '../../shared/errors';

const createAppSchema = z.object({
  name: z.string().min(2).max(100),
  applicationId: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, {
      message: 'applicationId slug must contain only lowercase alphanumeric characters and hyphens',
    })
    .optional(),
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
  applicationId: z
    .string()
    .min(2)
    .max(64)
    .regex(/^[a-z0-9-]+$/, {
      message: 'applicationId slug must contain only lowercase alphanumeric characters and hyphens',
    })
    .optional(),
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
      return reply.send({
        status: 'success',
        count: apps.length,
        data: apps,
      });
    });

    // 2. Get single app by primary UUID id
    tenantRoutes.get('/api/v1/apps/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const app = await applicationService.getApp(id);

      return reply.send({
        status: 'success',
        data: app,
      });
    });

    // 3. Register a new tenant application
    tenantRoutes.post('/api/v1/apps', async (request: FastifyRequest, reply: FastifyReply) => {
      const parseResult = createAppSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid application registration payload', {
          issues: parseResult.error.format(),
        });
      }

      const result = await applicationService.registerApp(parseResult.data);

      return reply.status(201).send({
        status: 'success',
        message: 'Application registered successfully. Store the API key safely as it will not be shown again.',
        data: {
          ...result.record,
          apiKey: result.apiKey,
        },
      });
    });

    // 4. Update tenant application, name, slug (applicationId), or feature flags
    tenantRoutes.patch('/api/v1/apps/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const parseResult = updateAppSchema.safeParse(request.body);
      if (!parseResult.success) {
        throw new ValidationError('Invalid application update payload', {
          issues: parseResult.error.format(),
        });
      }

      const updated = await applicationService.updateApp(id, parseResult.data);

      return reply.send({
        status: 'success',
        message: 'Application updated successfully',
        data: updated,
      });
    });

    // 5. Rotate tenant API key
    tenantRoutes.post('/api/v1/apps/:id/rotate-key', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      const result = await applicationService.rotateApiKey(id);

      return reply.send({
        status: 'success',
        message: 'API key rotated successfully. Store the new API key safely.',
        data: result,
      });
    });

    // 6. Delete tenant application by primary UUID id
    tenantRoutes.delete('/api/v1/apps/:id', async (request: FastifyRequest, reply: FastifyReply) => {
      const { id } = request.params as { id: string };
      await applicationService.deleteApp(id);

      return reply.send({
        status: 'success',
        message: `Application with ID '${id}' deleted successfully`,
      });
    });
  });
}
