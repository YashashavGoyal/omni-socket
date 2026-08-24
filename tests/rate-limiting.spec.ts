import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupSocketIO } from '../src/socket';
import { applicationService } from '../src/services/application/application.service';

describe('Dual-Tier Rate Limiting Subsystem', () => {
  let server: ReturnType<typeof Fastify>;
  let socket: ClientSocketType;
  const PORT = 4032;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    setupSocketIO(server);
    await server.listen({ port: PORT, host: '127.0.0.1' });

    const reg = await applicationService.registerApp({
      name: 'Rate Limit Test App',
    });

    socket = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: reg.record.applicationId, apiKey: reg.apiKey, userId: 'spammer' },
      transports: ['websocket'],
    });

    await new Promise<void>((res) => socket.on('connect', res));
  });

  afterAll(async () => {
    socket?.disconnect();
    await server.close();
  });

  it('should block rapid event bursts when exceeding rate limits', async () => {
    const errorPromise = new Promise<any>((resolve) => {
      socket.on('room:error', (err) => resolve(err));
    });

    // Spam 35 requests instantly to trigger rate limit threshold (30 / 10s)
    for (let i = 0; i < 35; i++) {
      socket.emit('room:join', { roomId: 'test-room' });
    }

    const res = await errorPromise;
    expect(res.status).toBe('error');
    expect(res.code).toBe('TOO_MANY_REQUESTS');
    expect(res.message).toContain('Rate limit exceeded');
  });
});
