require('dotenv').config();
const express = require('express');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { createServer } = require('http');
const { WebSocketServer } = require('ws');
const { createClient } = require('@deepgram/sdk');
const { askGPT } = require('./gpt');
const { speak } = require('./eleven');
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});
app.get('/test', (req, res) => {
  res.send('✅ Amaia backend OK 🧠🎧');
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

const PORT = process.env.PORT || 10000;
const app = express();
const server = createServer(app);

// 🛠️ Twilio webhook
app.use(express.urlencoded({ extended: false }));
app.post('/incoming-call', (req, res) => {
  res.type('text/xml');
  res.send(`
    <Response>
      <Start>
        <Stream url="wss://amaia-backend-1.onrender.com"/>
      </Start>
      <Say voice="Polly.Salli">Vänta en liten stund älskling, jag lyssnar på dig nu...</Say>
    </Response>
  `);
});


// 🎧 Serva ljud
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
app.get('/', (req, res) => res.send('✅ Amaia backend är live'));

const wss = new WebSocketServer({ server });
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

wss.on('connection', async (ws) => {
  console.log('🔌 Klient ansluten till WebSocket');
  const sessionId = uuidv4();
  const filepath = path.join(__dirname, 'public/audio', `${sessionId}.mp3`);


  const deepgramLive = await deepgram.listen.live({
  model: 'nova-2-general',  // Nova‑2 med svenska stöd
  language: 'sv-SE',        // eller 'sv' – de är alias, kommer ge samma modell :contentReference[oaicite:3]{index=3}
  smart_format: true,
  interim_results: false
});
  deepgramLive.on('error', (err) => {
    console.error('❗ Deepgram error:', err);
  });

  deepgramLive.on('transcriptReceived', async (data) => {
  const transcript = data.channel.alternatives[0]?.transcript;

  if (!transcript || transcript.trim() === '') {
    console.log('⚠️ Tomt transkript, skickar fallback-svar...');
    const fallback = "Förlåt älskling, jag hörde inte riktigt. Kan du säga det igen?";
    const audioBuffer = await speak(fallback, filepath);

    const message = {
      event: 'media',
      media: {
        payload: audioBuffer.toString('base64')
      }
    };

    ws.send(JSON.stringify(message));
    return;
  }

  const timestamp = new Date().toISOString();
console.log(`[${timestamp}] 🗣️ Kunden sa: "${transcript}"`);

  const gptResponse = await askGPT(transcript);
  console.log('🤖 GPT-svar:', gptResponse);

  const audioBuffer = await speak(gptResponse, filepath);

  const message = {
    event: 'media',
    media: {
      payload: audioBuffer.toString('base64')
    }
  };

  ws.send(JSON.stringify(message));
});

  ws.on('message', (msg) => {
    try {
      const data = JSON.parse(msg.toString());

      if (data.event === 'start') {
        console.log('🚀 Stream startad');
      }

      if (data.event === 'media') {
        const audio = Buffer.from(data.media.payload, 'base64');
        deepgramLive.send(audio);
      }

     if (data.event === 'stop') {
  console.log('🛑 Stream stoppad');
  if (deepgramLive && deepgramLive.connection) {
    deepgramLive.connection.close(); // 
  }
}

    } catch (err) {
      console.error('❌ Fel vid WebSocket-message:', err);
    }
  });

  ws.on('close', () => {
  if (deepgramLive && deepgramLive.connection) {
    deepgramLive.connection.close(); // ✅ RÄTT
  }
  console.log('🔌 Klient frånkopplad');
});
});

// 🚀 Starta server
server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WebSocket + webhook live på port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`🚨 Port ${PORT} är redan i bruk. Avslutar.`);
    process.exit(1);
  } else {
    console.error('❌ Serverfel:', err);
  }
});

