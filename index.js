// Amaia backend – Twilio Media Streams ⇄ ElevenLabs (u-law 8 kHz)
// ---------------------------------------------------------------
// ENV (på Render):
//   ELEVEN_API_KEY   – din Eleven-nyckel
//   ELEVEN_VOICE_ID  – temporär svensk röst
// När Amaia-klonen är “Ready” byter du bara ELEVEN_VOICE_ID.
// ---------------------------------------------------------------

const express = require('express');
const { twiml: { VoiceResponse } } = require('twilio');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
app.use(express.urlencoded({ extended: false }));

// ========== Inkommande samtal ===============================================
app.post('/incoming-call', (_, res) => {
  const twiml = new VoiceResponse();

  // ⚠️ Inget <Say> – vi sänder Eleven-ljud via Media Stream i stället
  const connect = twiml.connect();
  connect.stream({
    url: 'wss://amaia-backend-1.onrender.com/media',
    bidirectional: true
  });

  res.type('text/xml').send(twiml.toString());
});

// ========== HTTP-server ======================================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('Amaia backend lyssnar på', PORT);
  console.log('🔑 Key …' + (process.env.ELEVEN_API_KEY || '').slice(-4));
  console.log('🎙️ Voice', process.env.ELEVEN_VOICE_ID || 'MISSING');
});

// ========== WebSocket / Twilio Media Streams ================================
const wss = new WebSocket.Server({ server, path: '/media' });

wss.on('connection', (ws) => {
  console.log('🔗 WebSocket ansluten');
  let streamSid = null;
  let greeted   = false;

  ws.on('message', async (buf) => {
    const msg = JSON.parse(buf);

    if (msg.event === 'start') {
      streamSid = msg.streamSid;
      console.log('🆔 streamSid', streamSid);
    }

    if (!greeted && streamSid) {
      greeted = true;
      await sendGreeting(ws, streamSid).catch(console.error);
    }
  });

  ws.on('ping', () => ws.pong());
  ws.on('close', () => console.log('🚪 WebSocket stängd'));
});

// ========== Skicka hälsning (u-law 8 kHz) ====================================
async function sendGreeting(ws, streamSid) {
  try {
    const apiKey  = process.env.ELEVEN_API_KEY;
    const voiceId = process.env.ELEVEN_VOICE_ID;
    if (!apiKey || !voiceId) throw new Error('Saknar Eleven-env');

    // 1 Hämta WAV (u-law 8 kHz) direkt från ElevenLabs
    const { data: wavBuf } = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: 'Hej! Nu är jag med på linjen.',
        model_id: 'eleven_multilingual_v2',
        output_format: 'ulaw_8000',
        optimize_streaming_latency: 0
      },
      {
        responseType: 'arraybuffer',
        headers: { 'xi-api-key': apiKey }
      }
    );

    if (!wavBuf.length) throw new Error('Tomt ljud från Eleven');

    // 2 Strip 44-byte WAV-header → rå μ-law-data
    const muLaw = Buffer.from(wavBuf);
    console.log('🎤 Hämtade', muLaw.length, 'bytes μ-law');

    // 3 Skicka 20 ms-ramar (160 byte) till Twilio
    const CHUNK = 160;
    for (let i = 0; i < muLaw.length; i += CHUNK) {
      const payload = muLaw.slice(i, i + CHUNK).toString('base64');
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload, track: 'outbound' }
      }));
      await new Promise(r => setTimeout(r, 20));
    }
    console.log('🗣️ Hälsning skickad');
  } catch (err) {
    console.error('❌ sendGreeting-fel:', err.message);
  }
}
