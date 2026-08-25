import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerAdminRoutes } from '../src/api/admin/admin.controller';
import { registerTenantRoutes } from '../src/api/apps/tenant.controller';
import { fastifyErrorHandler } from '../src/shared/errors';
import { config } from '../src/config/env';

describe('Master Admin Dashboard & Stats Subsystem (/admin & /api/v1/admin/stats)', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    server.setErrorHandler(fastifyErrorHandler);
    registerTenantRoutes(server);
    registerAdminRoutes(server);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should serve glassmorphic Admin Panel HTML page at configured path', async () => {
    const res = await server.inject({
      method: 'GET',
      url: config.ADMIN_PANEL_PATH,
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/html');
    expect(res.body).toContain('OmniSocket Master Admin Dashboard');
    expect(res.body).toContain('editModal');
  });

  it('should reject GET /api/v1/admin/stats when X-Admin-Key header is missing', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/stats',
    });

    expect(res.statusCode).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.status).toBe('error');
    expect(body.message).toContain('Unauthorized');
  });

  it('should return live metrics and applications directory when valid X-Admin-Key is provided', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/api/v1/admin/stats',
      headers: {
        'x-admin-key': config.ADMIN_API_KEY,
      },
    });

    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);

    expect(body.status).toBe('success');
    expect(body.summary).toBeDefined();
    expect(typeof body.summary.totalApplications).toBe('number');
    expect(typeof body.summary.activeSockets).toBe('number');
    expect(typeof body.summary.totalRooms).toBe('number');
    expect(body.memory).toBeDefined();
    expect(body.readiness).toBeDefined();
    expect(Array.isArray(body.applications)).toBe(true);
  });

  it('should create an app, allow editing its fields via PATCH, and delete registered application', async () => {
    // 1. Create app
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/apps',
      headers: { 'x-admin-key': config.ADMIN_API_KEY },
      payload: {
        name: 'Original App Name',
        applicationId: `orig-slug-${Date.now()}`,
        features: { rooms: true, presence: true, events: true },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createdApp = JSON.parse(createRes.body).data;

    // 2. Edit app via PATCH
    const patchRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/apps/${createdApp.id}`,
      headers: { 'x-admin-key': config.ADMIN_API_KEY },
      payload: {
        name: 'Updated App Name',
        enabled: false,
        features: { rooms: true, presence: false, events: true },
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const updatedApp = JSON.parse(patchRes.body).data;

    expect(updatedApp.name).toBe('Updated App Name');
    expect(updatedApp.enabled).toBe(false);
    expect(updatedApp.features.presence).toBe(false);

    // 3. Delete registered app via DELETE /api/v1/apps/:id
    const deleteRes = await server.inject({
      method: 'DELETE',
      url: `/api/v1/apps/${createdApp.id}`,
      headers: { 'x-admin-key': config.ADMIN_API_KEY },
    });

    expect(deleteRes.statusCode).toBe(200);
    const deleteBody = JSON.parse(deleteRes.body);
    expect(deleteBody.status).toBe('success');
  });
});
