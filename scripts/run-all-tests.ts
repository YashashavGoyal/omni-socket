import { execSync } from 'child_process';

const testSuites = [
  { name: 'Auth & Messaging Router', script: 'scripts/test-events.ts' },
  { name: 'Dual-Tier Rate Limiting', script: 'scripts/test-rate-limit.ts' },
  { name: 'Presence & Heartbeat Engine', script: 'scripts/test-presence.ts' },
  { name: 'Structured Observability & Audit Logging', script: 'scripts/test-observability.ts' },
  { name: 'Operational Readiness & Health Checks', script: 'scripts/test-health.ts' },
  { name: 'Graceful Shutdown (SIGTERM / SIGINT)', script: 'scripts/test-shutdown.ts' },
];

async function runMasterTestSuite() {
  console.log('============ 🚀 OmniSocket Master Test Suite 🚀 ============');
  console.log(`Executing ${testSuites.length} subsystem test suites...\n`);

  let passedCount = 0;
  let failedCount = 0;
  const startTime = Date.now();

  for (const suite of testSuites) {
    console.log(`▶ Running Suite: [ ${suite.name} ] (${suite.script})`);
    try {
      execSync(`npx tsx ${suite.script}`, { stdio: 'inherit' });
      console.log(`✅ Suite Passed: ${suite.name}\n`);
      passedCount++;
    } catch (error) {
      console.error(`❌ Suite Failed: ${suite.name}\n`);
      failedCount++;
    }
  }

  const totalTimeSeconds = Number(((Date.now() - startTime) / 1000).toFixed(2));

  console.log('===========================================================');
  console.log(`SUMMARY: Total: ${testSuites.length} | Passed: ${passedCount} | Failed: ${failedCount} | Time: ${totalTimeSeconds}s`);
  console.log('===========================================================');

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMasterTestSuite();
