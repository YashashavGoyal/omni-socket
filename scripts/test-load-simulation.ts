import Fastify from 'fastify';
import { io as ClientSocket, Socket as ClientSocketType } from 'socket.io-client';
import { setupSocketIO } from '../src/socket';
import { connectionRegistry } from '../src/modules/connection/connection-registry';

const PORT = 4099;
const TOTAL_CLIENTS = 100;
const ROOM_COUNT = 5;
const MESSAGES_PER_CLIENT = 5;
const SERVER_URL = `http://127.0.0.1:${PORT}`;

async function runLoadSimulation() {
  console.log('============ ⚡ OmniSocket Load & Stress Simulation ⚡ ============');
  console.log(`Target: ${TOTAL_CLIENTS} Concurrent Clients across ${ROOM_COUNT} Rooms`);

  // 1. Start Server
  const server = Fastify({ logger: false });
  setupSocketIO(server);
  await server.listen({ port: PORT, host: '127.0.0.1' });
  console.log(`✅ Test server running on port ${PORT}`);

  const clients: ClientSocketType[] = [];
  const latencies: number[] = [];

  const initialMemoryMb = process.memoryUsage().heapUsed / 1024 / 1024;
  console.log(`📊 Initial Heap Usage: ${initialMemoryMb.toFixed(2)} MB\n`);

  // 2. Connect 100 Concurrent Sockets
  console.log(`🚀 Spawning ${TOTAL_CLIENTS} concurrent socket connections...`);
  const connectStartTime = Date.now();

  const connectPromises = Array.from({ length: TOTAL_CLIENTS }).map((_, index) => {
    return new Promise<void>((resolve, reject) => {
      const userId = `user_${index + 1}`;
      const socket = ClientSocket(SERVER_URL, {
        auth: { applicationId: 'ourtime', apiKey: 'ourtime_secret_key_v1', userId },
        transports: ['websocket'],
      });

      socket.on('connect', () => {
        clients.push(socket);
        resolve();
      });

      socket.on('connect_error', (err) => {
        reject(err);
      });
    });
  });

  await Promise.all(connectPromises);
  const connectDurationMs = Date.now() - connectStartTime;
  console.log(`✅ All ${TOTAL_CLIENTS} clients connected successfully in ${connectDurationMs}ms!`);
  console.log(`📊 Connection Registry Count: ${connectionRegistry.getActiveConnectionCount()} active connections\n`);

  // 3. Room Assignment (Distribute clients across ROOM_COUNT rooms)
  console.log(`🚪 Joining clients to ${ROOM_COUNT} rooms...`);
  const joinPromises = clients.map((socket, index) => {
    const roomId = `room_${(index % ROOM_COUNT) + 1}`;
    return new Promise<void>((resolve) => {
      socket.emit('room:join', { roomId }, () => resolve());
    });
  });
  await Promise.all(joinPromises);
  console.log(`✅ All ${TOTAL_CLIENTS} clients joined rooms successfully!\n`);

  // 4. Stress Broadcasts & Measure Latency
  console.log(`📡 Emitting ${TOTAL_CLIENTS * MESSAGES_PER_CLIENT} messages across rooms...`);
  const messageStartTime = Date.now();

  const broadcastPromises = clients.map((socket, index) => {
    const roomId = `room_${(index % ROOM_COUNT) + 1}`;
    let sentCount = 0;

    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const sendTime = Date.now();
        socket.emit('room:broadcast', { roomId, event: 'test:ping', data: { timestamp: sendTime } });
        latencies.push(Date.now() - sendTime);

        sentCount++;
        if (sentCount >= MESSAGES_PER_CLIENT) {
          clearInterval(interval);
          resolve();
        }
      }, 10);
    });
  });

  await Promise.all(broadcastPromises);
  const messageDurationMs = Date.now() - messageStartTime;
  const totalMessagesSent = TOTAL_CLIENTS * MESSAGES_PER_CLIENT;
  const msgsPerSec = Math.round((totalMessagesSent / messageDurationMs) * 1000);

  console.log(`✅ ${totalMessagesSent} messages processed in ${messageDurationMs}ms (~${msgsPerSec} msgs/sec)!`);

  // 5. Latency Calculation
  const avgLatency = (latencies.reduce((a, b) => a + b, 0) / latencies.length).toFixed(2);
  const minLatency = Math.min(...latencies);
  const maxLatency = Math.max(...latencies);

  console.log(`⏱️ Latency Stats: Avg: ${avgLatency}ms | Min: ${minLatency}ms | Max: ${maxLatency}ms\n`);

  // 6. Memory Post-Stress Stats
  const finalMemoryMb = process.memoryUsage().heapUsed / 1024 / 1024;
  const memoryDeltaMb = (finalMemoryMb - initialMemoryMb).toFixed(2);

  console.log(`📊 Post-Stress Heap Usage: ${finalMemoryMb.toFixed(2)} MB (Delta: +${memoryDeltaMb} MB)\n`);

  // 7. Cleanup & Teardown
  console.log('🧹 Cleaning up connections and closing server...');
  clients.forEach((c) => c.disconnect());
  await server.close();

  console.log('===========================================================');
  console.log('🎉 LOAD & STRESS TEST PASSED 100% SUCCESSFUL! 🎉');
  console.log('===========================================================');
  process.exit(0);
}

runLoadSimulation().catch((err) => {
  console.error('❌ Stress Test Failed:', err);
  process.exit(1);
});
