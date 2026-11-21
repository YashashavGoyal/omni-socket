import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import Fastify from 'fastify';
import { setupSocketIO } from '../src/socket';
import { registerHealthRoutes } from '../src/api/health';
import { applicationService } from '../src/services/application/application.service';

describe('Operational Readiness & Health Subsystem', () => {
  let server: ReturnType<typeof Fastify>;

  beforeAll(async () => {
    vi.spyOn(applicationService, 'isHealthy').mockResolvedValue(true);
    server = Fastify({ logger: false });
    registerHealthRoutes(server);
    setupSocketIO(server);
    await server.ready();
  });

  afterAll(async () => {
    vi.restoreAllMocks();
    await server.close();
  });

  it('should return Liveness probe status 200 OK', async () => {
    const res = await server.inject({ method: 'GET', url: '/health/live' });
    const data = JSON.parse(res.payload);
    expect(res.statusCode).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.version).toBeDefined();
    expect(data.uptimeSeconds).toBeUndefined();
  });

  it('should return Readiness probe status 200 OK with healthy subsystems and uptime', async () => {
    const res = await server.inject({ method: 'GET', url: '/health/ready' });
    const data = JSON.parse(res.payload);
    expect(res.statusCode).toBe(200);
    expect(data.status).toBe('ready');
    expect(typeof data.uptimeSeconds).toBe('number');
    expect(data.subsystems.socketIO).toBe('healthy');
  });

  it('should return Metrics probe status 200 OK', async () => {
    const res = await server.inject({ method: 'GET', url: '/health/metrics' });
    const data = JSON.parse(res.payload);
    expect(res.statusCode).toBe(200);
    expect(data.memory).toBeDefined();
  });
});
