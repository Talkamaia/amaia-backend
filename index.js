const express = require('express');
const { twiml: { VoiceResponse } } = require('twilio');
const WebSocket = require('ws');

const app = express();
app.use(express.urlencoded({ extended: false }));

// ===== Inkommande samtal =====
app.post('/incoming-call', (req, res) => {
  const twiml = new VoiceResponse();

  twiml.say({ language: 'sv-SE' }, 'Ge mig bara en sekund, älskling...');

  const connect = twiml.connect();
  connect.stream({
    url: 'wss://amaia-backend-1.onrender.com/media',
    bidirectional: true
  });

  res.type('text/xml').send(twiml.toString());
});

// ===== Starta HTTP-servern (EN gång) =====
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('Amaia backend lyssnar på', PORT);

  if (process.env.ELEVEN_API_KEY) {
    const tail = process.env.ELEVEN_API_KEY.slice(-4);
    console.log(`🔑 ElevenLabs-nyckel laddad (…${tail})`);
  } else {
    console.log('⚠️  Ingen ELEVEN_API_KEY i env');
  }
});

// ===== WebSocket för Twilio Media Streams =====
const wss = new WebSocket.Server({ server, path: '/media' });

wss.on('connection', ws => {
  console.log('🔗 Twilio WebSocket ansluten');

  ws.on('ping', () => ws.pong());
  ws.on('message', () => { /* TODO: STT → GPT → TTS */ });
  ws.on('close', () => console.log('🚪 WebSocket stängd'));
});
