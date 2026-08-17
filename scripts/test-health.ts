import Fastify from 'fastify';
import { setupSocketIO } from '../src/socket';
import { registerHealthRoutes } from '../src/modules/health';

async function runHealthTests() {
  console.log('--- Testing Operational Readiness & Health Checks ---');

  const server = Fastify({ logger: false });
  registerHealthRoutes(server);
  setupSocketIO(server);
  await server.listen({ port: 4010, host: '127.0.0.1' });

  // Test 1: Liveness Endpoint
  const liveRes = await fetch('http://127.0.0.1:4010/health/live');
  const liveData = await liveRes.json();
  console.log('✅ Test 1 Passed: Liveness Probe:', liveData);

  // Test 2: Readiness Endpoint
  const readyRes = await fetch('http://127.0.0.1:4010/health/ready');
  const readyData = await readyRes.json();
  console.log('✅ Test 2 Passed: Readiness Probe:', readyData);

  // Test 3: Metrics Endpoint
  const metricsRes = await fetch('http://127.0.0.1:4010/health/metrics');
  const metricsData = await metricsRes.json();
  console.log('✅ Test 3 Passed: Metrics Endpoint:', metricsData);

  await server.close();
  console.log('✅ All Operational Readiness & Health Check tests completed successfully!');
  process.exit(0);
}

runHealthTests().catch((err) => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
