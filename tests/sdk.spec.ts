import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import Fastify, { FastifyInstance } from 'fastify';
import { setupSocketIO } from '../src/socket';
import { registerHealthRoutes } from '../src/api/health/health.routes';
import { OmniSocketClient } from '../src/sdk/omni-client';
import { applicationService } from '../src/services/application/application.service';

describe('Lightweight Developer Client SDK (OmniSocketClient)', () => {
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
      name: 'SDK Test App',
    });
    appId = reg.record.applicationId;
    apiKey = reg.apiKey;
  });

  afterAll(async () => {
    await server.close();
  });

  it('should connect, join room, update presence, and broadcast using OmniSocketClient SDK', async () => {
    const clientA = new OmniSocketClient({
      url: `http://127.0.0.1:${port}`,
      applicationId: appId,
      apiKey: apiKey,
      userId: 'sdk_alice',
      autoHeartbeat: false,
    });

    const clientB = new OmniSocketClient({
      url: `http://127.0.0.1:${port}`,
      applicationId: appId,
      apiKey: apiKey,
      userId: 'sdk_bob',
      autoHeartbeat: false,
    });

    // 1. Connect clients
    await clientA.connect();
    await clientB.connect();

    expect(clientA.isConnected()).toBe(true);
    expect(clientB.isConnected()).toBe(true);

    // 2. Join room
    const joinResA = await clientA.joinRoom('sdk-room-1');
    const joinResB = await clientB.joinRoom('sdk-room-1');

    expect(joinResA.status).toBe('success');
    expect(joinResB.status).toBe('success');

    // 3. Register listener on Client B BEFORE broadcasting
    const broadcastPromise = new Promise<{ sdp: string }>((resolve) => {
      clientB.on('signal:webrtc_offer', (data: { sdp: string }) => {
        resolve(data);
      });
    });

    // 4. Client A broadcasts event to room
    await clientA.broadcastToRoom('sdk-room-1', 'signal:webrtc_offer', { sdp: 'v=0...' });

    const broadcastData = await broadcastPromise;
    expect(broadcastData.sdp).toBe('v=0...');

    // 5. Update presence
    const presenceRes = await clientA.updatePresence('sdk-room-1', 'busy', 'In a call');
    expect(presenceRes.status).toBe('success');

    // 6. Ping heartbeat
    const pingRes = await clientA.ping();
    expect(pingRes.status).toBe('success');

    // Clean disconnect
    clientA.disconnect();
    clientB.disconnect();

    expect(clientA.isConnected()).toBe(false);
    expect(clientB.isConnected()).toBe(false);
  });

  it('should support custom event routing via emitCustomEvent, emitToUser, and emitToApp', async () => {
    const clientSender = new OmniSocketClient({
      url: `http://127.0.0.1:${port}`,
      applicationId: appId,
      apiKey: apiKey,
      userId: 'sender_user',
      autoHeartbeat: false,
    });

    const clientReceiver = new OmniSocketClient({
      url: `http://127.0.0.1:${port}`,
      applicationId: appId,
      apiKey: apiKey,
      userId: 'target_user',
      autoHeartbeat: false,
    });

    await clientSender.connect();
    await clientReceiver.connect();

    // Register custom event listener on receiver
    const userEventPromise = new Promise<any>((resolve) => {
      clientReceiver.on('direct:message', (data: any) => {
        resolve(data);
      });
    });

    // Emit custom event targeted to user
    const emitRes = await clientSender.emitToUser('target_user', 'direct:message', { text: 'Hello Bob!' });
    expect(emitRes.status).toBe('success');

    const routedMessage = await userEventPromise;
    expect(routedMessage.payload).toEqual({ text: 'Hello Bob!' });
    expect(routedMessage.sender.userId).toBe('sender_user');

    clientSender.disconnect();
    clientReceiver.disconnect();
  });
});
