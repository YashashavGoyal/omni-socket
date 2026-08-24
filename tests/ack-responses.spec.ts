import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupSocketIO } from '../src/socket';
import { registerHealthRoutes } from '../src/api/health/health.routes';
import { AckEnvelope } from '../src/shared/responses/ack-response.formatter';
import { applicationService } from '../src/services/application/application.service';

describe('Structured Event ACK & Standardized Response Wrapping Subsystem', () => {
  let server: FastifyInstance;
  let port: number;
  let appId: string;
  let apiKey: string;

  beforeAll(async () => {
    server = Fastify({ logger: false });
    registerHealthRoutes(server);
    setupSocketIO(server);

    await server.listen({ port: 0, host: '127.0.0.1' });
    const address = server.server.address();
    port = typeof address === 'object' && address ? address.port : 0;

    const reg = await applicationService.registerApp({
      name: 'Ack Test App',
    });
    appId = reg.record.applicationId;
    apiKey = reg.apiKey;
  });

  afterAll(async () => {
    await server.close();
  });

  function createAuthenticatedClient(userId: string): ClientSocketType {
    return ClientSocket(`http://127.0.0.1:${port}`, {
      transports: ['websocket'],
      auth: {
        applicationId: appId,
        apiKey: apiKey,
        userId,
      },
    });
  }

  it('should return structured success ACK envelope on room:join', async () => {
    const client = createAuthenticatedClient('ack_user_1');

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        client.emit(
          'room:join',
          { roomId: 'ack-test-room' },
          (ackResponse: AckEnvelope) => {
            try {
              expect(ackResponse.status).toBe('success');
              expect(ackResponse.timestamp).toBeDefined();
              expect(ackResponse.data).toEqual({
                event: 'room:joined',
                roomId: 'ack-test-room',
                scopedRoomKey: `${appId}:ack-test-room`,
              });
              client.disconnect();
              resolve();
            } catch (err) {
              client.disconnect();
              reject(err);
            }
          }
        );
      });

      client.on('connect_error', (err) => reject(err));
    });
  });

  it('should return structured error ACK envelope when validation fails', async () => {
    const client = createAuthenticatedClient('ack_user_2');

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        client.emit(
          'room:join',
          { roomId: '' }, // Invalid room ID triggers validation error
          (ackResponse: AckEnvelope) => {
            try {
              expect(ackResponse.status).toBe('error');
              expect(ackResponse.code).toBe('VALIDATION_ERROR');
              expect(ackResponse.message).toBeDefined();
              expect(ackResponse.timestamp).toBeDefined();
              client.disconnect();
              resolve();
            } catch (err) {
              client.disconnect();
              reject(err);
            }
          }
        );
      });

      client.on('connect_error', (err) => reject(err));
    });
  });

  it('should return structured ACK envelope on presence:ping', async () => {
    const client = createAuthenticatedClient('ack_user_3');

    await new Promise<void>((resolve, reject) => {
      client.on('connect', () => {
        client.emit('presence:ping', (ackResponse: AckEnvelope) => {
          try {
            expect(ackResponse.status).toBe('success');
            expect(ackResponse.data.event).toBe('presence:pong');
            expect(ackResponse.data.lastSeenAt).toBeDefined();
            client.disconnect();
            resolve();
          } catch (err) {
            client.disconnect();
            reject(err);
          }
        });
      });

      client.on('connect_error', (err) => reject(err));
    });
  });
});
