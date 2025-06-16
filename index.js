// Amaia backend – Twilio Media Streams ⇄ ElevenLabs (rå μ-law 8 kHz)
// ------------------------------------------------------------------
// ENV på Render:
//   ELEVEN_API_KEY   – din API-nyckel
//   ELEVEN_VOICE_ID  – valfri färdig svensk röst (byt till Amaia-ID när hon är “Ready”)
// ------------------------------------------------------------------

const express  = require('express');
const { twiml: { VoiceResponse } } = require('twilio');
const WebSocket = require('ws');
const axios     = require('axios');

const app = express();
app.use(express.urlencoded({ extended: false }));

// 1. Inkommande samtal → Connect / Stream
app.post('/incoming-call', (_, res) => {
  const twiml = new VoiceResponse();
  const connect = twiml.connect();
  connect.stream({
    url: 'wss://amaia-backend-1.onrender.com/media',
    bidirectional: true
  });
  res.type('text/xml').send(twiml.toString());
});

// 2. Start HTTP-server
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('Amaia backend lyssnar på', PORT);
  console.log('🔑 Key …'   + (process.env.ELEVEN_API_KEY  || '').slice(-4));
  console.log('🎙️ Voice '  + (process.env.ELEVEN_VOICE_ID || 'MISSING'));
});

// 3. WebSocket ⇄ Twilio Media Streams
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

// 4. Hämta rå μ-law (pcm_mulaw) & strömma
async function sendGreeting(ws, sid) {
  try {
    const apiKey  = process.env.ELEVEN_API_KEY;
    const voiceId = process.env.ELEVEN_VOICE_ID;
    if (!apiKey || !voiceId) throw new Error('saknar ENV');

    // 4.1 Hämta ren μ-law 8 kHz – INGEN WAV-header
    const { data: muLaw } = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: 'Hej! Nu är jag med på linjen.',
        model_id: 'eleven_multilingual_v2',
        output_format: 'pcm_mulaw',          // ← rå μ-law 8 kHz
        optimize_streaming_latency: 0
      },
      { responseType: 'arraybuffer',
        headers: { 'xi-api-key': apiKey } }
    );

    console.log('🎤 Fick', muLaw.length, 'bytes μ-law');

    // 4.2 Skicka i 20 ms-ramar (160 byte @ 8 kHz)
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
