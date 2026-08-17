import { auditLogger } from '../src/shared/logger/audit-logger';

async function runObservabilityTests() {
  console.log('--- Testing Structured Observability & Audit Logging ---');

  const correlationId = auditLogger.generateCorrelationId();
  console.log('✅ Generated Correlation ID:', correlationId);

  const startTime = performance.now();
  await new Promise((r) => setTimeout(r, 15));
  const durationMs = performance.now() - startTime;

  auditLogger.log({
    correlationId,
    applicationId: 'ourtime',
    socketId: 'sock_test_999',
    userId: 'alice',
    action: 'room:join',
    status: 'SUCCESS',
    durationMs,
    details: { roomId: 'call-101' },
  });

  auditLogger.log({
    applicationId: 'ourtime',
    socketId: 'sock_test_999',
    userId: 'bob',
    action: 'auth:handshake',
    status: 'FAILURE',
    details: { reason: 'Invalid API Key' },
  });

  console.log('✅ Observability & Audit Logging tests completed successfully!');
  process.exit(0);
}

runObservabilityTests().catch((err) => {
  console.error('❌ Test Failed:', err);
  process.exit(1);
});
