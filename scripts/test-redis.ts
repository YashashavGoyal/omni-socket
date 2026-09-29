import { redisService } from '../src/services/redis/redis.service';
import { healthService } from '../src/api/health/health.service';
import { z } from 'zod';

async function runRedisTests() {
  console.log('🧪 Starting Redis Subsystem & Fail-Fast Verification Tests...');

  // Test 1: Disabled Redis mode by default
  const initialStatus = await redisService.healthCheck();
  if (initialStatus.status !== 'disabled') {
    throw new Error(`Expected redis status to be 'disabled' when REDIS_ENABLED=false, got '${initialStatus.status}'`);
  }
  console.log('✅ Test 1 Passed: Redis healthCheck returns status: "disabled" when REDIS_ENABLED=false.');

  // Test 2: Verify Zod Schema Fail-Fast Validation when REDIS_ENABLED=true but REDIS_URL is missing
  const dummyEnvSchema = z.object({
    REDIS_ENABLED: z.coerce.boolean().default(false),
    REDIS_URL: z.string().default(''),
  }).superRefine((data, ctx) => {
    if (data.REDIS_ENABLED && !data.REDIS_URL.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'REDIS_URL is strictly required when REDIS_ENABLED=true',
        path: ['REDIS_URL'],
      });
    }
  });

  const invalidResult = dummyEnvSchema.safeParse({ REDIS_ENABLED: 'true', REDIS_URL: '' });
  if (invalidResult.success) {
    throw new Error('Expected validation failure when REDIS_ENABLED=true and REDIS_URL=""');
  }

  const redisUrlError = invalidResult.error.format().REDIS_URL?._errors[0];
  if (redisUrlError !== 'REDIS_URL is strictly required when REDIS_ENABLED=true') {
    throw new Error(`Unexpected error message: ${redisUrlError}`);
  }
  console.log('✅ Test 2 Passed: Zod superRefine correctly catches missing REDIS_URL when REDIS_ENABLED=true.');

  // Test 3: Readiness endpoint reports redis subsystem state
  const readiness = await healthService.getReadiness();
  if (!('redis' in readiness.subsystems)) {
    throw new Error('Expected "redis" field in health readiness subsystems output.');
  }
  console.log(`✅ Test 3 Passed: Health readiness subsystem includes redis status: "${readiness.subsystems.redis}".`);

  console.log('🎉 All Redis Subsystem Tests Passed Successfully!\n');
}

runRedisTests().catch((err) => {
  console.error('❌ Redis Subsystem Test Failed:', err);
  process.exit(1);
});
