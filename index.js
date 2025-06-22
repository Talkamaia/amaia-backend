// index.js

require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const { WebSocketServer } = require('ws');
const { startTranscription } = require('./mediaServer');

const app = express();
const PORT = process.env.PORT || 10000;

// Serve static audio files
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
app.use(bodyParser.urlencoded({ extended: false }));

// Twilio webhook: inkommande samtal
app.post('/incoming-call', (req, res) => {
  const callSid = req.body.CallSid;
  console.log('📞 Inkommande samtal, CallSid =', callSid);

  const twiml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <!-- 1) Hälsa -->
      <Say voice="Polly.Swedish">Ge mig bara en sekund, älskling...</Say>

      <!-- 2) Starta media-strömmen med CallSid i query -->
      <Start>
        <Stream url="wss://${req.headers.host}/media?CallSid=${callSid}" track="inbound_audio"/>
      </Start>

      <!-- 3) Håll luren öppen i upp till 10 minuter -->
      <Pause length="600"/>
    </Response>
  `;
  res.type('text/xml').send(twiml);
});

// Starta HTTP-server
const server = app.listen(PORT, () => {
  console.log(`✅ Amaia backend live på port ${PORT}`);
});

// WebSocket-server för Twilio Media Streams
const wss = new WebSocketServer({ server, path: '/media' });
wss.on('connection', (ws, req) => {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const callSid = url.searchParams.get('CallSid');
  console.log('🔌 WebSocket ansluten för CallSid =', callSid);
  startTranscription(ws, callSid);
});
