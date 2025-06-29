require('dotenv').config();
const express = require('express');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { WebSocketServer } = require('ws');
const { createClient } = require('@deepgram/sdk');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

const PORT = process.env.PORT || 10000;
const BASE_URL = process.env.BASE_URL;

const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

// Static files (test.raw)
app.use('/audio', express.static(path.join(__dirname, 'public/audio')));

// Twilio webhook
app.post('/incoming-call', express.urlencoded({ extended: true }), (req, res) => {
  const twiml = `
    <Response>
      <Start>
        <Stream url="${BASE_URL}/media-stream" />
      </Start>
      <Say>Hej där. Ett ögonblick medan Amaia kopplas upp...</Say>
      <Pause length="60" />
    </Response>`;
  res.type('text/xml').send(twiml);
});

// WebSocket hantering
wss.on('connection', (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');

  let dgConnection = null;

  const startDeepgram = async () => {
    dgConnection = await deepgram.listen.live({
      model: 'nova',
      language: 'sv',
      smart_format: true,
    });

    dgConnection.on('open', () => {
      console.log('✅ Deepgram igång');

      // Skicka test.raw som testljud
      const testPath = path.join(__dirname, 'public/audio/test.raw');
      if (fs.existsSync(testPath)) {
        const testBuffer = fs.readFileSync(testPath);
        console.log('📤 Skickar test.raw...');
        ws.send(JSON.stringify({
          event: 'media',
          media: { payload: testBuffer.toString('base64') }
        }));
      }
    });

    dgConnection.on('transcriptReceived', (data) => {
      const transcript = data.channel?.alternatives[0]?.transcript;
      if (transcript && transcript.length > 0) {
        console.log('🗣️ Användaren sa:', transcript);
      }
    });

    dgConnection.on('error', (err) => {
      console.error('❌ Deepgram error:', err);
    });

    dgConnection.on('close', () => {
      console.log('🔒 Deepgram stängd');
    });
  };

  startDeepgram();

  ws.on('message', (msg) => {
    const data = JSON.parse(msg);

    if (data.event === 'start') {
      console.log('🚀 Stream startad');
    }

    if (data.event === 'media' && dgConnection) {
      const audio = Buffer.from(data.media.payload, 'base64');
      dgConnection.send(audio);
    }

    if (data.event === 'stop') {
      console.log('🛑 Stream stoppad');
      dgConnection.finish();
    }
  });

  ws.on('close', () => {
    console.log('🔌 Klient frånkopplad');
    if (dgConnection) dgConnection.finish();
  });
});

// Starta servern
server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);
  console.log(`==> Your service is live 🎉`);
  console.log(`==> \n==> Available at your primary URL ${BASE_URL}\n`);
});
