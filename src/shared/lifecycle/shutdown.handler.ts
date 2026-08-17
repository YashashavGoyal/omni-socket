import { FastifyInstance } from 'fastify';
import { Server as SocketIOServer } from 'socket.io';
import { auditLogger } from '../logger/audit-logger';

let shutdownHandlerInstance: ((signal: string) => Promise<void>) | null = null;

export function registerGracefulShutdown(server: FastifyInstance, io: SocketIOServer): void {
  let isShuttingDown = false;

  const handleShutdown = async (signal: string) => {
    if (isShuttingDown) return;
    isShuttingDown = true;

    auditLogger.log({
      action: 'server:shutdown_initiated',
      status: 'SUCCESS',
      details: { signal, message: `Received ${signal}. Initiating graceful shutdown...` },
    });

    // Enforce a hard fallback timeout (10 seconds)
    const forceExitTimer = setTimeout(() => {
      auditLogger.log({
        action: 'server:shutdown_forced',
        status: 'FAILURE',
        details: { message: 'Graceful shutdown timed out after 10s. Forcing exit.' },
      });
      process.exit(1);
    }, 10000);

    try {
      // 1. Notify active socket connections
      io.emit('server:shutdown', {
        status: 'shutdown',
        message: 'Server is shutting down. Please reconnect to another node.',
        timestamp: new Date().toISOString(),
      });

      // Brief 100ms delay to allow network sockets to flush the event payload to clients
      await new Promise((resolve) => setTimeout(resolve, 100));

      // 2. Disconnect all connected sockets and close Socket.IO server
      io.disconnectSockets(true);
      await new Promise<void>((resolve) => {
        io.close(() => {
          resolve();
        });
      });

      // 3. Stop Fastify HTTP server from accepting new connections
      await server.close();

      clearTimeout(forceExitTimer);

      auditLogger.log({
        action: 'server:shutdown_completed',
        status: 'SUCCESS',
        details: { message: 'Server shutdown completed gracefully.' },
      });

      process.exit(0);
    } catch (error) {
      clearTimeout(forceExitTimer);
      auditLogger.log({
        action: 'server:shutdown_error',
        status: 'FAILURE',
        details: { error: error instanceof Error ? error.message : String(error) },
      });
      process.exit(1);
    }
  };

  shutdownHandlerInstance = handleShutdown;

  // Register OS process signal listeners
  process.on('SIGTERM', () => handleShutdown('SIGTERM'));
  process.on('SIGINT', () => handleShutdown('SIGINT'));

  // Global uncaught exception handlers
  process.on('uncaughtException', (err) => {
    auditLogger.log({
      action: 'process:uncaught_exception',
      status: 'FAILURE',
      details: { error: err.message, stack: err.stack },
    });
    handleShutdown('uncaughtException');
  });

  process.on('unhandledRejection', (reason) => {
    auditLogger.log({
      action: 'process:unhandled_rejection',
      status: 'FAILURE',
      details: { reason: reason instanceof Error ? reason.message : String(reason) },
    });
    handleShutdown('unhandledRejection');
  });
}

/**
 * Manually trigger graceful shutdown (useful for programmatically initiating shutdown or testing).
 */
export async function triggerGracefulShutdown(signal: string = 'SIGTERM'): Promise<void> {
  if (shutdownHandlerInstance) {
    await shutdownHandlerInstance(signal);
  }
}
