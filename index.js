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

// Twilio webhook
app.post('/incoming-call', (req, res) => {
  const callSid = req.body.CallSid;
  console.log('📞 Inkommande samtal, CallSid =', callSid);

  const streamUrl = `wss://${process.env.BASE_URL.replace(/^https?:\/\//, '')}/media?CallSid=${callSid}`;

   const twiml = '<?xml version="1.0" encoding="UTF-8"?><Response><Start><Stream url="' + streamUrl + '" track="inbound_audio"/></Start><Say voice="Polly.Swedish">Ge mig bara en sekund, älskling...</Say><Pause length="600"/></Response>';

  

  res.type('text/xml').send(twiml);
});

// HTTP server
const server = http.createServer(app);

// WebSocket
const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const pathname = new URL(req.url, `https://${req.headers.host}`).pathname;

  if (pathname === '/media') {
    console.log('📥 WS-upgrade begärd:', req.url);
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  } else {
    socket.destroy();
  }
});

wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const callSid = url.searchParams.get('CallSid') || 'unknown';
  console.log('🔌 WS-anslutning för CallSid:', callSid);

  startTranscription(ws, callSid);
});

server.listen(PORT, () => {
  console.log(`✅ Amaia backend live på port ${PORT}`);
});
