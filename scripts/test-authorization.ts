import { authorizationService } from '../src/modules/auth/authorization.service';
import { ForbiddenError } from '../src/shared/errors';

async function testAuthorization() {
  console.log('--- Testing Authorization Engine & Tenant Isolation ---');

  // Mock Socket authenticated for 'ourtime'
  const mockSocketAppA: any = {
    id: 'sock_appA_123',
    data: {
      applicationId: 'ourtime',
      userId: 'alice',
    },
  };

  // Mock Socket authenticated for 'demo-chat'
  const mockSocketAppB: any = {
    id: 'sock_appB_456',
    data: {
      applicationId: 'demo-chat',
      userId: 'bob',
    },
  };

  // Test 1: App A accesses App A room (Allowed ✅)
  const scopedRoomKey = authorizationService.assertRoomAccess(mockSocketAppA, 'meeting-room-1');
  console.log('✅ Test 1 Passed: Authorized App A room key:', scopedRoomKey); // "ourtime:meeting-room-1"

  // Test 2: App B accesses App B room (Allowed ✅)
  const scopedRoomKeyB = authorizationService.assertRoomAccess(mockSocketAppB, 'chat-room-1');
  console.log('✅ Test 2 Passed: Authorized App B room key:', scopedRoomKeyB); // "demo-chat:chat-room-1"

  // Test 3: Cross-Tenant Access Tampering (App A tries to access App B room) (Rejected ❌)
  try {
    authorizationService.assertRoomAccess(mockSocketAppA, 'demo-chat:secret-room');
    console.error('❌ Test 3 Failed: Cross-tenant access was not blocked!');
  } catch (error) {
    if (error instanceof ForbiddenError) {
      console.log('✅ Test 3 Passed: Cross-tenant access blocked correctly:', error.message, error.toJSON());
    } else {
      console.error('❌ Test 3 Failed: Unexpected error type:', error);
    }
  }

  console.log('✅ All Authorization tests completed successfully!');
}

testAuthorization();
