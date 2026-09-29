import Redis, { RedisOptions } from 'ioredis';
import { config } from '../../config/env';

export class RedisService {
  private pubClient: Redis | null = null;
  private subClient: Redis | null = null;
  private dataClient: Redis | null = null;
  private isConnected = false;

  /**
   * Initializes Redis connections when REDIS_ENABLED is true.
   * Fails fast if connection cannot be established.
   */
  public async initRedis(): Promise<void> {
    if (!config.REDIS_ENABLED) {
      return;
    }

    if (!config.REDIS_URL) {
      throw new Error('REDIS_URL environment variable is missing despite REDIS_ENABLED=true');
    }

    const redisOptions: RedisOptions = {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          return null; // Fail fast after 3 retries
        }
        return Math.min(times * 200, 1000);
      },
      connectTimeout: 5000,
    };

    try {
      this.pubClient = new Redis(config.REDIS_URL, redisOptions);
      this.subClient = new Redis(config.REDIS_URL, redisOptions);
      this.dataClient = new Redis(config.REDIS_URL, redisOptions);

      // Verify connections with PING probe
      await Promise.all([
        this.pubClient.ping(),
        this.subClient.ping(),
        this.dataClient.ping(),
      ]);

      this.isConnected = true;
      console.log('✅ [Redis] Connected to Redis cluster successfully');
    } catch (error) {
      this.isConnected = false;
      console.error('❌ [Redis Boot Error] Failed to connect to Redis:', error);
      await this.closeRedis();
      throw new Error(`[Redis Boot Failure] Unable to establish Redis connection at ${config.REDIS_URL}`);
    }
  }

  public getPubClient(): Redis {
    if (!this.pubClient) {
      throw new Error('Redis pubClient is not initialized');
    }
    return this.pubClient;
  }

  public getSubClient(): Redis {
    if (!this.subClient) {
      throw new Error('Redis subClient is not initialized');
    }
    return this.subClient;
  }

  public getDataClient(): Redis | null {
    return this.dataClient;
  }

  public isRedisEnabled(): boolean {
    return config.REDIS_ENABLED && this.isConnected;
  }

  /**
   * Health probe for /health endpoint.
   */
  public async healthCheck(): Promise<{ status: 'healthy' | 'unhealthy' | 'disabled'; latencyMs?: number }> {
    if (!config.REDIS_ENABLED) {
      return { status: 'disabled' };
    }

    if (!this.dataClient || !this.isConnected) {
      return { status: 'unhealthy' };
    }

    try {
      const start = Date.now();
      await this.dataClient.ping();
      const latencyMs = Date.now() - start;
      return { status: 'healthy', latencyMs };
    } catch {
      return { status: 'unhealthy' };
    }
  }

  /**
   * Graceful shutdown of Redis client instances.
   */
  public async closeRedis(): Promise<void> {
    const clients = [this.pubClient, this.subClient, this.dataClient];
    this.pubClient = null;
    this.subClient = null;
    this.dataClient = null;
    this.isConnected = false;

    await Promise.all(
      clients.map(async (client) => {
        if (client) {
          try {
            await client.quit();
          } catch {
            client.disconnect();
          }
        }
      })
    );
  }
}

export const redisService = new RedisService();
