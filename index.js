require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { createClient } = require('@deepgram/sdk');
const { askGPT } = require('./gpt');
const { speak } = require('./eleven');

const PORT = process.env.PORT || 10000;
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

app.get('/', (req, res) => res.send('✅ Amaia backend live'));
app.get('/test', (req, res) => res.send('✅ Test OK'));

app.get('/generate-voice', async (req, res) => {
  const text = req.query.text || "Hej, jag är Amaia.";
  const filepath = path.join(__dirname, 'public/audio/test.mp3');
  try {
    const audioBuffer = await speak(text, filepath);
    res.send('✅ Ljud genererat som test.mp3');
  } catch (err) {
    console.error('❌ Röstfel:', err);
    res.status(500).send('Fel vid generering');
  }
});

app.use(express.urlencoded({ extended: false }));
app.post('/incoming-call', (req, res) => {
  res.type('text/xml');
  res.send(`
    <Response>
      <Start>
        <Stream url="wss://amaia-backend-1.onrender.com/media" track="inbound_track"/>
      </Start>
      <Pause length="60"/>
    </Response>
  `);
});

wss.on('connection', async (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');
  const sessionId = uuidv4();
  const filepath = path.join(__dirname, 'public/audio', `${sessionId}.mp3`);

  const deepgramLive = await deepgram.listen.live({
    model: 'nova-2-general',
    language: 'sv-SE',
    smart_format: true,
    interim_results: false
  });

  deepgramLive.on('open', () => console.log('✅ Deepgram igång'));
  deepgramLive.on('close', () => console.log('🔒 Deepgram stängd'));
  deepgramLive.on('warning', (w) => console.warn('⚠️ DG-varning:', w));
  deepgramLive.on('error', (e) => console.error('🔥 DG-fel:', e));

  // 🎙 Skicka inledningsfras via ElevenLabs
  const intro = "Mmm... hej älskling. Jag är så glad att du ringde mig...";
  const introBuffer = await speak(intro, filepath);
  if (introBuffer.length) {
    ws.send(JSON.stringify({
      event: 'media',
      media: { payload: introBuffer.toString('base64') }
    }));
    console.log('📤 Skickade intro via ElevenLabs');
  }

  deepgramLive.on('transcriptReceived', async (data) => {
    console.log('📡 Raw transcript:', JSON.stringify(data, null, 2));
    const transcript = data.channel.alternatives[0]?.transcript;
    const timestamp = new Date().toISOString();

    if (!transcript || transcript.trim() === '') {
      console.log(`[${timestamp}] ⚠️ Tom transkription`);
      const fallback = "Förlåt älskling, jag hörde inte riktigt. Kan du säga det igen?";
      const audioBuffer = await speak(fallback, filepath);
      ws.send(JSON.stringify({ event: 'media', media: { payload: audioBuffer.toString('base64') } }));
      return;
    }

    console.log(`[${timestamp}] 🗣️ Du sa: "${transcript}"`);
    fs.appendFile('transcripts.log', `[${timestamp}] ${transcript}\n`, () => {});
    const gptResponse = await askGPT(transcript);
    const audioBuffer = await speak(gptResponse, filepath);
    ws.send(JSON.stringify({ event: 'media', media: { payload: audioBuffer.toString('base64') } }));
  });

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());
      if (data.event === 'start') console.log('🚀 Stream startad');
      if (data.event === 'media') {
        const audio = Buffer.from(data.media.payload, 'base64');
        deepgramLive.send(audio);
      }
      if (data.event === 'stop') {
        console.log('🛑 Stream stoppad');
        deepgramLive.finish();
      }
    } catch (err) {
      console.error('❌ WS-fel:', err);
    }
  });

  ws.on('close', () => {
    deepgramLive.finish();
    console.log('🔌 Klient frånkopplad');
  });
});

server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);
});
