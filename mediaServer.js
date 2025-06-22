require('dotenv').config();
const WebSocket = require('ws');
const { Deepgram } = require('@deepgram/sdk');
const { speak } = require('./eleven');
const { askGPT } = require('./gpt');
const path = require('path');

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

let latestAudioUrl = null;

const wss = new WebSocket.Server({ port: 10001 }, () => {
  console.log('🎧 MediaServer live på ws://localhost:10001');
});

wss.on('connection', (ws) => {
  console.log('📞 Ny samtalsanslutning');

  const dgSocket = deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    smart_format: true,
    punctuate: true,
  });

  ws.on('message', (message) => {
    let msg;
    try {
      msg = JSON.parse(message);
    } catch (e) {
      return;
    }

    if (msg.event === 'media') {
      const audio = Buffer.from(msg.media.payload, 'base64');
      dgSocket.send(audio);
    }
  });

  dgSocket.on('transcriptReceived', async (data) => {
    const transcript = JSON.parse(data)?.channel?.alternatives?.[0]?.transcript;
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
      console.error('❌ Fel i GPT/ElevenLabs:', err.message || err);
    }
  });

  ws.on('close', () => {
    console.log('❌ Samtalet avslutat');
    dgSocket.finish();
  });
});

module.exports = {
  getAndClearAudioUrl: () => {
    const url = latestAudioUrl;
    latestAudioUrl = null;
    return url;
  }
};
