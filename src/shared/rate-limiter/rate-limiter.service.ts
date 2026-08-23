import { Socket } from 'socket.io';
import { TooManyRequestsError } from '../errors';
import { config } from '../../config/env';

interface RateLimitWindow {
  count: number;
  resetAt: number;
}

export class RateLimiterService {
  private windows = new Map<string, RateLimitWindow>();

  /**
   * Asserts rate limit for a given key (e.g. socket.id or applicationId).
   * @param key Unique key to rate limit
   * @param maxRequests Maximum allowed requests in window
   * @param windowMs Window duration in milliseconds (default: config.RATE_LIMIT_SOCKET_WINDOW_MS)
   */
  public checkRateLimit(
    key: string,
    maxRequests: number = config.RATE_LIMIT_SOCKET_MAX,
    windowMs: number = config.RATE_LIMIT_SOCKET_WINDOW_MS
  ): void {
    const now = Date.now();
    const windowData = this.windows.get(key);

    if (!windowData || now > windowData.resetAt) {
      this.windows.set(key, {
        count: 1,
        resetAt: now + windowMs,
      });
      return;
    }

    if (windowData.count >= maxRequests) {
      throw new TooManyRequestsError('Rate limit exceeded: Too many requests. Please slow down.', {
        key,
        maxRequests,
        resetInMs: windowData.resetAt - now,
      });
    }

    windowData.count += 1;
  }

  /**
   * Enforces dual-tier rate limiting: Socket level (connection tab) + Tenant Application level.
   */
  public assertDualTierRateLimit(
    socket: Socket,
    socketMax: number = config.RATE_LIMIT_SOCKET_MAX,
    appMax: number = config.RATE_LIMIT_APP_MAX,
    socketWindowMs: number = config.RATE_LIMIT_SOCKET_WINDOW_MS,
    appWindowMs: number = config.RATE_LIMIT_APP_WINDOW_MS
  ): void {
    // 1. Per-Socket Connection Limit
    this.checkRateLimit(`socket:${socket.id}`, socketMax, socketWindowMs);

    // 2. Per-Tenant Application Bandwidth Limit
    const appId = socket.data.applicationId as string | undefined;
    if (appId) {
      this.checkRateLimit(`app:${appId}`, appMax, appWindowMs);
    }
  }

  /**
   * Cleanup expired rate limit windows to prevent memory growth.
   */
  public cleanupExpiredWindows(): void {
    const now = Date.now();
    for (const [key, windowData] of this.windows.entries()) {
      if (now > windowData.resetAt) {
        this.windows.delete(key);
      }
    }
  }
}

export const rateLimiterService = new RateLimiterService();
