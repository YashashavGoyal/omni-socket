import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { registerDocsRoutes } from '../src/api/docs';
import { docsService } from '../src/api/docs/docs.service';

describe('Self-Documenting REST & AI Agent Markdown Subsystem', () => {
  let server: FastifyInstance;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    await registerDocsRoutes(server);
    await server.ready();
  });

  afterAll(async () => {
    await server.close();
  });

  it('should return structured JSON route directory on GET / by default', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.name).toBe('OmniSocket Realtime Engine');
    expect(json.version).toBeDefined();
    expect(json.status).toBe('online');
    expect(json.documentation.index).toBe('/docs');
    expect(json.routes.documentation).toBeInstanceOf(Array);
    expect(json.routes.health).toBeInstanceOf(Array);
    expect(json.routes.health).toHaveLength(1);
    expect(json.routes.health[0].path).toBe('/health/live');
    expect(json.routes.authentication).toBeInstanceOf(Array);
    expect(json.routes.realtime).toBeInstanceOf(Array);
  });

  it('should return Markdown route directory on GET / when Accept header is text/markdown', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/',
      headers: {
        accept: 'text/markdown',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.payload).toContain('OmniSocket Realtime Engine');
    expect(res.payload).toContain('Public Route Directory');
    expect(res.payload).toContain('/docs');
    expect(res.payload).toContain('/health/live');
    expect(res.payload).toContain('/api/v1/auth/tokens');
  });

  it('should serve raw Markdown on GET /llms.txt for AI agents', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/llms.txt',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.payload).toContain('🤖 OmniSocket Complete Client Integration & API Documentation');
    expect(res.payload).toContain('OmniSocket Authentication & Handshake Guide');
  });

  it('should return JSON topic summary on GET /docs by default', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/docs',
    });

    expect(res.statusCode).toBe(200);
    const json = JSON.parse(res.payload);
    expect(json.status).toBe('ok');
    expect(json.llmsEndpoint).toBe('/llms.txt');
    expect(json.availableTopics).toHaveLength(docsService.getAllTopicIds().length);
  });

  it('should return raw Markdown on GET /docs when Accept header is text/markdown', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/docs',
      headers: {
        accept: 'text/markdown',
      },
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.payload).toContain('🤖 OmniSocket Complete Client Integration & API Documentation');
  });

  it('should return raw Markdown on GET /docs/rooms?format=md query parameter', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/docs/rooms?format=md',
    });

    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/markdown');
    expect(res.payload).toContain('OmniSocket Room Event Contracts');
    expect(res.payload).toContain('room:join');
  });

  it('should return 404 error response for non-existent documentation topics with dynamic topic list', async () => {
    const res = await server.inject({
      method: 'GET',
      url: '/docs/invalid-topic',
    });

    expect(res.statusCode).toBe(404);
    const json = JSON.parse(res.payload);
    expect(json.code).toBe('NOT_FOUND');

    const expectedAvailable = [...docsService.getAllTopicIds(), 'all'].join(', ');
    expect(json.message).toContain(`Available topics: ${expectedAvailable}.`);
  });
});
