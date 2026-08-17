import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify from 'fastify';
import { setupSocketIO } from '../src/socket';
import { registerHealthRoutes } from '../src/modules/health';

describe('Operational Readiness & Health Subsystem', () => {
  let server: ReturnType<typeof Fastify>;
  const PORT = 4034;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    registerHealthRoutes(server);
    setupSocketIO(server);
    await server.listen({ port: PORT, host: '127.0.0.1' });
  });

  afterAll(async () => {
    await server.close();
  });

  it('should return Liveness probe status 200 OK', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/health/live`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(typeof data.uptimeSeconds).toBe('number');
  });

  it('should return Readiness probe status 200 OK with healthy subsystems', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/health/ready`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.status).toBe('ready');
    expect(data.subsystems.socketIO).toBe('healthy');
  });

  it('should return Metrics probe status 200 OK', async () => {
    const res = await fetch(`http://127.0.0.1:${PORT}/health/metrics`);
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.memory).toBeDefined();
  });
});
