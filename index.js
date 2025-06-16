// Amaia backend – full working example with Twilio Media Streams + ElevenLabs TTS (outbound)
// -----------------------------------------------------------------------------
// ENV required (Render):
//   ELEVEN_API_KEY   – your ElevenLabs API key
//   ELEVEN_VOICE_ID  – temp Swedish voice (ready) or Amaia clone when status = "Ready"
//
// 2025‑06‑16 – includes outbound μ‑law frames with streamSid
// -----------------------------------------------------------------------------

const express = require('express');
const { twiml: { VoiceResponse } } = require('twilio');
const WebSocket = require('ws');
const axios = require('axios');

// === μ‑law helpers + FFmpeg ==================================================
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
ffmpeg.setFfmpegPath(ffmpegPath);

function pcmSampleToMuLaw(sample) {
  const MU = 255;
  const MAX = 32768;
  const sign = (sample >> 8) & 0x80;
  if (sign) sample = -sample;
  let magnitude = (sample * MU) / MAX;
  magnitude = Math.log1p(magnitude) / Math.log1p(MU);
  let mu = (magnitude * 127) & 0x7f;
  return (mu | sign) ^ 0xff;
}
function pcmBufToMuLaw(buf) {
  const out = Buffer.alloc(buf.length / 2);
  for (let i = 0; i < buf.length; i += 2) {
    out[i >> 1] = pcmSampleToMuLaw(buf.readInt16LE(i));
  }
  return out;
}
// ===========================================================================

const app = express();
app.use(express.urlencoded({ extended: false }));

// ===== Inkommande samtal – Connect/Stream ===================================
app.post('/incoming-call', (req, res) => {
  const twiml = new VoiceResponse();
  twiml.say({ language: 'sv-SE' }, 'Ge mig bara en sekund, älskling...');
  const connect = twiml.connect();
  connect.stream({ url: 'wss://amaia-backend-1.onrender.com/media', bidirectional: true });
  res.type('text/xml').send(twiml.toString());
});

// ===== Start HTTP server =====================================================
const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log('Amaia backend lyssnar på', PORT);
  console.log('🔑 ElevenLabs‑nyckel laddad (…' + (process.env.ELEVEN_API_KEY || '').slice(-4) + ')');
  console.log('🎙️  Voice‑ID ' + (process.env.ELEVEN_VOICE_ID || 'MISSING'));
});

// ===== WebSocket för Twilio Media Streams ===================================
const wss = new WebSocket.Server({ server, path: '/media' });

wss.on('connection', (ws) => {
  console.log('🔗 Twilio WebSocket ansluten');
  let streamSid = null;
  let greeted   = false;

  ws.on('message', async (msgBuf) => {
    const msg = JSON.parse(msgBuf);

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

// === Funktion som hämtar & skickar TTS‑hälsning ==============================
async function sendGreeting(ws, streamSid) {
  try {
    const apiKey  = process.env.ELEVEN_API_KEY;
    const voiceId = process.env.ELEVEN_VOICE_ID;
    if (!apiKey || !voiceId) throw new Error('missing Eleven env');

    // 1. Hämta MP3 från ElevenLabs
    const { data: mp3 } = await axios.post(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      { text: 'Hej! Nu är jag med på linjen.', model_id: 'eleven_multilingual_v2' },
      { responseType: 'arraybuffer', headers: { 'xi-api-key': apiKey } }
    );

    // 2. MP3 → rå 8 kHz mono PCM
    const pcmChunks = [];
    await new Promise((resolve, reject) => {
      ffmpeg()
        .input(Buffer.from(mp3))
        .inputFormat('mp3')
        .audioFrequency(8000)
        .audioChannels(1)
        .audioCodec('pcm_s16le')
        .format('s16le')
        .on('data', (c) => pcmChunks.push(c))
        .on('end', resolve)
        .on('error', reject)
        .pipe();
    });
    const muLaw = pcmBufToMuLaw(Buffer.concat(pcmChunks));
    console.log('🎤 Hämtade & konverterade', muLaw.length, 'bytes mu‑law');

    // 3. Skicka 20 ms (160‑byte) ramar till Twilio
    const CHUNK = 160;
    for (let i = 0; i < muLaw.length; i += CHUNK) {
      const payload = muLaw.slice(i, i + CHUNK).toString('base64');
      ws.send(JSON.stringify({
        event: 'media',
        streamSid,
        media: { payload, track: 'outbound' },
      }));
      await new Promise((r) => setTimeout(r, 20));
    }
    console.log('🗣️  Amaia-hälsning skickad');
  } catch (err) {
    console.error('❌ Fel i sendGreeting', err.message);
  }
}
