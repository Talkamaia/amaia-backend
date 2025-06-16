const express = require('express');
const { twiml: { VoiceResponse } } = require('twilio');

const app = express();
app.use(express.urlencoded({ extended: false }));

app.post('/incoming-call', (req, res) => {
  const twiml = new VoiceResponse();

  // hälsningsfras
  twiml.say('Ge mig bara en sekund, älskling...');

  // ✔ blockerande stream som stannar tills *du* stänger WebSocket-en
  const connect = twiml.connect();
  connect.stream({
    url: 'wss://amaia-backend-1.onrender.com/media',
    bidirectional: true          // ← viktigt!
  });

  res.type('text/xml').send(twiml.toString());
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log('Amaia backend lyssnar på', PORT));
