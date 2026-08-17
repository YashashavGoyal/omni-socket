import { connectionRegistry } from '../connection/connection-registry';
import { applicationService } from '../application/application.service';
import { io } from '../../socket';

export class HealthService {
  public getLiveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
    };
  }

  public async getReadiness() {
    const isSocketReady = !!io;
    const isRegistryReady = connectionRegistry.isHealthy();
    const isAppRepoReady = await applicationService.isHealthy();

    const isFullyReady = isSocketReady && isRegistryReady && isAppRepoReady;

    return {
      status: isFullyReady ? 'ready' : 'not_ready',
      timestamp: new Date().toISOString(),
      subsystems: {
        socketIO: isSocketReady ? 'healthy' : 'unhealthy',
        connectionRegistry: isRegistryReady ? 'healthy' : 'unhealthy',
        applicationRepository: isAppRepoReady ? 'healthy' : 'unhealthy',
      },
    };
  }

  public getMetrics() {
    const memory = process.memoryUsage();
    const activeSockets = connectionRegistry.getActiveConnectionCount();
    const totalRooms = io?.sockets.adapter.rooms.size || 0;

    return {
      timestamp: new Date().toISOString(),
      uptimeSeconds: Number(process.uptime().toFixed(2)),
      connections: {
        activeSockets,
      },
      rooms: {
        totalRooms,
      },
      memory: {
        heapUsedMb: Number((memory.heapUsed / 1024 / 1024).toFixed(2)),
        heapTotalMb: Number((memory.heapTotal / 1024 / 1024).toFixed(2)),
        rssMb: Number((memory.rss / 1024 / 1024).toFixed(2)),
      },
    };
  }
}

export const healthService = new HealthService();
