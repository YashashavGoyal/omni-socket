import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupSocketIO } from '../src/socket';
import { registerAuthRoutes } from '../src/api/auth';
import { fastifyErrorHandler } from '../src/shared/errors';
import { applicationService } from '../src/services/application/application.service';
import { applicationRepository } from '../src/services/application/application.repository';
import { tokenService } from '../src/services/auth/token.service';
import { OmniSocketClient } from '../sdk/omni-client';
import { ApplicationRecord } from '../src/services/application/IApplication';
import { CONNECTION_TYPE } from '../src/services/auth/IAuth';

describe('Dual-Mode Authentication & Ephemeral Client Connection Tokens', () => {
  let server: FastifyInstance;
  let port: number;

  const mockAppId = 'test-token-app';
  const mockApiKey = 'test_token_api_key_12345';
  const mockAppRecord: ApplicationRecord = {
    id: 'mock-uuid-1',
    applicationId: mockAppId,
    name: 'Token Test App',
    apiKeyHash: 'mock-hash',
    enabled: true,
    features: { presence: true, rooms: true, events: true },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const PORT = 4055;

  beforeAll(async () => {
    // Mock application service & repository for test isolation
    vi.spyOn(applicationService, 'validateAppCredentials').mockImplementation(
      async (appId, rawKey) => appId === mockAppId && rawKey === mockApiKey
    );
    vi.spyOn(applicationRepository, 'findByApplicationId').mockImplementation(
      async (appId) => (appId === mockAppId ? mockAppRecord : null)
    );

    server = Fastify({ logger: false });
    server.setErrorHandler(fastifyErrorHandler);
    registerAuthRoutes(server);
    setupSocketIO(server);

    await server.listen({ port: PORT, host: '127.0.0.1' });
    port = PORT;
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await server.close();
  });

  describe('REST Endpoint: POST /api/v1/auth/tokens', () => {
    it('should reject requests without tenant headers with 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/tokens',
        payload: {
          userId: 'user_alice',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('error');
    });

    it('should reject requests without x-application-id header with 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/tokens',
        headers: {
          'x-api-key': mockApiKey,
        },
        payload: {
          userId: 'user_alice',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests without x-api-key header with 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/tokens',
        headers: {
          'x-application-id': mockAppId,
        },
        payload: {
          userId: 'user_alice',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests with invalid apiKey with 401', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/tokens',
        headers: {
          'x-application-id': mockAppId,
          'x-api-key': 'wrong_key',
        },
        payload: {
          userId: 'user_alice',
        },
      });

      expect(res.statusCode).toBe(401);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('UNAUTHORIZED');
    });

    it('should reject requests with invalid request body schema with 400', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/tokens',
        headers: {
          'x-application-id': mockAppId,
          'x-api-key': mockApiKey,
        },
        payload: {
          // Missing userId
        },
      });

      expect(res.statusCode).toBe(400);
      const body = JSON.parse(res.body);
      expect(body.code).toBe('VALIDATION_ERROR');
    });

    it('should mint an ephemeral client token with valid tenant header credentials', async () => {
      const res = await server.inject({
        method: 'POST',
        url: '/api/v1/auth/tokens',
        headers: {
          'x-application-id': mockAppId,
          'x-api-key': mockApiKey,
        },
        payload: {
          userId: 'user_alice',
          ttlSeconds: 600,
          grants: {
            allowedRooms: ['room-101'],
            canPublish: true,
          },
          metadata: {
            username: 'Alice',
            role: 'member',
          },
        },
      });

      expect(res.statusCode).toBe(201);
      const body = JSON.parse(res.body);
      expect(body.status).toBe('success');
      expect(body.data.token).toBeDefined();
      expect(body.data.tokenType).toBe('Bearer');
      expect(body.data.expiresInSeconds).toBe(600);
      expect(body.data.expiresAt).toBeDefined();

      // Verify token payload matches input
      const verified = tokenService.verifyClientToken(body.data.token);
      expect(verified.sub).toBe('user_alice');
      expect(verified.appId).toBe(mockAppId);
      expect(verified.grants?.allowedRooms).toEqual(['room-101']);
      expect(verified.metadata).toEqual({ username: 'Alice', role: 'member' });
    });
  });

  describe('WebSocket Handshake Dual-Mode Authentication', () => {
    it('should authenticate server-mode connection using applicationId and apiKey', async () => {
      const socket = ClientSocket(`http://127.0.0.1:${port}`, {
        auth: {
          type: CONNECTION_TYPE.SERVER,
          applicationId: mockAppId,
          apiKey: mockApiKey,
          userId: 'backend_service',
        },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
      });

      expect(socket.connected).toBe(true);
      socket.disconnect();
    });

    it('should authenticate client-mode connection using ephemeral token', async () => {
      const tokenResult = tokenService.mintClientToken({
        applicationId: mockAppId,
        userId: 'client_bob',
        grants: {
          allowedRooms: ['lobby'],
        },
        metadata: {
          avatar: 'https://example.com/avatar.png',
        },
      });

      const socket = ClientSocket(`http://127.0.0.1:${port}`, {
        auth: {
          type: CONNECTION_TYPE.CLIENT,
          token: tokenResult.token,
        },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve, reject) => {
        socket.on('connect', resolve);
        socket.on('connect_error', reject);
      });

      expect(socket.connected).toBe(true);
      socket.disconnect();
    });

    it('should reject client handshake with an invalid token', async () => {
      const socket = ClientSocket(`http://127.0.0.1:${port}`, {
        auth: {
          type: CONNECTION_TYPE.CLIENT,
          token: 'invalid.tampered.token',
        },
        transports: ['websocket'],
      });

      const error = await new Promise<Error>((resolve) => {
        socket.on('connect_error', resolve);
      });

      expect(error.message).toContain('Authentication failed');
      socket.disconnect();
    });

    it('should reject client handshake when client token is missing', async () => {
      const socket = ClientSocket(`http://127.0.0.1:${port}`, {
        auth: {
          type: CONNECTION_TYPE.CLIENT,
          // No token provided
        },
        transports: ['websocket'],
      });

      const error = await new Promise<Error>((resolve) => {
        socket.on('connect_error', resolve);
      });

      expect(error.message).toContain('Missing client connection token');
      socket.disconnect();
    });

    it('should enforce room grant restrictions for client tokens', async () => {
      const tokenResult = tokenService.mintClientToken({
        applicationId: mockAppId,
        userId: 'client_charlie',
        grants: {
          allowedRooms: ['room-public'], // Only permitted to join room-public
        },
      });

      const socket = ClientSocket(`http://127.0.0.1:${port}`, {
        auth: {
          type: CONNECTION_TYPE.CLIENT,
          token: tokenResult.token,
        },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => socket.on('connect', resolve));

      // 1. Join permitted room
      const joinPermitted = await new Promise<any>((resolve) => {
        socket.emit('room:join', { roomId: 'room-public' }, (ack: any) => resolve(ack));
      });
      expect(joinPermitted.status).toBe('success');

      // 2. Attempt to join unpermitted room
      const joinForbidden = await new Promise<any>((resolve) => {
        socket.emit('room:join', { roomId: 'room-secret' }, (ack: any) => resolve(ack));
      });
      expect(joinForbidden.status).toBe('error');
      expect(joinForbidden.code).toBe('FORBIDDEN');
      expect(joinForbidden.message).toContain('Token grants do not permit joining this room');

      socket.disconnect();
    });

    it('should enforce publishing grant restrictions for client tokens', async () => {
      const tokenResult = tokenService.mintClientToken({
        applicationId: mockAppId,
        userId: 'client_read_only',
        grants: {
          allowedRooms: ['announcements'],
          canPublish: false, // Read-only subscriber
        },
      });

      const socket = ClientSocket(`http://127.0.0.1:${port}`, {
        auth: {
          type: CONNECTION_TYPE.CLIENT,
          token: tokenResult.token,
        },
        transports: ['websocket'],
      });

      await new Promise<void>((resolve) => socket.on('connect', resolve));

      // Joining room succeeds
      const joinAck = await new Promise<any>((resolve) => {
        socket.emit('room:join', { roomId: 'announcements' }, (ack: any) => resolve(ack));
      });
      expect(joinAck.status).toBe('success');

      // Broadcasting to room fails due to canPublish: false
      const broadcastAck = await new Promise<any>((resolve) => {
        socket.emit('room:broadcast', { roomId: 'announcements', event: 'chat:message', data: 'hello' }, (ack: any) =>
          resolve(ack)
        );
      });
      expect(broadcastAck.status).toBe('error');
      expect(broadcastAck.code).toBe('FORBIDDEN');
      expect(broadcastAck.message).toContain('Token grants do not permit publishing');

      socket.disconnect();
    });
  });

  describe('SDK OmniSocketClient with Client Tokens', () => {
    it('should connect using OmniSocketClient with static token', async () => {
      const tokenResult = tokenService.mintClientToken({
        applicationId: mockAppId,
        userId: 'sdk_client_1',
      });

      const client = new OmniSocketClient({
        url: `http://127.0.0.1:${port}`,
        type: CONNECTION_TYPE.CLIENT,
        token: tokenResult.token,
        autoHeartbeat: false,
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
      expect(client.getApplicationId()).toBe(mockAppId);
      client.disconnect();
    });

    it('should connect using OmniSocketClient with dynamic tokenProvider', async () => {
      let callCount = 0;
      const client = new OmniSocketClient({
        url: `http://127.0.0.1:${port}`,
        type: CONNECTION_TYPE.CLIENT,
        tokenProvider: async () => {
          callCount++;
          const minted = tokenService.mintClientToken({
            applicationId: mockAppId,
            userId: `sdk_dynamic_${callCount}`,
          });
          return minted.token;
        },
        autoHeartbeat: false,
      });

      await client.connect();
      expect(client.isConnected()).toBe(true);
      expect(callCount).toBeGreaterThanOrEqual(1);
      client.disconnect();
    });
  });
});
