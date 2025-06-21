import express from 'express';
import bodyParser from 'body-parser';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { mediaServer } from './mediaServer.js';
import { handleChat } from './gpt.js';
import { config } from './config.js';

const app = express();
const server = createServer(app);
const io = new Server(server);

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Root check
app.get('/', (req, res) => {
  res.send('🎧 Amaia backend live');
});

// Incoming phone call from Twilio
app.post('/incoming-call', (req, res) => {
  const wsUrl = `${process.env.BASE_URL || 'wss://amaia-backend-1.onrender.com'}/media`;

  const twiml = `
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Start>
        <Stream url="${wsUrl}" />
      </Start>
      <Say voice="Polly.Salli">Ett ögonblick... jag lyssnar.</Say>
    </Response>
  `;

  res.set('Content-Type', 'text/xml');
  res.send(twiml.trim());
});

// GPT-chat endpoint
app.post('/chat', async (req, res) => {
  const userInput = req.body.message;
  const response = await handleChat(userInput);
  res.json({ response });
});

// WebSocket för Twilio Media Streams
io.of('/media').on('connection', (socket) => {
  mediaServer(socket, config);
});

// Starta server
const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`✅ Amaia backend live på port ${PORT}`);
});
