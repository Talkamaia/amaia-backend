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

// Serva ljudfiler (om du vill)
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

// Test-rutt
app.get('/', (req, res) => {
  res.send('✅ Amaia backend med WebSocket är igång');
});

// WebSocket + Deepgram + GPT + ElevenLabs
const wss = new WebSocketServer({ server });
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

wss.on('connection', async (ws) => {
  console.log('🔌 Klient ansluten');

  const sessionId = uuidv4();
  const filepath = `/tmp/${sessionId}.mp3`;

  const { connection, transcription } = await deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    smart_format: true,
    interim_results: false
  });

  transcription.on('transcriptReceived', async (data) => {
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
        connection.send(audio);
      }

      if (data.event === 'stop') {
        console.log('🛑 Stream stoppad');
        connection.close();
      }
    } catch (err) {
      console.error('❌ WS-fel:', err);
    }
  });

  ws.on('close', () => {
    connection.close();
    console.log('🔌 Klient frånkopplad');
  });
});

// Starta servern
server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WebSocket live på port ${PORT}`);
});
