const express = require('express');
const { createServer } = require('http');
const { Server } = require('ws');
const { createClient } = require('@deepgram/sdk');
const { speak } = require('./eleven');
const { askGPT } = require('./gpt');
const fs = require('fs');
const path = require('path');
const fetch = require('node-fetch'); // Lägg till fetch
require('dotenv').config();

const app = express();
const server = createServer(app);
const wss = new Server({ server });

const PORT = process.env.PORT || 10000;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const BASE_URL = process.env.BASE_URL;

const deepgram = createClient(DEEPGRAM_API_KEY);

app.use(express.static('public'));
app.use(express.urlencoded({ extended: true }));

app.post('/incoming-call', (req, res) => {
  const twiml = `
    <Response>
      <Start>
        <Stream url="wss://${req.headers.host}/media" />
      </Start>
      <Play>${BASE_URL}/audio/intro.mp3</Play>
    </Response>
  `;
  res.type('text/xml');
  res.send(twiml);
});

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');

  let dgConnection = null;

  ws.on('message', async (msg) => {
    const data = JSON.parse(msg);

    if (data.event === 'start') {
      console.log('🚀 Stream startad');

      dgConnection = deepgram.listen.live({
        model: 'nova',
        language: 'sv',
        interim_results: false,
        encoding: 'linear16',
        sample_rate: 8000,
        channels: 1,
      });

      dgConnection.on('transcriptReceived', async (transcription) => {
        const sentence = transcription.channel.alternatives[0]?.transcript;
        if (sentence && sentence.length > 1) {
          console.log('🗣 Från kund:', sentence);

          try {
            const gptReply = await askGPT(sentence);
            console.log('🤖 Amaia svarar:', gptReply);

            const audioPath = path.join(__dirname, 'public/audio/reply.mp3');
            await speak(gptReply, audioPath);

            // Vänta tills filen är tillgänglig via HTTP
            const waitForFile = async (url, timeout = 4000) => {
              const start = Date.now();
              while (Date.now() - start < timeout) {
                try {
                  const res = await fetch(url, { method: 'HEAD' });
                  if (res.ok) return true;
                } catch (_) {}
                await new Promise(res => setTimeout(res, 200));
              }
              throw new Error('Ljudfilen blev inte tillgänglig i tid');
            };

            const audioUrl = `${BASE_URL}/audio/reply.mp3`;
            await waitForFile(audioUrl);

            ws.send(JSON.stringify({
              event: 'play',
              audio_url: audioUrl
            }));
          } catch (err) {
            console.error('🚨 Fel i svarsgenerering:', err.message);
          }
        }
      });

      dgConnection.on('error', (err) => {
        console.error('❌ Deepgram error:', err);
      });

    } else if (data.event === 'media') {
      if (dgConnection) {
        dgConnection.send(data.media.payload);
      }
    } else if (data.event === 'stop') {
      console.log('🛑 Stream stoppad');
      if (dgConnection) dgConnection.finish();
    }
  });

  ws.on('close', () => {
    console.log('🔒 Klient frånkopplad');
    if (dgConnection) dgConnection.finish();
  });
});

server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);
});
