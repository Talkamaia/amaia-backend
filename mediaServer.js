require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { WebSocketServer } = require('ws');
const { Deepgram } = require('@deepgram/sdk');
const { speak } = require('./eleven');
const { askGPT } = require('./gpt');

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

let latestAudioUrl = null;

const wss = new WebSocketServer({ port: 10001 }, () => {
  console.log('🎧 MediaServer live på ws://localhost:10001');
});

wss.on('connection', (ws) => {
  console.log('📞 Ny samtalsanslutning');

  const dgConnection = deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    smart_format: true,
    punctuate: true,
  });

  dgConnection.on('transcriptReceived', async (msg) => {
    const transcript = msg.channel?.alternatives?.[0]?.transcript;
    if (!transcript || transcript.trim() === '') return;

    console.log('🗣 Du sa:', transcript);

    try {
      const gptReply = await askGPT(transcript);
      console.log('🤖 Amaia säger:', gptReply);

      const audioPath = await speak(gptReply);
      const fileName = path.basename(audioPath);
      latestAudioUrl = `${process.env.BASE_URL}/audio/${fileName}`;
      console.log('🔊 Klar att spela upp:', latestAudioUrl);
    } catch (err) {
      console.error('❌ GPT/ElevenLabs-fel:', err.message || err);
    }
  });

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg);
      if (data.event === 'media') {
        const audio = Buffer.from(data.media.payload, 'base64');
        dgConnection.send(audio);
      }
    } catch (e) {
      console.error('❌ Meddelandefel:', e.message);
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
