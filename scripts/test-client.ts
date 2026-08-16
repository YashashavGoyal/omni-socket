import { io } from 'socket.io-client';

const URL = 'http://localhost:4000';
console.log(`Connecting test client to ${URL}...`);

const socket = io(URL, {
    transports: ['websocket'],
});

socket.on('connect', () => {
    console.log(`✅ Test client connected successfully! Socket ID: ${socket.id}`);

    setTimeout(() => {
        console.log('Disconnecting test client...');
        socket.disconnect();
        process.exit(0);
    }, 1000);
});

socket.on('connect_error', (err) => {
    console.error('❌ Connection error:', err.message);
    process.exit(1);
});
