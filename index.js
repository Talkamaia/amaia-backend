/**
 * index.js – Amaia-backend
 * • /chat  – fortsätter att använda din gamla handleChat-logik
 * • /incoming-call – öppnar bidirektionell WebSocket-ström (16 kHz PCM)
 * • startMediaServer – hanterar Twilio ↔ Deepgram ↔ GPT ↔ ElevenLabs
 */

require('dotenv').config();

const express  = require('express');
const http     = require('http');
const { twiml: { VoiceResponse } } = require('twilio');

const { startMediaServer } = require('./mediaServer');
const { handleChat }       = require('./src/chatHandler'); // ← din befintliga chat-modul

/* ---------- Express-app ---------- */
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* === REST: Chat (oförändrad) =================================== */
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

/* === Health-ping (Render’s keep-alive) ========================= */
app.get('/health', (_, res) => res.send('OK'));

/* === Inkommande samtal från Twilio ============================= */
app.post('/incoming-call', (_, res) => {
  const vr  = new VoiceResponse();

  // Bygg WebSocket-URL automatiskt från PUBLIC_DOMAIN
  const wss = process.env.PUBLIC_DOMAIN
    .replace(/^https?/, 'wss')         // https -> wss
    .replace(/\/$/, '') + '/media';    // lägg till /media-path

 vr.connect().stream({
  url: wss,
  track: 'both',                      // ← rätt värde
  'content-type': 'audio/l16;rate=16000'
});
  res.type('text/xml').send(vr.toString());
});

/* ---------- Starta HTTP-server + MediaServer-WS ---------------- */
const server = http.createServer(app);
startMediaServer(server);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🎧 MediaServer kör');          // ska synas i Render-logg
  console.log('🚀 Amaia backend live på', PORT);
});
