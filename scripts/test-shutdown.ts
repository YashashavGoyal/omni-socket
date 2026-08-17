import Fastify from 'fastify';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupSocketIO } from '../src/socket';
import { registerGracefulShutdown, triggerGracefulShutdown } from '../src/shared/lifecycle';

async function runShutdownTest() {
  console.log('--- Testing Graceful Shutdown (SIGTERM / SIGINT) ---');

  // Stub process.exit to prevent test runner from exiting early
  const originalExit = process.exit;
  let processExitCalled = false;
  // @ts-ignore
  process.exit = ((code?: number) => {
    processExitCalled = true;
    console.log(`✅ process.exit(${code}) called by shutdown handler`);
  }) as typeof process.exit;

  const server = Fastify({ logger: false });
  const io = setupSocketIO(server);
  registerGracefulShutdown(server, io);

  await server.listen({ port: 4020, host: '127.0.0.1' });

  // Connect client socket
  const client: ClientSocketType = ClientSocket('http://127.0.0.1:4020', {
    auth: {
      applicationId: 'ourtime',
      apiKey: 'ourtime_secret_key_v1',
      userId: 'alice',
    },
    transports: ['websocket'],
  });

  await new Promise<void>((resolve, reject) => {
    client.on('connect', () => {
      console.log('✅ Client connected successfully!');
      resolve();
    });
    client.on('connect_error', (err) => reject(err));
  });

  // Listen for server shutdown notification
  let receivedShutdownEvent = false;
  client.on('server:shutdown', (data) => {
    console.log('✅ Test 1 Passed: Client received server:shutdown notification event:', data);
    receivedShutdownEvent = true;
  });

  // Trigger SIGTERM signal
  console.log('⚡ Triggering Graceful Shutdown...');
  await triggerGracefulShutdown('SIGTERM');

  // Disconnect client socket
  client.disconnect();

  process.exit = originalExit;

  if (receivedShutdownEvent && processExitCalled) {
    console.log('✅ Graceful Shutdown tests completed successfully!');
    process.exit(0);
  } else {
    console.error(`❌ Test Failed: receivedShutdownEvent=${receivedShutdownEvent}, processExitCalled=${processExitCalled}`);
    process.exit(1);
  }
}

runShutdownTest().catch((err) => {
  console.error('❌ Shutdown Test Error:', err);
  process.exit(1);
});
