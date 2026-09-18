import fs from 'fs';
import path from 'path';
import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import { adminAuthMiddleware } from '../../middleware';
import { applicationService } from '../../services/application/application.service';
import { healthService } from '../health/health.service';
import { config } from '../../config/env';

const adminHtmlPath = path.join(process.cwd(), 'public', 'admin', 'index.html');
let adminHtmlCache: string | null = null;

function getAdminHtml(): string {
  if (!adminHtmlCache) {
    adminHtmlCache = fs.readFileSync(adminHtmlPath, 'utf-8');
  }
  return adminHtmlCache;
}

export function registerAdminRoutes(server: FastifyInstance): void {
  // 1. Aggregated Admin Stats API
  server.get(
    '/api/v1/admin/stats',
    { preHandler: [adminAuthMiddleware] },
    async (request: FastifyRequest, reply: FastifyReply) => {
      const apps = await applicationService.listApps();
      const metrics = healthService.getMetrics();
      const readiness = await healthService.getReadiness();

      return reply.send({
        status: 'success',
        timestamp: new Date().toISOString(),
        summary: {
          totalApplications: apps.length,
          activeSockets: metrics.connections.activeSockets,
          totalRooms: metrics.rooms.totalRooms,
          uptimeSeconds: metrics.uptimeSeconds,
        },
        memory: metrics.memory,
        readiness,
        applications: apps,
      });
    }
  );

  // 2. Serve OmniSocket Master Admin UI at configured obscure path
  server.get(config.ADMIN_PANEL_PATH, async (request: FastifyRequest, reply: FastifyReply) => {
    const html = getAdminHtml();
    return reply.header('Content-Type', 'text/html; charset=utf-8').send(html);
  });
}
