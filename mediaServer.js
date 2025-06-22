// mediaServer.js – korrekt version med Deepgram v3 SDK
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { speak } = require('./eleven');
const { askGPT } = require('./gpt');
const { v4: uuidv4 } = require('uuid');

const { createClient } = require('@deepgram/sdk');
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const PORT = process.env.PORT || 10000;
const wss = new WebSocketServer({ port: PORT });

console.log(`🎧 WebSocket + Deepgram live på port ${PORT}`);

wss.on('connection', (ws) => {
  console.log('🔌 Klient ansluten via WebSocket');

  const dgSocket = deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    smart_format: true,
    interim_results: false
  });

  dgSocket.on('open', () => {
    console.log('🎙️ Deepgram-anslutning startad');
  });

  dgSocket.on('error', (err) => {
    console.error('❌ Deepgram error:', err);
  });

  dgSocket.on('close', () => {
    console.log('🔇 Deepgram stängd');
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
      console.error('❗ Fel i transkribering eller svar:', err);
    }
  });

  ws.on('message', (message) => {
    if (Buffer.isBuffer(message)) {
      dgSocket.send(message);
    }
  });

  ws.on('close', () => {
    console.log('📴 Klient kopplade från');
    dgSocket.finish();
  });

  ws.on('error', (err) => {
    console.error('📛 WebSocket error:', err);
  });
});
