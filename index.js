// Amaia backend – Twilio Media Streams ⇄ ElevenLabs (rå μ-law 8 kHz)
// ------------------------------------------------------------------
// ENV på Render:
//   OPENAI_API_KEY    – GPT-nyckel
//   ELEVEN_API_KEY    – ElevenLabs-nyckel
//   ELEVEN_VOICE_ID   – t.ex. Amaia-röstens ID
// ------------------------------------------------------------------

require('dotenv').config(); // Läser .env om du kör lokalt
const express  = require('express');
const { twiml: { VoiceResponse } } = require('twilio');
const WebSocket = require('ws');
const axios     = require('axios');
const { handleChat } = require('./src/chatHandler');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json()); // Om du vill skicka JSON från frontend

// POST-endpoint för chatt från frontend (valfritt)
app.post('/chat', async (req, res) => {
  const { phone, message } = req.body;
  const result = await handleChat({
    userId: phone,
    message,
    memory: []
  });
  res.json(result);
});

// ✅ Test-endpoint för GPT-funktion
app.get('/test-chat', async (req, res) => {
  const result = await handleChat({
    userId: 'test-amaia',
    message: 'Hej Amaia, vad tänker du på just nu?',
    memory: []
  });
  res.json(result);
});

// Twilio ringer in → starta WebSocket-ström
app.post('/incoming-call', (_, res) => {
  const twiml = new VoiceResponse();
  const connect = twiml.connect();
  connect.stream({
    url: 'wss://amaia-backend-1.onrender.com/media',
    bidirectional: true
  });
  res.type('text/xml').send(twiml.toString());
});

// Starta server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('Amaia backend lyssnar på', PORT);
  console.log('🔑 OpenAI …' + (process.env.OPENAI_API_KEY  || '').slice(-4));
  console.log('🔑 Eleven …' + (process.env.ELEVEN_API_KEY  || '').slice(-4));
  console.log('🎙️ Voice   …' + (process.env.ELEVEN_VOICE_ID || 'MISSING'));
});

// WebSocket-server för Twilio Media Streams
const wss = new WebSocket.Server({ server, path: '/media' });

wss.on('connection', (ws) => {
  console.log('🔗 WebSocket ansluten');
  let sid   = null;
  let sent  = false;

  ws.on('message', async (buf) => {
    const msg = JSON.parse(buf);

    if (msg.event === 'start') {
      sid = msg.streamSid;
      console.log('🆔 streamSid', sid);
    }

    if (!sent && sid) {
      sent = true;
      await sendGreeting(ws, sid).catch(console.error);
    }
  });

  ws.on('ping', () => ws.pong());
  ws.on('close', () => console.log('🚪 WebSocket stängd'));
});

// Funktion för att strömma μ-law till Twilio
async function sendGreeting(ws, sid) {
  try {
    const apiKey  = process.env.ELEVEN_API_KEY;
    const voiceId = process.env.ELEVEN_VOICE_ID;
    if (!apiKey || !voiceId) throw new Error('saknar ENV');

    const { data: muLaw } = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: 'Hej! Nu är jag med på linjen.',
        model_id: 'eleven_multilingual_v2',
        output_format: 'pcm_mulaw',
        optimize_streaming_latency: 0
      },
      {
        responseType: 'arraybuffer',
        headers: { 'xi-api-key': apiKey }
      }
    );

    console.log('🎤 Fick', muLaw.length, 'bytes μ-law');

    const CHUNK = 160;
    for (let i = 0; i < muLaw.length; i += CHUNK) {
      const payload = muLaw.slice(i, i + CHUNK).toString('base64');
      ws.send(JSON.stringify({
        event: 'media',
        streamSid: sid,
        media: { payload, track: 'outbound' }
      }));
      await new Promise(r => setTimeout(r, 20));
    }

    console.log('🗣️ Hälsning skickad');
  } catch (err) {
    console.error('❌ sendGreeting-fel:', err.response?.data || err.message);
  }
}
