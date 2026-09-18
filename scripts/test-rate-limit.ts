import { rateLimiterService } from '../src/middleware';
import { TooManyRequestsError } from '../src/shared/errors';

async function runRateLimiterTests() {
  console.log('--- Testing Safety & Rate Limiter Subsystem ---');

  const mockSocketId = 'sock_rate_limit_test_123';
  const maxAllowed = 5;

  // Simulate 5 allowed requests
  for (let i = 1; i <= maxAllowed; i++) {
    rateLimiterService.checkRateLimit(mockSocketId, maxAllowed, 5000);
    console.log(`✅ Request ${i}/${maxAllowed} permitted.`);
  }

  // 6th Request should throw TooManyRequestsError
  try {
    rateLimiterService.checkRateLimit(mockSocketId, maxAllowed, 5000);
    console.error('❌ Test Failed: Rate limit did not block 6th request!');
  } catch (error) {
    if (error instanceof TooManyRequestsError) {
      console.log('✅ Rate limit blocked 6th request correctly:', error.message, error.toJSON());
    } else {
      console.error('❌ Test Failed: Unexpected error type:', error);
    }
  }

  console.log('✅ Safety & Rate Limiter tests completed successfully!');
}

runRateLimiterTests();
