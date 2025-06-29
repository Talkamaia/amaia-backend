// index.js (komplett och uppdaterad med live GPT + ElevenLabs-svar via Media Streams)
require('dotenv').config();
const express = require('express');
const { Deepgram } = require('@deepgram/sdk');
const WebSocket = require('ws');
const fs = require('fs');
const path = require('path');
const { OpenAI } = require('openai');
const { generateSpeech, convertToRaw } = require('./eleven');
const { askGPT } = require('./gpt');
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const server = require('http').createServer(app);
const wss = new WebSocket.Server({ server });
const PORT = process.env.PORT || 10000;

console.log(`\u2705 Amaia backend + WS + Twilio live på port ${PORT}`);

app.use(express.static(path.join(__dirname, 'public')));

wss.on('connection', (ws) => {
  console.log('\ud83d\udd0c WebSocket-anslutning etablerad');
  const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);
  const deepgramLive = deepgram.transcription.live({
    punctuate: true,
    language: 'sv'
  });

  deepgramLive.on('transcriptReceived', async (msg) => {
    const data = JSON.parse(msg);
    const transcript = data.channel?.alternatives[0]?.transcript;
    if (transcript) {
      console.log(`\u2705 Användaren sa: ${transcript}`);
      const gptResponse = await askGPT(transcript);
      console.log(`\u2705 GPT svarar: ${gptResponse}`);

      const mp3Path = await generateSpeech(gptResponse);
      const rawPath = await convertToRaw(mp3Path);

      const rawBuffer = fs.readFileSync(rawPath);
      const payload = rawBuffer.toString('base64');

      ws.send(JSON.stringify({
        event: 'media',
        media: { payload }
      }));
      console.log(`\ud83d\udce4 Skickade röstsvar till Twilio (${rawBuffer.length} bytes)`);
    }
  });

  deepgramLive.on('error', (err) => console.error('Deepgram fel:', err));

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.event === 'media') {
      const audio = Buffer.from(data.media.payload, 'base64');
      deepgramLive.send(audio);
    } else if (data.event === 'start') {
      console.log('\ud83d\ude80 Stream startad');
    } else if (data.event === 'stop') {
      console.log('\u274c Stream stoppad');
      deepgramLive.finish();
    }
  });

  ws.on('close', () => {
    console.log('\ud83d\udd10 Klient frånkopplad');
    deepgramLive.finish();
  });
});

server.listen(PORT);
