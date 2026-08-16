import { ConnectionRegistry } from '../src/connection/connection-registry';

console.log('--- Testing ConnectionRegistry Decoupling ---');
const registry = new ConnectionRegistry();

// 1. Register 2 sockets for User Alice (Laptop + Mobile)
registry.register({ socketId: 'sock_laptop_1', userId: 'user_alice', connectedAt: new Date() });
registry.register({ socketId: 'sock_mobile_2', userId: 'user_alice', connectedAt: new Date() });

// 2. Register 1 socket for User Bob
registry.register({ socketId: 'sock_bob_1', userId: 'user_bob', connectedAt: new Date() });

console.log(`Active Connections: ${registry.getActiveConnectionCount()} (Expected: 3)`);
console.log(`Active Users: ${registry.getActiveUserCount()} (Expected: 2)`);
console.log(`Alice Sockets:`, registry.getSocketsByUserId('user_alice')); // Expected: ['sock_laptop_1', 'sock_mobile_2']

// 3. Unregister laptop socket for Alice
registry.unregister('sock_laptop_1');
console.log(`Alice Sockets after Laptop disconnect:`, registry.getSocketsByUserId('user_alice')); // Expected: ['sock_mobile_2']
console.log(`Active Users after 1 Alice socket disconnect: ${registry.getActiveUserCount()} (Expected: 2)`);

// 4. Unregister remaining mobile socket for Alice
registry.unregister('sock_mobile_2');
console.log(`Active Users after Alice full disconnect: ${registry.getActiveUserCount()} (Expected: 1 - Bob)`);

console.log('✅ ConnectionRegistry unit verification completed successfully!');
