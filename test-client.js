import WebSocket from 'ws';

const ws = new WebSocket('wss://amaia-backend-3w9f.onrender.com/media');

ws.on('open', () => {
  console.log('✅ WebSocket ansluten!');
  ws.send(JSON.stringify({ event: 'start', streamSid: 'test', media: { payload: '' } }));
});

ws.on('message', (msg) => {
  console.log('📩 Svar från servern:', msg.toString());
});

ws.on('close', () => {
  console.log('❌ WebSocket stängdes');
});

ws.on('error', (err) => {
  console.error('🔥 WebSocket fel:', err.message);
});
