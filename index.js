/**
 * index.js – Amaia-backend
 * • /chat          – textchatt med GPT
 * • /incoming-call – startar Media Stream via WebSocket
 * • startMediaServer – hanterar röstflöde med Deepgram, GPT & ElevenLabs
 */

require('dotenv').config();
const express = require('express');
const http = require('http');
const { twiml: { VoiceResponse } } = require('twilio');

const { startMediaServer } = require('./mediaServer');
const { handleChat } = require('./src/chatHandler');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* === REST: Chat ================================================= */
app.post('/chat', async (req, res) => {
  try {
    const { phone, message } = req.body;
    const result = await handleChat(phone, message);
    return res.json(result);
  } catch (err) {
    console.error('❌ /chat error', err);
    return res.status(500).json({ error: 'chat failed' });
  }
});

/* === Health-ping för Render ==================================== */
app.get('/health', (_, res) => res.send('OK'));

/* === Inkommande samtal från Twilio ============================= */
app.post('/incoming-call', (req, res) => {
  const vr = new VoiceResponse();

  const base = process.env.PUBLIC_DOMAIN || `https://${req.headers.host}`;
  const wss = base.replace(/^https?/, 'wss').replace(/\/$/, '') + '/media';

  console.log('📞 Twilio call in – skickar WebSocket till:', wss);

  // Aktivera Media Stream via <Start><Stream>
  vr.start().stream({
    url: wss,
    track: 'inbound_audio' // ← rätt typ för Media Stream
  });

  // Placeholder-tal från Amaia
  vr.say({ voice: 'Polly.Swedish' }, 'Ge mig bara en sekund, älskling...');

  res.type('text/xml').send(vr.toString());
});

/* === Starta server + WebSocket ================================= */
const server = http.createServer(app);
startMediaServer(server);

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log('🎧 MediaServer kör');
  console.log('🚀 Amaia backend live på', PORT);
});
