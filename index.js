const express = require('express');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');
const path = require('path');
const { transcribeWhisper } = require('./whisper');
const { askGPT } = require('./gpt');
const { generateSpeech } = require('./eleven');
const { v4: uuidv4 } = require('uuid');
require('dotenv').config();

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const PORT = process.env.PORT || 10000;

console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);

app.get('/', (req, res) => {
  res.send('Amaia backend med Whisper aktiverad!');
});

// Media endpoint för Twilio att streama till
app.post('/incoming-call', (req, res) => {
  res.set('Content-Type', 'text/xml');
  res.send(`
    <Response>
      <Start>
        <Stream url="wss://${process.env.BASE_URL}/media" track="inbound_track"/>
      </Start>
      <Say voice="Polly.Joanna" language="sv-SE">Ett ögonblick älskling, jag kommer snart...</Say>
      <Pause length="90"/>
    </Response>
  `);
});

// WebSocket för realtidsstreaming
wss.on('connection', (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');
  let audioBuffer = [];

  ws.on('message', async (msg) => {
    const data = JSON.parse(msg);

    if (data.event === 'start') {
      console.log('🚀 Stream startad');
    }

    if (data.event === 'media') {
      const audio = Buffer.from(data.media.payload, 'base64');
      audioBuffer.push(audio);
    }

    if (data.event === 'stop') {
      console.log('🛑 Stream stoppad');
      const rawAudio = Buffer.concat(audioBuffer);
      const tempFile = path.join(__dirname, 'audio', `${uuidv4()}.wav`);
      fs.writeFileSync(tempFile, rawAudio);

      try {
        const transcript = await transcribeWhisper(tempFile);
        console.log(`🗣️ Användare: ${transcript}`);
        const reply = await askGPT(transcript);
        console.log(`🤖 GPT: ${reply}`);
        const audioPath = await generateSpeech(reply);
        const audioData = fs.readFileSync(audioPath);
        ws.send(JSON.stringify({ audio: audioData.toString('base64') }));
      } catch (err) {
        console.error('❌ Whisper/GPT/Eleven error:', err.message);
      }

      fs.unlinkSync(tempFile);
      audioBuffer = [];
    }
  });

  ws.on('close', () => {
    console.log('🔒 Klient frånkopplad');
  });
});

server.listen(PORT);
