import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupSocketIO } from '../src/socket';
import { registerGracefulShutdown, triggerGracefulShutdown } from '../src/shared/lifecycle';

describe('Graceful Shutdown Subsystem', () => {
  let server: ReturnType<typeof Fastify>;
  let socket: ClientSocketType;
  const PORT = 4035;

  beforeAll(async () => {
    // Stub process.exit for testing
    // @ts-ignore
    process.exit = () => {};

    server = Fastify({ logger: false });
    const io = setupSocketIO(server);
    registerGracefulShutdown(server, io);
    await server.listen({ port: PORT, host: '127.0.0.1' });

    socket = ClientSocket(`http://127.0.0.1:${PORT}`, {
      auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'alice' },
      transports: ['websocket'],
    });

    await new Promise<void>((res) => socket.on('connect', res));
  }, 30000);

  afterAll(async () => {
    socket.disconnect();
  });

  it('should broadcast server:shutdown notice to connected client upon shutdown', async () => {
    const shutdownPromise = new Promise<any>((resolve) => {
      socket.on('server:shutdown', (data) => resolve(data));
    });

    await triggerGracefulShutdown('SIGTERM');

    const notice = await shutdownPromise;
    expect(notice.status).toBe('shutdown');
    expect(notice.message).toContain('Server is shutting down');
  });
});
