// Amaia backend – Twilio Media Streams ⇄ ElevenLabs (μ‑law 8 kHz direct)
// -----------------------------------------------------------------------------
// ENV (Render / .env):
//   ELEVEN_API_KEY   – your ElevenLabs API key
//   ELEVEN_VOICE_ID  – temp Swedish voice  OR  Amaia clone when status = "Ready"
// -----------------------------------------------------------------------------

const express = require('express');
const { twiml: { VoiceResponse } } = require('twilio');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
app.use(express.urlencoded({ extended: false }));

// ===== Inkommande samtal – Connect/Stream ===================================
app.post('/incoming-call', (req, res) => {
  const twiml = new VoiceResponse();
  //   ⚠️  Ingen <Say> – vi spelar upp ElevenLabs‑ljudet i stället
  const connect = twiml.connect();
  connect.stream({ url: 'wss://amaia-backend-1.onrender.com/media', bidirectional: true });
  res.type('text/xml').send(twiml.toString());
});

// ===== Start HTTP server =====================================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('Amaia backend lyssnar på', PORT);
  console.log('🔑 Eleven‑key …' + (process.env.ELEVEN_API_KEY || '').slice(-4));
  console.log('🎙️ Voice‑ID', process.env.ELEVEN_VOICE_ID || 'MISSING');
});

// ===== WebSocket för Twilio Media Streams ===================================
const wss = new WebSocket.Server({ server, path: '/media' });

wss.on('connection', (ws) => {
  console.log('🔗 Twilio WebSocket ansluten');
  let streamSid = null;
  let greeted   = false;

  ws.on('message', async (raw) => {
    const msg = JSON.parse(raw);
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

// === Hämta & skicka ElevenLabs‑ljud (ulaw_8000) ==============================
// === Hämta & skicka ElevenLabs-ljud (ulaw_8000) ==============================
async function sendGreeting(ws, streamSid) {
  try {
    const apiKey  = process.env.ELEVEN_API_KEY;
    const voiceId = process.env.ELEVEN_VOICE_ID;
    if (!apiKey || !voiceId) throw new Error('Missing Eleven env');

    /* 1. Hämta WAV (ulaw_8000) från ElevenLabs */
    const { data: wavBuf } = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        text: 'Hej! Nu är jag med på linjen.',
        model_id: 'eleven_multilingual_v2',
        output_format: 'ulaw_8000',
        optimize_streaming_latency: 0
      },
      { responseType: 'arraybuffer', headers: { 'xi-api-key': apiKey } }
    );

    if (!wavBuf.length) throw new Error('Empty audio from Eleven');

    /* 2. Strip 44‑byte WAV header → rå μ‑law */
    const muLawBuf = wavBuf.slice(44);
    console.log('🎤 Hämtade', muLawBuf.length, 'bytes μ-law utan header');

    /* 3. Skicka 20 ms‑ramar (160 byte) till Twilio */
    const CHUNK = 160;
    for (let i = 0; i < muLawBuf.length; i += CHUNK) {
      const payload = muLawBuf.slice(i, i + CHUNK).toString('base64');
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload, track: 'outbound' }
      }));
      await new Promise(r => setTimeout(r, 20));
    }
    console.log('🗣️  Hälsning skickad');
  } catch (err) {
    console.error('❌ Fel i sendGreeting', err.message);
  }
}
    );

    if (!muLawBuf.length) throw new Error('Empty audio from Eleven');
    console.log('🎤 Hämtade', muLawBuf.length, 'bytes μ‑law');

    /* 2. Skicka 20 ms‑ramar (160 byte) till Twilio */
    const CHUNK = 160;
    for (let i = 0; i < muLawBuf.length; i += CHUNK) {
      const payload = muLawBuf.slice(i, i + CHUNK).toString('base64');
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload, track: 'outbound' }
      }));
      await new Promise(r => setTimeout(r, 20));
    }
    console.log('🗣️  Hälsning skickad');
  } catch (err) {
    console.error('❌ Fel i sendGreeting', err.message);
  }
}
