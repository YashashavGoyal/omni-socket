import { io } from 'socket.io-client';
import Fastify from 'fastify';
import { setupSocketIO } from '../src/socket';

const URL = 'http://127.0.0.1:4008';

async function runEventTests() {
  console.log('--- Testing Generic Event Transport Router ---');

  const server = Fastify({ logger: false });
  setupSocketIO(server);
  await server.listen({ port: 4008, host: '127.0.0.1' });

  // Client 1 (Alice - ourtime - Phone)
  const alicePhone = io(URL, {
    transports: ['websocket'],
    auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'alice' },
  });

  // Client 2 (Alice - ourtime - Laptop)
  const aliceLaptop = io(URL, {
    transports: ['websocket'],
    auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'alice' },
  });

  // Client 3 (Bob - ourtime)
  const bobClient = io(URL, {
    transports: ['websocket'],
    auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'bob' },
  });

  await Promise.all([
    new Promise<void>((resolve) => alicePhone.on('connect', resolve)),
    new Promise<void>((resolve) => aliceLaptop.on('connect', resolve)),
    new Promise<void>((resolve) => bobClient.on('connect', resolve)),
  ]);

  console.log('✅ All 3 test clients connected successfully!');

  // Setup listeners
  let receivedCount = 0;
  const userRoutePromise = new Promise<void>((resolve) => {
    const checkReceived = (device: string, data: any) => {
      console.log(`✅ Test 1 Passed: Alice's ${device} received routed user event from Bob:`, data.payload);
      receivedCount++;
      if (receivedCount === 2) resolve();
    };

    alicePhone.on('direct:notification', (data) => checkReceived('Phone', data));
    aliceLaptop.on('direct:notification', (data) => checkReceived('Laptop', data));
  });

  // Bob emits to user 'alice'
  bobClient.emit('event:emit', {
    targetType: 'user',
    targetId: 'alice',
    eventName: 'direct:notification',
    payload: { title: 'Incoming Call', caller: 'bob' },
  });

  await userRoutePromise;

  alicePhone.disconnect();
  aliceLaptop.disconnect();
  bobClient.disconnect();
  await server.close();

  console.log('✅ All Event Transport tests completed successfully!');
  process.exit(0);
}

runEventTests().catch((err) => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
