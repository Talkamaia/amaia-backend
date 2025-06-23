require('dotenv').config();
const { createClient } = require('@deepgram/sdk');
const { WebSocketServer } = require('ws');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { askGPT } = require('./gpt');
const { speak } = require('./eleven');

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT });

console.log(`🎧 WebSocket + Deepgram live på port ${PORT}`);

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

wss.on('connection', async (ws) => {
  console.log('🔌 Klient ansluten till WebSocket');

  const sessionId = uuidv4();
  const filepath = `/tmp/${sessionId}.mp3`;

  const deepgramLive = await deepgram.listen.live({
    model: 'general', // 🟢 stabil modell
    language: 'sv',
    smart_format: true,
    interim_results: false
  });

  // 🔥 Felhantering för Deepgram
  deepgramLive.on('error', (err) => {
    console.error('🔥 Deepgram-anslutningsfel:', err);
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
