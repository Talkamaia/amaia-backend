const { createClient } = require('@deepgram/sdk');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const { speak } = require('./eleven');
const { getGptResponse } = require('./gpt');
require('dotenv').config();

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

async function startTranscription(ws, callSid) {
  if (!callSid) {
    console.warn('❌ Saknar CallSid – WS avbryts');
    ws.close();
    return;
  }

  console.log(`🎙️ Startar transkribering för ${callSid}`);

  const dgSocket = deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    punctuate: true,
    interim_results: false,
  });

  dgSocket.on('open', () => {
    console.log('🧠 Deepgram WebSocket öppen');
  });

  dgSocket.on('error', (error) => {
    console.error('🚨 Deepgram fel:', error);
  });

  dgSocket.on('transcriptReceived', async (data) => {
    const transcript = data.channel.alternatives[0]?.transcript;
    if (!transcript || transcript.length < 1) return;

    console.log(`👂 Kunde höras: ${transcript}`);

    try {
      const reply = await getGptResponse(transcript);
      console.log(`💬 Amaia svarar: ${reply}`);

      const filepath = `/tmp/${uuidv4()}.mp3`;
      await speak(reply, filepath);

      const filename = filepath.split('/').pop();
      const twiml = `<Response><Play>${process.env.BASE_URL}/audio/${filename}</Play></Response>`;
      ws.send(JSON.stringify({ twiml }));
    } catch (err) {
      console.error('❌ GPT eller ElevenLabs fel:', err);
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

module.exports = { startTranscription };
