// ✅ mediaServer.js – med korrekt Deepgram v3-format
require('dotenv').config();
const WebSocket = require('ws');
const { Deepgram } = require('@deepgram/sdk');
const { speak } = require('./eleven');
const { getGptResponse } = require('./gpt');
const path = require('path');

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
let latestAudioUrl = null;

const wss = new WebSocket.Server({ port: 10001 }, () => {
  console.log('🎧 MediaServer live på ws://localhost:10001');
});

wss.on('connection', async (ws) => {
  console.log('📞 Ny samtalsanslutning');

  const dgConnection = await deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    smart_format: true,
    interim_results: false
  });

  ws.on('message', (msg) => {
    let json;
    try {
      json = JSON.parse(msg);
    } catch {
      return;
    }

    if (json.event === 'media') {
      const audio = Buffer.from(json.media.payload, 'base64');
      dgConnection.send(audio);
    }
  });

  dgConnection.on('transcriptReceived', async (msg) => {
    const transcript = msg.channel?.alternatives?.[0]?.transcript;
    if (!transcript || transcript.trim() === '') return;
    console.log('🗣 Du sa:', transcript);

    try {
      const gptReply = await getGptResponse(transcript);
      console.log('🤖 Amaia säger:', gptReply);

      const audioPath = await speak(gptReply);
      const fileName = path.basename(audioPath);
      latestAudioUrl = `${process.env.BASE_URL}/audio/${fileName}`;
      console.log('🔊 Klar att spela upp:', latestAudioUrl);
    } catch (err) {
      console.error('❌ Fel i GPT/ElevenLabs:', err.message || err);
    }
  });

  ws.on('close', () => {
    console.log('❌ Samtalet avslutat');
    dgConnection.finish();
  });
});

module.exports = {
  getAndClearAudioUrl: () => {
    const url = latestAudioUrl;
    latestAudioUrl = null;
    return url;
  }
};
