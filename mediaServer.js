require('dotenv').config();
const { WebSocketServer } = require('ws');
const { createClient } = require('@deepgram/sdk');
const { speak } = require('./eleven');
const { askGPT } = require('./gpt');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);
const wss = new WebSocketServer({ port: 8080 });

console.log('🎧 MediaServer kör (DG v3.13)');

wss.on('connection', async (ws) => {
  console.log('🔌 Klient ansluten');

  const sessionId = uuidv4();
  const filepath = `/tmp/${sessionId}.mp3`;

  const { connection, transcription } = await deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    smart_format: true,
    interim_results: false,
  });

  transcription.on('transcriptReceived', async (data) => {
    const transcript = data.channel.alternatives[0]?.transcript;
    if (transcript) {
      console.log('🗣️ Kunden sa:', transcript);

      const gptResponse = await askGPT(transcript);
      console.log('🤖 GPT:', gptResponse);

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
      console.error('❌ Fel vid ws-message:', err);
    }
  });

  ws.on('close', () => {
    connection.close();
    console.log('🔌 Klient frånkopplad');
  });
});
