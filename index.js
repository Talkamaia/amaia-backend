console.log('=== LOADED *NY* INDEX.JS', new Date().toISOString());
/**
 * index.js – Amaia-backend
 * Express + Twilio TwiML + WebSocket‐server för telefonrösten
 * Chatten (/chat) använder samma handleChat som tidigare.
 */
require('dotenv').config();

const express   = require('express');
const http      = require('http');
const { twiml: { VoiceResponse } } = require('twilio');

const { startMediaServer } = require('./mediaServer');
const { handleChat }       = require('./src/chatHandler');   // <-- DIN gamla chatt‐logik

/* ---------- Express-app ---------- */
const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

/* --- REST: Chat-endpoint (fungerar som innan) --- */
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

/* --- Liten health-check (för Render “Keep Alive”) --- */
app.get('/health', (_, res) => res.send('OK'));

/* --- Twilio: inkommande samtal → öppna bidirectional stream --- */
app.post('/incoming-call', (_, res) => {
  const vr = new VoiceResponse();

  // Bygg wss://-URL automatiskt från PUBLIC_DOMAIN
  const wssUrl = process.env.PUBLIC_DOMAIN
    .replace(/^https?:/, 'wss:')          // https -> wss
    .replace(/\/$/, '') + '/media';       // lägg till /media

  vr.connect().stream({
    url:        wssUrl,
    track:      'both',                   // två-vägs-stream
    contentType:'audio/l16;rate=16000'    // PCM 16 kHz = rent för ElevenLabs
  });

  // (Ingen extra <Say> här – Amaia pratar direkt via stream)
  res.type('text/xml').send(vr.toString());
});

/* ---------- Starta HTTP-server + WebSocket-MediaServer ---------- */
const server = http.createServer(app);
startMediaServer(server);                 // ← startar Twilio-Media WS

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🎧 MediaServer kör');
  console.log(`🚀 Amaia backend live på ${PORT}`);
});
