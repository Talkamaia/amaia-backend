const { createClient } = require('@deepgram/sdk');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { generateSpeech } = require('./eleven');
const { askAmaia } = require('./gpt');
require('dotenv').config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

async function startTranscription(ws, callSid) {
  console.log(`🎙️ Startar transkribering för ${callSid}`);

  const dgConnection = deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    punctuate: true,
    interim_results: false,
  });

  dgConnection.on('open', () => {
    console.log('🧠 Deepgram WebSocket öppen');
  });

  dgConnection.on('error', (error) => {
    console.error('🚨 Deepgram fel:', error);
  });

  dgConnection.on('transcriptReceived', async (data) => {
    const transcript = data.channel.alternatives[0]?.transcript;
    if (!transcript || transcript.length < 1) return;

    console.log(`👂 Kunde höras: ${transcript}`);

    try {
      const reply = await askAmaia(transcript, callSid);
      console.log(`💬 Amaia svarar: ${reply}`);

      const mp3Path = `/tmp/${uuidv4()}.mp3`;
      await generateSpeech(reply, mp3Path);

      const twiml = `
<Response>
  <Play>${process.env.BASE_URL}/audio/${pathFromTmp(mp3Path)}</Play>
</Response>`;

      ws.send(JSON.stringify({ twiml }));
    } catch (err) {
      console.error('❌ GPT/ElevenLabs-fel:', err);
    }
  });

  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message);
      if (msg.event === 'media') {
        const audio = Buffer.from(msg.media.payload, 'base64');
        dgConnection.send(audio);
      }
    } catch (e) {
      console.error('❌ WS/Media-fel:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`❌ WS stängd för ${callSid}`);
    dgConnection.finish();
  });
}

function pathFromTmp(fullPath) {
  const filename = fullPath.split('/').pop();
  return `audio/${filename}`;
}

module.exports = { startTranscription };
