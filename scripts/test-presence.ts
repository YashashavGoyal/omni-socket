import { io } from 'socket.io-client';
import Fastify from 'fastify';
import { setupSocketIO } from '../src/socket';

const URL = 'http://127.0.0.1:4009';

async function runPresenceTests() {
  console.log('--- Testing Presence Engine & Heartbeat Tracking ---');

  const server = Fastify({ logger: false });
  setupSocketIO(server);
  await server.listen({ port: 4009, host: '127.0.0.1' });

  // Client 1 (Alice)
  const aliceClient = io(URL, {
    transports: ['websocket'],
    auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'alice' },
  });

  // Client 2 (Bob)
  const bobClient = io(URL, {
    transports: ['websocket'],
    auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'bob' },
  });

  await Promise.all([
    new Promise<void>((resolve) => aliceClient.on('connect', resolve)),
    new Promise<void>((resolve) => bobClient.on('connect', resolve)),
  ]);

  console.log('✅ Alice and Bob connected successfully!');

  // Both join room 'call-101'
  await Promise.all([
    new Promise<void>((r) => aliceClient.emit('room:join', { roomId: 'call-101' }, r)),
    new Promise<void>((r) => bobClient.emit('room:join', { roomId: 'call-101' }, r)),
  ]);

  // Test 1: Bob receives presence notification when Alice updates status to 'busy' for room 'call-101'
  const presenceChangedPromise = new Promise<void>((resolve) => {
    bobClient.on('presence:changed', (data: any) => {
      if (data.userId === 'alice' && data.status === 'busy') {
        console.log('✅ Test 1 Passed: Bob received Alice room-scoped presence update:', data);
        resolve();
      }
    });
  });

  // Alice updates status to 'busy' scoped to 'call-101'
  aliceClient.emit('presence:update', { status: 'busy', customStatusMessage: 'In a meeting', roomId: 'call-101' });
  await presenceChangedPromise;

  // Test 2: Alice sends heartbeat ping
  const pingPromise = new Promise<void>((resolve) => {
    aliceClient.emit('presence:ping', (res: any) => {
      console.log('✅ Test 2 Passed: Alice heartbeat ping acknowledged:', res);
      resolve();
    });
  });
  await pingPromise;

  aliceClient.disconnect();
  bobClient.disconnect();
  await server.close();

  console.log('✅ All Presence tests completed successfully!');
  process.exit(0);
}

runPresenceTests().catch((err) => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
