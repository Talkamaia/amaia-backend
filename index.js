require('dotenv').config();
const express  = require('express');
const { twiml: { VoiceResponse } } = require('twilio');
const WebSocket = require('ws');
const axios     = require('axios');
const { handleChat } = require('./src/chatHandler');

const app = express();
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// POST-endpoint för chatt
app.post('/chat', async (req, res) => {
  const { phone, message } = req.body;
  const result = await handleChat(phone, message);
  res.json(result);
});

// GET-endpoint för test av GPT
app.get('/test-chat', async (req, res) => {
  console.log('📩 /test-chat blev anropad!');
  try {
    const result = await handleChat('test-amaia', 'Hej Amaia, vad tänker du på just nu?');
    console.log('✅ GPT-svar:', result);
    res.json(result);
  } catch (error) {
    console.error('❌ Fel i /test-chat:', error.message);
    res.status(500).json({ error: 'Fel i test-chat' });
  }
});

// Twilio ringer → connecta WebSocket
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
const server = app.listen(PORT, '0.0.0.0', () => {
  console.log('Amaia backend lyssnar på', PORT);
  console.log('🔑 OpenAI …' + (process.env.OPENAI_API_KEY  || '').slice(-4));
  console.log('🔑 Eleven …' + (process.env.ELEVEN_API_KEY  || '').slice(-4));
  console.log('🎙️ Voice   …' + (process.env.ELEVEN_VOICE_ID || 'MISSING'));
});

// WebSocket-server för Twilio
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

// TTS-hälsning via ElevenLabs
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
