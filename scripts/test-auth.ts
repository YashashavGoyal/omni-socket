import { io } from 'socket.io-client';
import Fastify from 'fastify';
import { setupSocketIO } from '../src/socket';

const URL = 'http://127.0.0.1:4005';

async function runAuthTests() {
  console.log('--- Testing Authentication Middleware ---');

  // Start temporary test server on port 4005
  const server = Fastify({ logger: false });
  setupSocketIO(server);
  await server.listen({ port: 4005, host: '127.0.0.1' });

  // Test 1: Valid Credentials
  const validClient = io(URL, {
    transports: ['websocket'],
    auth: {
      applicationId: 'ourtime',
      apiKey: 'ourtime_secret_key_v1',
      userId: 'alice_123',
    },
  });

  await new Promise<void>((resolve) => {
    validClient.on('connect', () => {
      console.log('✅ Test 1 Passed: Valid client connected successfully! Socket ID:', validClient.id);
      validClient.disconnect();
      resolve();
    });

    validClient.on('connect_error', (err) => {
      console.error('❌ Test 1 Failed:', err.message);
      resolve();
    });
  });

  // Test 2: Invalid API Key
  const invalidClient = io(URL, {
    transports: ['websocket'],
    auth: {
      applicationId: 'ourtime',
      apiKey: 'wrong_secret_key',
    },
  });

  await new Promise<void>((resolve) => {
    invalidClient.on('connect', () => {
      console.error('❌ Test 2 Failed: Invalid client connected unexpectedly!');
      invalidClient.disconnect();
      resolve();
    });

    invalidClient.on('connect_error', (err) => {
      console.log('✅ Test 2 Passed: Invalid credentials rejected correctly:', err.message);
      invalidClient.disconnect();
      resolve();
    });
  });

  // Test 3: Missing Credentials
  const missingClient = io(URL, {
    transports: ['websocket'],
    auth: {},
  });

  await new Promise<void>((resolve) => {
    missingClient.on('connect_error', (err) => {
      console.log('✅ Test 3 Passed: Missing credentials rejected correctly:', err.message);
      missingClient.disconnect();
      resolve();
    });
  });

  await server.close();
  console.log('✅ All Authentication tests completed successfully!');
  process.exit(0);
}

runAuthTests();
