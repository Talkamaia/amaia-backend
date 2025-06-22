const WebSocket = require('ws');
const { createClient } = require('@deepgram/sdk'); // ✅ NYA SDK-formatet
const { speak } = require('./eleven');
const { getGptResponse } = require('./gpt');
require('dotenv').config();
const path = require('path');

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

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
    interim_results: false,
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
    const transcript = data.channel.alternatives[0]?.transcript;
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
    dgSocket.finish();
  });
});

module.exports = {
  getAndClearAudioUrl: () => {
    const url = latestAudioUrl;
    latestAudioUrl = null;
    return url;
  },
};
