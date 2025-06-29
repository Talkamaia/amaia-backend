const express = require('express');
const { Deepgram } = require('@deepgram/sdk');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

const PORT = process.env.PORT || 10000;
const TEST_AUDIO_PATH = path.join(__dirname, 'public/audio/test.raw');

app.use(express.static(path.join(__dirname, 'public')));

server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);
  console.log('==> Your service is live 🎉');
  console.log('==> ');
  console.log('==> ///////////////////////////////////////////////////////////');
  console.log(`==> Available at your primary URL ${process.env.BASE_URL}`);
  console.log('==> ///////////////////////////////////////////////////////////');
});

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');

  // Skicka test.raw som en placeholder i början
  if (fs.existsSync(TEST_AUDIO_PATH)) {
    const testBuffer = fs.readFileSync(TEST_AUDIO_PATH);
    console.log('📤 Skickar test.raw till klienten...');
    ws.send(
      JSON.stringify({
        event: 'media',
        media: { payload: testBuffer.toString('base64') },
      })
    );
  } else {
    console.warn('⚠️ test.raw hittades inte – inget ljud skickat');
  }

  const deepgramLive = deepgram.transcription.live({
    language: 'sv',
    punctuate: true,
    model: 'nova',
  });

  deepgramLive.addListener('open', () => {
    console.log('✅ Deepgram igång');
  });

  deepgramLive.addListener('close', () => {
    console.log('🔒 Deepgram stängd');
  });

  deepgramLive.addListener('transcriptReceived', (data) => {
    const received = JSON.parse(data);
    const transcript = received.channel?.alternatives[0]?.transcript;
    if (transcript) {
      console.log(`📝 Transkriberat: ${transcript}`);
      // Här kan GPT + ElevenLabs integreras senare
    }
  });

  ws.on('message', (msg) => {
    const message = JSON.parse(msg);
    if (message.event === 'start') {
      console.log('🚀 Stream startad');
    } else if (message.event === 'media' && message.media?.payload) {
      const audioData = Buffer.from(message.media.payload, 'base64');
      deepgramLive.send(audioData);
    } else if (message.event === 'stop') {
      console.log('🛑 Stream stoppad');
      deepgramLive.finish();
    }
  });

  ws.on('close', () => {
    console.log('🔌 Klient frånkopplad');
  });
});
