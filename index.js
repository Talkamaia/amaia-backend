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

// 🛠️ Twilio webhook
app.use(express.urlencoded({ extended: false }));
app.post('/incoming-call', (req, res) => {
  res.type('text/xml');
  res.send(`
    <Response>
      <Start>
        <Stream url="wss://amaia-backend-1.onrender.com"/>
      </Start>
      <Say voice="Polly.Salli">Hej älskling... Amaia är här för dig</Say>
    </Response>
  `);
});

// 🎧 Serva ev. ljud
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
app.get('/', (req, res) => res.send('✅ Amaia backend är live'));

// 🎙️ WebSocket + Deepgram + GPT + ElevenLabs
const wss = new WebSocketServer({ server });
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

wss.on('connection', async (ws) => {
  console.log('🔌 Klient ansluten till WebSocket');

  const sessionId = uuidv4();
  const filepath = `/tmp/${sessionId}.mp3`;

  const deepgramLive = await deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    smart_format: true,
    interim_results: false
  });

  deepgramLive.on('transcriptReceived', async (data) => {
    const transcript = data.channel.alternatives[0]?.transcript;
    if (transcript) {
      console.log('🗣️ Kunden sa:', transcript);

      const gptResponse = await askGPT(transcript);
      console.log('🤖 GPT-svar:', gptResponse);

      const audioBuffer = await speak(gptResponse, filepath);

      const message = {
        event: 'media',
        media: {
          payload: audioBuffer.toString('base64')
        }
      };

      ws.send(JSON.stringify(message));
    }
  });

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.event === 'start') {
        console.log('🚀 Stream startad');
      }

      if (data.event === 'media') {
        const audio = Buffer.from(data.media.payload, 'base64');
        deepgramLive.send(audio);
      }

      if (data.event === 'stop') {
        console.log('🛑 Stream stoppad');
        deepgramLive.close();
      }
    } catch (err) {
      console.error('❌ Fel vid WebSocket-message:', err);
    }
  });

  ws.on('close', () => {
    deepgramLive.close();
    console.log('🔌 Klient frånkopplad');
  });
});

// 🚀 Starta server
server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WebSocket + webhook live på port ${PORT}`);
});
