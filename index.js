// index.js
require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { Readable } = require('stream');
const { OpenAI } = require('openai');
const axios = require('axios');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const FormData = require('form-data');

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const sessions = new Map();
const upload = multer();

app.use(express.json());

// WebSocket media stream
wss.on('connection', (ws) => {
  const sessionId = uuidv4();
  console.log('🔌 WebSocket-anslutning etablerad');

  const audioChunks = [];

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);
    if (data.event === 'media') {
      const audio = Buffer.from(data.media.payload, 'base64');
      audioChunks.push(audio);
    }
  });

  ws.on('close', async () => {
    console.log('🔒 Klient frånkopplad');
    if (audioChunks.length === 0) return;

    const filePath = `./recordings/${sessionId}.webm`;
    fs.writeFileSync(filePath, Buffer.concat(audioChunks));

    try {
      const transcription = await transcribeWithWhisper(filePath);
      console.log('📝 Transkribering:', transcription);

      const reply = await generateGPTReply(transcription);
      console.log('🤖 GPT-svar:', reply);

      await playWithElevenLabs(reply);
    } catch (err) {
      console.error('❌ Whisper/GPT-fel:', err);
    } finally {
      fs.unlinkSync(filePath);
    }
  });
});

// Twilio webhook
app.post('/incoming-call', (req, res) => {
  console.log('📞 Twilio webhook mottagen!');
  res.set('Content-Type', 'text/xml');
  res.send(`<?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Start>
        <Stream url="wss://${req.headers.host}/media" track="inbound_track"/>
      </Start>
      <Say voice="Polly.Joanna" language="sv-SE">Ett ögonblick älskling, jag kommer snart...</Say>
      <Pause length="90"/>
    </Response>`);
});

// Whisper transkribering
async function transcribeWithWhisper(filePath) {
  const file = fs.createReadStream(filePath);
  const response = await openai.audio.transcriptions.create({
    file,
    model: 'whisper-1',
    language: 'sv'
  });
  return response.text;
}

// GPT-svar
async function generateGPTReply(input) {
  const res = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Du är Amaia, en sensuell och flörtig AI-tjej som pratar med en man som ringer dig.' },
      { role: 'user', content: input }
    ]
  });
  return res.choices[0].message.content;
}

// ElevenLabs tts
async function playWithElevenLabs(text) {
  const voiceId = process.env.ELEVEN_VOICE_ID;
  const apiKey = process.env.ELEVEN_API_KEY;

  const response = await axios({
    method: 'POST',
    url: `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/stream`,
    headers: {
      'xi-api-key': apiKey,
      'Content-Type': 'application/json'
    },
    data: {
      text,
      model_id: 'eleven_monolingual_v1',
      voice_settings: { stability: 0.4, similarity_boost: 0.7 }
    },
    responseType: 'stream'
  });

  const outputPath = `./public/audio/output_${Date.now()}.mp3`;
  const writer = fs.createWriteStream(outputPath);
  response.data.pipe(writer);

  return new Promise((resolve) => {
    writer.on('finish', () => {
      console.log('🔊 ElevenLabs-svar sparat:', outputPath);
      resolve();
    });
  });
}

server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);
});
