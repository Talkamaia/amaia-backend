const { Deepgram } = require('@deepgram/sdk');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { generateSpeech } = require('./eleven');
const { askAmaia } = require('./gpt');
require('dotenv').config();

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

async function startTranscription(ws, callSid) {
  console.log(`🎙️ Startar transkribering för ${callSid}`);

  const dgSocket = deepgram.transcription.live({
    punctuate: true,
    model: 'nova',
    language: 'sv',
    interim_results: false,
  });

  dgSocket.on('open', () => {
    console.log('🧠 Deepgram WebSocket öppen');
  });

  dgSocket.on('error', (error) => {
    console.error('🚨 Deepgram fel:', error);
  });

  dgSocket.on('transcriptReceived', async (data) => {
    const transcript = JSON.parse(data).channel.alternatives[0].transcript;
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
        dgSocket.send(audio);
      }
    } catch (e) {
      console.error('❌ WS/Media-fel:', e.message);
    }
  });

  ws.on('close', () => {
    console.log(`❌ WS stängd för ${callSid}`);
    dgSocket.finish();
  });
}

function pathFromTmp(fullPath) {
  const filename = fullPath.split('/').pop();
  return `audio/${filename}`;
}

module.exports = { startTranscription };
