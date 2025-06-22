require('dotenv').config();
const { Deepgram } = require('@deepgram/sdk');
const { WebSocketServer } = require('ws');
const { askGPT } = require('./gpt');
const { speak } = require('./eleven');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const PORT = process.env.PORT || 10000;
const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
const wss = new WebSocketServer({ port: PORT });

console.log(`✅ Amaia backend + WebSocket + webhook live på port ${PORT}`);

wss.on('connection', (ws) => {
  console.log('🔌 Klient ansluten till WebSocket');

  const dgSocket = deepgram.transcription.live({
    language: 'sv',
    model: 'nova',
    punctuate: true,
    smart_format: true,
    interim_results: false,
  });

  dgSocket.on('open', () => {
    console.log('🚀 Stream startad');
  });

  dgSocket.on('error', (error) => {
    console.error('🔥 Deepgram WebSocket error:', error);
  });

  dgSocket.on('close', () => {
    console.log('❌ Deepgram WebSocket stängd');
  });

  dgSocket.on('transcriptReceived', async (data) => {
    try {
      const transcript = JSON.parse(data);
      const text = transcript.channel.alternatives[0]?.transcript;
      if (!text || text.length < 1) return;

      console.log('🗣️ Användare sa:', text);

      const reply = await askGPT(text);
      console.log('🤖 GPT svarar:', reply);

      const filepath = `/tmp/${uuidv4()}.mp3`;
      await speak(reply, filepath);

      const audioBuffer = fs.readFileSync(filepath);
      ws.send(audioBuffer);
      fs.unlinkSync(filepath);
    } catch (err) {
      console.error('❗ Fel vid transkribering eller svar:', err);
    }
  });

  ws.on('message', (message) => {
    if (Buffer.isBuffer(message)) {
      dgSocket.send(message);
    }
  });

  ws.on('close', () => {
    console.log('📴 WebSocket stängd av klient');
    dgSocket.finish();
  });

  ws.on('error', (err) => {
    console.error('📛 WebSocket error:', err);
  });
});
