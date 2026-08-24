import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupSocketIO } from '../src/socket';
import { applicationService } from '../src/services/application/application.service';

describe('Auth & Messaging Subsystem', () => {
  let server: ReturnType<typeof Fastify>;
  let aliceSocket: ClientSocketType;
  let bobSocket: ClientSocketType;
  let appId: string;
  let apiKey: string;
  const PORT = 4031;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    setupSocketIO(server);
    await server.listen({ port: PORT, host: '127.0.0.1' });

    const reg = await applicationService.registerApp({
      name: 'Auth Test App',
    });
    appId = reg.record.applicationId;
    apiKey = reg.apiKey;

    aliceSocket = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: appId, apiKey, userId: 'alice' },
      transports: ['websocket'],
    });

    bobSocket = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: appId, apiKey, userId: 'bob' },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((res) => aliceSocket.on('connect', res)),
      new Promise<void>((res) => bobSocket.on('connect', res)),
    ]);
  });

  afterAll(async () => {
    aliceSocket?.disconnect();
    bobSocket?.disconnect();
    await server.close();
  });

  it('should allow users to join rooms and broadcast messages', async () => {
    aliceSocket.emit('room:join', { roomId: 'call-101' });
    bobSocket.emit('room:join', { roomId: 'call-101' });

    await new Promise((r) => setTimeout(r, 100));

    const broadcastPromise = new Promise<any>((resolve) => {
      bobSocket.on('signal:offer', (payload) => resolve(payload));
    });

    aliceSocket.emit('room:broadcast', {
      roomId: 'call-101',
      event: 'signal:offer',
      data: { sdp: 'offer_sdp_data' },
    });

    const received = await broadcastPromise;
    expect(received).toEqual({ sdp: 'offer_sdp_data' });
  });

  it('should reject unauthenticated connections', async () => {
    const invalidSocket = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: appId, apiKey: 'WRONG_KEY', userId: 'charlie' },
      transports: ['websocket'],
    });

    const err = await new Promise<Error>((resolve) => {
      invalidSocket.on('connect_error', (error) => resolve(error));
    });

    expect(err.message).toContain('Invalid application credentials');
    invalidSocket.disconnect();
  });
});
