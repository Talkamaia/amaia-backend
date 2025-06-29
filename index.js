const express = require('express');
const { createServer } = require('http');
const { Server } = require('ws');
const { askGPT } = require('./gpt');
const { speak } = require('./eleven');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const upload = multer();
const { OpenAI } = require('openai');
require('dotenv').config();

const app = express();
const server = createServer(app);
const wss = new Server({ server });

const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(express.static('public'));

app.post('/incoming-call', (req, res) => {
  const twiml = `
    <Response>
      <Start>
        <Stream url="wss://${req.headers.host}/media" track="inbound_track"/>
      </Start>
      <Say voice="Polly.Joanna" language="sv-SE">Ett ögonblick älskling, jag kommer snart...</Say>
      <Pause length="90"/>
    </Response>
  `;
  res.type('text/xml');
  res.send(twiml);
});

wss.on('connection', (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');

  let audioChunks = [];

  ws.on('message', async (msg) => {
    const data = JSON.parse(msg);

    if (data.event === 'start') {
      console.log('🚀 Stream startad');
      audioChunks = [];

    } else if (data.event === 'media') {
      const audioBuffer = Buffer.from(data.media.payload, 'base64');
      audioChunks.push(audioBuffer);

    } else if (data.event === 'stop') {
      console.log('🛑 Stream stoppad');
      const audio = Buffer.concat(audioChunks);

      try {
        const audioStream = Readable.from(audio);
        const transcription = await openai.audio.transcriptions.create({
          file: audioStream,
          model: 'whisper-1',
          response_format: 'text',
          language: 'sv'
        });

        console.log('🗣 Från kund:', transcription);

        const reply = await askGPT(transcription);
        console.log('🤖 Amaia svarar:', reply);

        const audioPath = path.join(__dirname, 'public/audio/reply.mp3');
        await speak(reply, audioPath);

        ws.send(JSON.stringify({
          event: 'play',
          audio_url: `${BASE_URL}/audio/reply.mp3`
        }));
      } catch (err) {
        console.error('🚨 Whisper error:', err.message);
      }
    }
  });

  ws.on('close', () => {
    console.log('🔒 Klient frånkopplad');
  });
});

server.listen(PORT, () => {
  console.log(`✅ Amaia backend med Whisper live på port ${PORT}`);
});
