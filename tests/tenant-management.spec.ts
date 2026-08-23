import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { registerTenantRoutes } from '../src/modules/application/tenant.controller';
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

  it('should register a new tenant application (system auto-generates slug and API key) and authenticate socket handshake', async () => {
    const testAppName = `Automated Test App ${Date.now()}`;

    // 1. Register App by only providing name
    const createRes = await server.inject({
      method: 'POST',
      url: '/api/v1/apps',
      headers: {
        'x-admin-key': adminKey,
      },
      payload: {
        name: testAppName,
        features: { presence: true, rooms: true, events: true },
      },
    });

    expect(createRes.statusCode).toBe(201);
    const createBody = JSON.parse(createRes.body);
    expect(createBody.status).toBe('success');
    expect(createBody.data.applicationId).toBeDefined();
    expect(createBody.data.apiKey).toBeDefined();

    const generatedAppId = createBody.data.applicationId;
    const generatedApiKey = createBody.data.apiKey;

    // 2. Connect socket with generated key and applicationId
    const socket: ClientSocketType = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: generatedAppId, apiKey: generatedApiKey, userId: 'test_user' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      socket.on('connect', resolve);
      socket.on('connect_error', reject);
    });

    expect(socket.connected).toBe(true);
    socket.disconnect();

    // 3. Disable tenant application
    const patchRes = await server.inject({
      method: 'PATCH',
      url: `/api/v1/apps/${generatedAppId}`,
      headers: {
        'x-admin-key': adminKey,
      },
      payload: {
        enabled: false,
      },
    });

    expect(patchRes.statusCode).toBe(200);
    const patchBody = JSON.parse(patchRes.body);
    expect(patchBody.data.enabled).toBe(false);

    // 4. Attempt socket connection to disabled tenant -> expect rejection
    const disabledSocket: ClientSocketType = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: generatedAppId, apiKey: generatedApiKey, userId: 'test_user' },
      transports: ['websocket'],
      reconnection: false,
    });

    await expect(
      new Promise<void>((resolve, reject) => {
        disabledSocket.on('connect', resolve);
        disabledSocket.on('connect_error', reject);
      })
    ).rejects.toThrow();

    disabledSocket.disconnect();

    // 5. Rotate API key and re-enable tenant
    const rotateRes = await server.inject({
      method: 'POST',
      url: `/api/v1/apps/${generatedAppId}/rotate-key`,
      headers: {
        'x-admin-key': adminKey,
      },
    });

    expect(rotateRes.statusCode).toBe(200);
    const newApiKey = JSON.parse(rotateRes.body).data.newApiKey;
    expect(newApiKey).toBeDefined();

    await server.inject({
      method: 'PATCH',
      url: `/api/v1/apps/${generatedAppId}`,
      headers: {
        'x-admin-key': adminKey,
      },
      payload: { enabled: true },
    });

    // 6. Connect with new rotated key
    const reconnectedSocket: ClientSocketType = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: generatedAppId, apiKey: newApiKey, userId: 'test_user' },
      transports: ['websocket'],
    });

    await new Promise<void>((resolve, reject) => {
      reconnectedSocket.on('connect', resolve);
      reconnectedSocket.on('connect_error', reject);
    });

    expect(reconnectedSocket.connected).toBe(true);
    reconnectedSocket.disconnect();

    // 7. Cleanup: Delete test app
    const deleteRes = await server.inject({
      method: 'DELETE',
      url: `/api/v1/apps/${generatedAppId}`,
      headers: {
        'x-admin-key': adminKey,
      },
    });

    expect(deleteRes.statusCode).toBe(200);
  });
});
