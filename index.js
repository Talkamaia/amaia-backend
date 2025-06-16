const express = require('express');
const { twiml: { VoiceResponse } } = require('twilio');
const WebSocket = require('ws');

const app = express();
app.use(express.urlencoded({ extended: false }));

// ===== Inkommande samtal =====
app.post('/incoming-call', (req, res) => {
  const twiml = new VoiceResponse();

  twiml.say('Ge mig bara en sekund, älskling...');

  // Blockerande stream som håller linjen öppen
  const connect = twiml.connect();
  connect.stream({
    url: 'wss://amaia-backend-1.onrender.com/media',
    bidirectional: true
  });

  res.type('text/xml').send(twiml.toString());
});

// ===== Starta HTTP-servern (EN gång!) =====
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () =>
  console.log('Amaia backend lyssnar på', PORT)
);

// ===== WebSocket för Twilio Media Streams =====
const wss = new WebSocket.Server({ server, path: '/media' });

wss.on('connection', ws => {
  console.log('🔗 Twilio WebSocket ansluten');

  // Håll linjen vid liv
  ws.on('ping', () => ws.pong());

  // TODO: här stoppar du in STT → GPT → TTS
  ws.on('message', () => { /* inget ännu */ });

  ws.on('close', () => console.log('🚪 WebSocket stängd'));
});
