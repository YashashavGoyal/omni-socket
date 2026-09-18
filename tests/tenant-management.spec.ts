import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { registerTenantRoutes } from '../src/api/apps';
import { fastifyErrorHandler } from '../src/shared/errors';
import { setupSocketIO } from '../src/socket';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { config } from '../src/config/env';

describe('Tenant Management REST API Subsystem (/api/v1/apps)', () => {
  let server: ReturnType<typeof Fastify>;
  const PORT = 4040;
  const adminKey = config.ADMIN_API_KEY;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    server.setErrorHandler(fastifyErrorHandler);
    registerTenantRoutes(server);
    setupSocketIO(server);
    await server.listen({ port: PORT, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await server.close();
  });

  it('should reject requests without a valid Master Admin API Key', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/apps',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('error');
    expect(body.code).toBe('UNAUTHORIZED');
  });

  it('should list all registered applications when authorized', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/v1/apps',
      headers: {
        'x-admin-key': adminKey,
      },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('success');
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.data.length).toBeGreaterThan(0);
  });

  it('should register a app with custom slug, update its slug, and authenticate socket handshake using slug', async () => {
    const testAppName = `Custom Slug App ${Date.now()}`;
    const customSlug = `custom-slug-${Date.now()}`;

    // 1. Register App by providing name & custom applicationId slug
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/apps',
      headers: {
        'x-admin-key': adminKey,
      },
      payload: {
        name: testAppName,
        applicationId: customSlug,
        features: { presence: true, rooms: true, events: true },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body);
    expect(createBody.status).toBe('success');
    expect(createBody.data.id).toBeDefined();
    expect(createBody.data.applicationId).toBe(customSlug);
    expect(createBody.data.apiKey).toBeDefined();

    const appId = createBody.data.id;
    const generatedApiKey = createBody.data.apiKey;

    // 2. Connect socket with generated key and applicationId slug
    const socket: ClientSocketType = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: customSlug, apiKey: generatedApiKey, userId: 'test_user' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });

    expect(socket.connected).toBe(true);
    socket.disconnect();

    // 3. Mutate the slug via PATCH /api/v1/apps/:id
    const newSlug = `renamed-slug-${Date.now()}`;
    const patchRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/apps/${appId}`,
      headers: {
        'x-admin-key': adminKey,
      },
      payload: {
        applicationId: newSlug,
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = JSON.parse(patchRes.body);
    expect(patchBody.data.applicationId).toBe(newSlug);

    // 4. Connect socket using the updated slug
    const updatedSocket: ClientSocketType = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: newSlug, apiKey: generatedApiKey, userId: 'test_user' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      updatedSocket.on('connect', resolve);
      updatedSocket.on('connect_error', reject);
    });

    expect(updatedSocket.connected).toBe(true);
    updatedSocket.disconnect();

    // 5. Disable tenant application via PATCH /api/v1/apps/:id
    await server.inject({
      method: 'PATCH',
      url: `/api/v1/apps/${appId}`,
      headers: { 'x-admin-key': adminKey },
      payload: { enabled: false },
    });

    // 6. Rotate API key via POST /api/v1/apps/:id/rotate-key and re-enable
    const rotateRes = await server.inject({
      method: 'POST',
      url: `/api/v1/apps/${appId}/rotate-key`,
      headers: { 'x-admin-key': adminKey },
    });

    expect(rotateRes.statusCode).toBe(200);
    const newApiKey = JSON.parse(rotateRes.body).data.newApiKey;

    await server.inject({
      method: 'PATCH',
      url: `/api/v1/apps/${appId}`,
      headers: { 'x-admin-key': adminKey },
      payload: { enabled: true },
    });

    // 7. Connect with rotated key
    const reconnectedSocket: ClientSocketType = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: newSlug, apiKey: newApiKey, userId: 'test_user' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      reconnectedSocket.on('connect', resolve);
      reconnectedSocket.on('connect_error', reject);
    });

    expect(reconnectedSocket.connected).toBe(true);
    reconnectedSocket.disconnect();

    // 8. Cleanup: Delete test app via DELETE /api/v1/apps/:id
    const deleteRes = await server.inject({
      method: 'DELETE',
      url: `/api/v1/apps/${appId}`,
      headers: { 'x-admin-key': adminKey },
    });

    expect(deleteRes.statusCode).toBe(200);
  });
});
