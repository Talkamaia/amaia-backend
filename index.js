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

// Webhook för inkommande samtal
app.post('/incoming-call', (req, res) => {
  const callSid = req.body.CallSid;
  console.log('📞 Inkommande samtal, CallSid =', callSid);

  const streamUrl = `wss://${process.env.BASE_URL.replace(/^https?:\/\//, '')}/media?CallSid=${callSid}`;

  const twiml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Start>
        <Stream url="${streamUrl}" track="inbound_audio"/>
      </Start>
      <Say voice="Polly.Swedish">Ge mig bara en sekund, älskling...</Say>
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

  const pathname = new
