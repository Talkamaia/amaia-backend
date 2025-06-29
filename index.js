require('dotenv').config();
const express = require('express');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
const { createClient } = require('@deepgram/sdk');
const { speak } = require('./eleven');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL || 'https://amaia-backend-1.onrender.com';
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

const deepgram = createClient(DEEPGRAM_API_KEY);

app.use('/public', express.static(path.join(__dirname, 'public')));

wss.on('connection', async (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');

  let deepgramLive = null;
  let lastTranscription = '';
  let isSpeaking = false;

  ws.on('message', async (message) => {
    const msg = JSON.parse(message);

    if (msg.event === 'start') {
      console.log('🚀 Stream startad');
      deepgramLive = await deepgram.listen.live.v("1").transcribe({
        model: "nova",
        interim_results: true,
        encoding: "linear16",
        sample_rate: 8000,
      });

      deepgramLive.on('transcriptReceived', async (data) => {
        const transcript = JSON.parse(data)?.channel?.alternatives?.[0]?.transcript || '';
        if (transcript && !isSpeaking && transcript !== lastTranscription) {
          lastTranscription = transcript;
          console.log(`👂 Transkriberat: ${transcript}`);

          isSpeaking = true;
          const id = uuidv4();
          const filepath = path.join(__dirname, 'public/audio', `${id}.mp3`);
          const rawPath = path.join(__dirname, 'public/audio', `${id}.raw`);

          const gptResponse = `Mmm... hej älskling. Jag är så glad att du ringde mig...`; // Här ska GPT-anrop in

          try {
            await speak(gptResponse, filepath);
            console.log(`✅ MP3 skapad: ${filepath}`);

            // Konvertera MP3 → RAW för Twilio
            const ffmpeg = require('fluent-ffmpeg');
            ffmpeg(filepath)
              .audioCodec('pcm_s16le')
              .audioFrequency(8000)
              .audioChannels(1)
              .format('s16le')
              .on('end', () => {
                const buffer = fs.readFileSync(rawPath);
                console.log(`✅ RAW skapad: ${rawPath}`);
                ws.send(JSON.stringify({
                  event: 'media',
                  media: { payload: buffer.toString('base64') }
                }));
                isSpeaking = false;
              })
              .on('error', (err) => {
                console.error('❌ FFmpeg-fel:', err);
                isSpeaking = false;
              })
              .save(rawPath);
          } catch (err) {
            console.error('🚨 ElevenLabs error:', err.message);
            isSpeaking = false;
          }
        }
      });

      deepgramLive.on('error', (err) => {
        console.error('🚨 Deepgram-fel:', err);
      });

      deepgramLive.on('close', () => {
        console.log('🔒 Deepgram stängd');
      });
    }

    if (msg.event === 'media' && deepgramLive) {
      const audio = Buffer.from(msg.media.payload, 'base64');
      deepgramLive.send(audio);
    }

    if (msg.event === 'stop' && deepgramLive) {
      deepgramLive.finish();
      console.log('🛑 Stream stoppad');
    }
  });

  ws.on('close', () => {
    console.log('🔌 Klient frånkopplad');
    if (deepgramLive) deepgramLive.finish();
  });
});

server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);
  console.log(`==> Your service is live 🎉`);
  console.log(`==> \n==> ///////////////////////////////////////////////////////////`);
  console.log(`==> \n==> Available at your primary URL ${BASE_URL}`);
  console.log(`==> \n==> ///////////////////////////////////////////////////////////`);
});
