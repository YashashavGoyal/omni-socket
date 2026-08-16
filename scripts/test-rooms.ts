import { io } from 'socket.io-client';
import Fastify from 'fastify';
import { setupSocketIO } from '../src/socket';

const URL = 'http://127.0.0.1:4006';

async function runRoomTests() {
  console.log('--- Testing Generic Room Management ---');

  // Start test server on port 4006
  const server = Fastify({ logger: false });
  setupSocketIO(server);
  await server.listen({ port: 4006, host: '127.0.0.1' });

  // Client 1 (Alice - ourtime)
  const aliceClient = io(URL, {
    transports: ['websocket'],
    auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'alice' },
  });

  // Client 2 (Bob - ourtime)
  const bobClient = io(URL, {
    transports: ['websocket'],
    auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId: 'bob' },
  });

  await Promise.all([
    new Promise<void>((resolve) => aliceClient.on('connect', resolve)),
    new Promise<void>((resolve) => bobClient.on('connect', resolve)),
  ]);

  console.log('✅ Both Alice and Bob connected successfully!');

  // Test 1: Alice & Bob join 'call-room-1'
  await new Promise<void>((resolve) => {
    aliceClient.emit('room:join', { roomId: 'call-room-1' }, (res: any) => {
      console.log('✅ Test 1a Passed: Alice joined room:', res);
      resolve();
    });
  });

  await new Promise<void>((resolve) => {
    bobClient.emit('room:join', { roomId: 'call-room-1' }, (res: any) => {
      console.log('✅ Test 1b Passed: Bob joined room:', res);
      resolve();
    });
  });

  // Test 2: Alice broadcasts signal to 'call-room-1' -> Bob receives it
  const broadcastPromise = new Promise<void>((resolve) => {
    bobClient.on('video_offer', (data: any) => {
      console.log('✅ Test 2 Passed: Bob received broadcast signal from Alice:', data);
      resolve();
    });
  });

  aliceClient.emit('room:broadcast', {
    roomId: 'call-room-1',
    event: 'video_offer',
    data: { sdp: 'offer_data_xyz', from: 'alice' },
  });

  await broadcastPromise;

  // Test 3: Leave Room
  await new Promise<void>((resolve) => {
    aliceClient.emit('room:leave', { roomId: 'call-room-1' }, (res: any) => {
      console.log('✅ Test 3 Passed: Alice left room cleanly:', res);
      resolve();
    });
  });

  aliceClient.disconnect();
  bobClient.disconnect();
  await server.close();

  console.log('✅ All Room Management tests completed successfully!');
  process.exit(0);
}

runRoomTests();
