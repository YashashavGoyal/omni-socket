import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupSocketIO } from '../src/socket';

describe('Presence & Heartbeat Subsystem', () => {
  let server: ReturnType<typeof Fastify>;
  let aliceSocket: ClientSocketType;
  let bobSocket: ClientSocketType;
  const PORT = 4033;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    setupSocketIO(server);
    await server.listen({ port: PORT, host: '127.0.0.1' });

    aliceSocket = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'alice' },
      transports: ['websocket'],
    });

    bobSocket = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'bob' },
      transports: ['websocket'],
    });

    await Promise.all([
      new Promise<void>((res) => aliceSocket.on('connect', res)),
      new Promise<void>((res) => bobSocket.on('connect', res)),
    ]);
  });

  afterAll(async () => {
    aliceSocket.disconnect();
    bobSocket.disconnect();
    await server.close();
  });

  it('should broadcast status updates to room members and reply to heartbeats', async () => {
    await Promise.all([
      new Promise<void>((r) => aliceSocket.emit('room:join', { roomId: 'call-101' }, r)),
      new Promise<void>((r) => bobSocket.emit('room:join', { roomId: 'call-101' }, r)),
    ]);

    const presencePromise = new Promise<any>((resolve) => {
      bobSocket.on('presence:changed', (data) => resolve(data));
    });

    aliceSocket.emit('presence:update', {
      roomId: 'call-101',
      status: 'busy',
      customStatusMessage: 'In a meeting',
    });

    const update = await presencePromise;
    expect(update.userId).toBe('alice');
    expect(update.status).toBe('busy');

    const pong = await new Promise<any>((resolve) => {
      aliceSocket.emit('presence:ping', (res: any) => resolve(res));
    });

    expect(pong.status).toBe('success');
  });
});
