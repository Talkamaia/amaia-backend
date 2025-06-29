const express = require('express');
const bodyParser = require('body-parser');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// === Twilio webhook: tar emot inkommande samtal ===
app.post('/incoming-call', (req, res) => {
  console.log('📞 Twilio webhook mottagen!');

  const response = `
    <Response>
      <Start>
        <Stream url="wss://${req.headers.host}/media" track="inbound_track" />
      </Start>
      <Say voice="Polly.Joanna" language="sv-SE">Ett ögonblick älskling, jag kommer snart...</Say>
      <Pause length="90" />
    </Response>
  `;

  res.set('Content-Type', 'text/xml');
  res.send(response);
});

// === WebSocket-server för Twilio Media Streams ===
const server = app.listen(PORT, () => {
  console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);
});

const wss = new WebSocket.Server({ server, path: '/media' });

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.event === 'start') {
        console.log('🚀 Stream startad');
      } else if (data.event === 'media') {
        // Media bytes kommer här
        // console.log('🎙️ Media bytes mottagna');
      } else if (data.event === 'stop') {
        console.log('🛑 Stream stoppad');
      }
    } catch (err) {
      console.error('❌ Fel vid tolkning av media-meddelande:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('🔒 Klient frånkopplad');
  });
});
