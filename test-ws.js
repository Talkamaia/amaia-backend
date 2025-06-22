const WebSocket = require('ws');
const ws = new WebSocket('wss://amaia-backend-1.onrender.com/media?CallSid=test123');

ws.on('open', () => {
  console.log('✅ WebSocket connected!');
});

ws.on('error', (error) => {
  console.error('❌ WebSocket error:', error);
});
