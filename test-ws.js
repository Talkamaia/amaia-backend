const WebSocket = require('ws');

const url = 'wss://amaia-backend-1.onrender.com/media?CallSid=test123';
console.log(`🔌 Försöker ansluta till ${url}...`);

const ws = new WebSocket(url);

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
});

ws.on('message', (data) => {
  console.log('📩 Meddelande mottaget:', data.toString());
});

ws.on('error', (err) => {
  console.error('❌ WebSocket fel:', err.message);
});

ws.on('close', () => {
  console.log('❎ WebSocket stängd');
});
