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

const PORT = process.env.PORT || 10000;
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// 💥 Fånga oväntade fel
process.on('uncaughtException', (err) => {
  console.error('❌ Uncaught Exception:', err);
});
process.on('unhandledRejection', (reason, promise) => {
  console.error('❌ Unhandled Rejection at:', promise, 'reason:', reason);
});

// 🔊 Serva ljudfiler
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

// 🧪 Test-endpoint
app.get('/test', (req, res) => {
  res.send('✅ Amaia backend OK 🎧');
});

// 🌐 Startsida
app.get('/', (req, res) => res.send('✅ Amaia backend är live'));

// ☎️ Twilio webhook – inkommande samtal
app.use(express.urlencoded({ extended: false }));
app.post('/incoming-call', (req, res) => {
  res.type('text/xml');
  res.send(`
    <Response>
      <Start>
        <Stream url="wss://amaia-backend-1.onrender.com/media"/>
      </Start>
      <Say voice="Polly.Salli">
        Mmm... hej älskling. Så du ringde mig ändå...
        Jag har längtat efter att höra din röst hela dagen.
        Ge mig bara ett ögonblick, så lutar jag mig tillbaka och låter dig viska precis vad du vill i mitt öra.
      </Say>
      <Pause length="60"/>
    </Response>
  `);
});

// 🎧 WebSocket-hantering – Realtidssamtal
wss.on('connection', async (ws) => {
  console.log('🔌 Klient ansluten till WebSocket');
  const sessionId = uuidv4();
  const filepath = path.join(__dirname, 'public/audio', `${sessionId}.mp3`);

  const deepgramLive = await deepgram.listen.live({
    model: 'nova-2-general',
    language: 'sv-SE',
    smart_format: true,
    interim_results: false
  });

  deepgramLive.on('error', (err) => {
    console.error('❗ Deepgram error:', err);
  });

  deepgramLive.on('transcriptReceived', async (data) => {
    console.log('📡 Transkript mottaget:', JSON.stringify(data));
    const transcript = data.channel.alternatives[0]?.transcript;
    const timestamp = new Date().toISOString();

    if (!transcript || transcript.trim() === '') {
      console.log(`[${timestamp}] ⚠️ Tomt transkript`);
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

    console.log(`[${timestamp}] 🗣️ Kunden sa: "${transcript}"`);
    fs.appendFile('transcripts.log', `[${timestamp}] ${transcript}\n`, (err) => {
      if (err) console.error('🚨 Kunde inte spara logg:', err);
    });

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

      if (data.event === 'start') console.log('🚀 Stream startad');
      if (data.event === 'media') {
        const audio = Buffer.from(data.media.payload, 'base64');
        deepgramLive.send(audio);
      }
      if (data.event === 'stop') {
        console.log('🛑 Stream stoppad');
        if (deepgramLive?.connection) deepgramLive.connection.close();
      }
    } catch (err) {
      console.error('❌ Fel vid WebSocket-message:', err);
    }
  });

  ws.on('close', () => {
    if (deepgramLive?.connection) deepgramLive.connection.close();
    console.log('🔌 Klient frånkopplad');
  });
});

// 🚀 Starta servern
server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WebSocket + Twilio live på port ${PORT}`);
}).on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`🚨 Port ${PORT} är redan i bruk. Avslutar.`);
    process.exit(1);
  } else {
    console.error('❌ Serverfel:', err);
  }
});
