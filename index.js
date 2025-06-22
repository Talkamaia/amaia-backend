// index.js

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { WebSocketServer } = require('ws');
const { startTranscription } = require('./mediaServer');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 10000;

// Serve audio
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
app.use(bodyParser.urlencoded({ extended: false }));

app.post('/incoming-call', (req, res) => {
  const callSid = req.body.CallSid;
  console.log('📞 Inkommande samtal, CallSid =', callSid);

  const twiml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Say voice="Polly.Swedish">Ge mig bara en sekund, älskling...</Say>
      <Start>
        <Stream url="wss://amaia-backend-1.onrender.com/media?CallSid=${callSid}" track="inbound_audio"/>
      </Start>
      <Pause length="600"/>
    </Response>
  `;

  console.log('🧠 Svarar Twilio med TwiML...');
  res.type('text/xml').send(twiml);
});

// Skapa HTTP-server
const server = http.createServer(app);

// WebSocket-server
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  console.log('📥 WS-upgrade begärd:', req.url);

  const pathname = new URL(req.url, `https://${req.headers.host}`).pathname;

  if (pathname === '/media') {
    console.log('📡 WS-upgrade ACCEPTED to /media');

    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    console.warn('❌ WS-upgrade DENIED – unknown path:', pathname);
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const callSid = url.searchParams.get('CallSid');
  console.log('🔌 WebSocket ansluten för CallSid =', callSid);

  startTranscription(ws, callSid);
});

server.listen(PORT, () => {
  console.log(`✅ Amaia backend live på port ${PORT}`);
});
