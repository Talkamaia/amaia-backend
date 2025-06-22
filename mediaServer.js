require('dotenv').config();
const WebSocket = require('ws');
const { Deepgram } = require('@deepgram/sdk');
const { speak } = require('./eleven');
const { askGPT } = require('./gpt');
const path = require('path');

let latestAudioUrl = null;

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

const wss = new WebSocket.Server({ port: 10001 }, () => {
  console.log('🎧 MediaServer live på ws://localhost:10001');
});

wss.on('connection', async (ws) => {
  console.log('📞 Ny samtalsanslutning');

  const dgSocket = await deepgram.listen.v("1").live({
    language: 'sv',
    smart_format: true,
    model: 'nova',
    punctuate: true
  });

  dgSocket.on("transcriptReceived", async (data) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    if (!transcript || transcript.trim() === '') return;

    console.log("🗣 Du sa:", transcript);

    try {
      const gptReply = await askGPT(transcript);
      console.log("🤖 Amaia säger:", gptReply);

      const audioPath = await speak(gptReply);
      const fileName = path.basename(audioPath);
      latestAudioUrl = `${process.env.BASE_URL}/audio/${fileName}`;
      console.log("🔊 Klar att spela upp:", latestAudioUrl);
    } catch (err) {
      console.error("❌ Fel i GPT/ElevenLabs:", err.message || err);
    }
  });

  ws.on("message", async (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.event === "media") {
        const audio = Buffer.from(msg.media.payload, "base64");
        dgSocket.send(audio);
      }
    } catch (e) {
      // ignorera
    }
  });

  ws.on("close", () => {
    console.log("❌ Samtalet avslutat");
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
