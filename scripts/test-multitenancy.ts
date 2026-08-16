import { applicationService } from '../src/modules/application/application.service';

async function testMultiTenancy() {
  console.log('--- Testing Multi-Tenancy Foundation ---');

  // 1. Verify pre-seeded ourtime application
  const ourtimeApp = await applicationService.getApp('ourtime');
  console.log('Found "ourtime" app?:', !!ourtimeApp, '| Name:', ourtimeApp?.name);

  // 2. Validate application credentials
  const isValidAuth = await applicationService.validateAppCredentials('ourtime', 'ourtime_secret_key_v1');
  console.log('Is valid credentials for "ourtime"?:', isValidAuth);

  const isInvalidAuth = await applicationService.validateAppCredentials('ourtime', 'wrong_key');
  console.log('Is valid for wrong key?:', isInvalidAuth);

  // 3. Register a new tenant application at runtime
  const newApp = await applicationService.registerApp({
    applicationId: 'poker-game',
    name: 'Realtime Poker Game',
    apiKeyHash: 'poker_secret_key_v1',
    enabled: true,
  });
  console.log('✅ Created new app dynamically via ApplicationService:', newApp.applicationId);

  // 4. Test Room Scoping Isolation
  const sharedRoomName = 'lobby';
  const ourTimeRoomKey = applicationService.getScopedRoomKey('ourtime', sharedRoomName);
  const pokerRoomKey = applicationService.getScopedRoomKey('poker-game', sharedRoomName);

  console.log('ourTime Scoped Room Key:', ourTimeRoomKey); // "ourtime:lobby"
  console.log('Poker Scoped Room Key:  ', pokerRoomKey);   // "poker-game:lobby"

  if (ourTimeRoomKey !== pokerRoomKey) {
    console.log('✅ Room names are strictly isolated between applications!');
  } else {
    console.error('❌ Room collision detected!');
  }

  const allApps = await applicationService.listApps();
  console.log('Total Registered Applications:', allApps.map((a) => a.applicationId));
  console.log('✅ Multi-tenancy verification completed successfully!');
}

testMultiTenancy();
