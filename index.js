require('dotenv').config();
const express = require('express');
const { createServer } = require('http');
const { Server } = require('ws');
const { Deepgram } = require('@deepgram/sdk');
const fs = require('fs');
const path = require('path');
const { speak } = require('./eleven');
const { v4: uuidv4 } = require('uuid');

const app = express();
const httpServer = createServer(app);
const wss = new Server({ server: httpServer });

const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;
const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;
const deepgram = new Deepgram(DEEPGRAM_API_KEY);

// Middleware
app.use(express.json());
app.use(express.static('public'));

// ✅ Twilio webhook route
app.post('/incoming-call', (req, res) => {
  const twiml = `
    <Response>
      <Start>
        <Stream url="wss://amaia-backend-1.onrender.com"/>
      </Start>
      <Say><break time="500ms"/> Ett ögonblick...</Say>
      <Pause length="60"/>
    </Response>
  `;
  res.type('text/xml');
  res.send(twiml);
});

// ✅ WebSocket handling
wss.on('connection', (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');
  let dgSocket;

  ws.on('message', async (msg) => {
    const data = JSON.parse(msg);
    if (data.event === 'start') {
      console.log('🚀 Stream startad');

      dgSocket = deepgram.transcription.live({
        punctuate: true,
        model: 'nova',
        language: 'sv'
      });

      dgSocket.on('open', () => console.log('✅ Deepgram igång'));
      dgSocket.on('close', () => console.log('🔒 Deepgram stängd'));
      dgSocket.on('error', (err) => console.error('❌ Deepgram error:', err));

      dgSocket.on('transcriptReceived', async (transcription) => {
        const t = JSON.parse(transcription);
        const text = t.channel?.alternatives[0]?.transcript;
        if (text && text.length > 0) {
          console.log('📥 Användaren sa:', text);

          // Här lägg till GPT-svar och ElevenLabs-generering
          const reply = 'Mmm, jag hör dig älskling'; // Placeholder
          const filename = `reply_${uuidv4()}.mp3`;
          const filepath = path.join(__dirname, 'public/audio', filename);
          await speak(reply, filepath);

          // Konvertera till base64 och skicka som payload till Twilio
          const audioBuffer = fs.readFileSync(filepath);
          ws.send(JSON.stringify({
            event: 'media',
            media: { payload: audioBuffer.toString('base64') }
          }));
        }
      });
    }

    if (data.event === 'media' && dgSocket) {
      const audio = Buffer.from(data.media.payload, 'base64');
      dgSocket.send(audio);
    }

    if (data.event === 'stop') {
      console.log('🛑 Stream stoppad');
      if (dgSocket) dgSocket.finish();
    }
  });

  ws.on('close', () => {
    console.log('🔌 Klient frånkopplad');
    if (dgSocket) dgSocket.finish();
  });
});

// 🟢 Start server
httpServer.listen(PORT, () => {
  console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);
  console.log(`==> Your service is live 🎉`);
  console.log(`==> \n==> Available at your primary URL ${BASE_URL}\n==>`);
});
