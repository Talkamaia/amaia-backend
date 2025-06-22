// ✅ index.js
require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const { getAndClearAudioUrl } = require('./mediaServer');

const app = express();
const PORT = process.env.PORT || 10000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(express.static('public'));

app.post('/incoming-call', (req, res) => {
  const callSid = req.body.CallSid || 'no-call-sid';
  console.log('📞 Inkommande samtal, CallSid =', callSid);

  const twiml = `
    <Response>
      <Start>
        <Stream url="wss://${process.env.RENDER_HOSTNAME}/media?CallSid=${callSid}" track="inbound_audio"/>
      </Start>
      <Redirect>/next-reply</Redirect>
    </Response>
  `.trim();

  console.log('🧠 TwiML till Twilio:\n', twiml);
  res.type('text/xml');
  res.send(twiml);
});

app.get('/next-reply', (req, res) => {
  const url = getAndClearAudioUrl();

  if (url) {
    const twiml = `
      <Response>
        <Play>${url}</Play>
        <Pause length="1"/>
        <Redirect>/next-reply</Redirect>
      </Response>
    `.trim();
    res.type('text/xml');
    res.send(twiml);
  } else {
    const waitTwiml = `
      <Response>
        <Pause length="2"/>
        <Redirect>/next-reply</Redirect>
      </Response>
    `.trim();
    res.type('text/xml');
    res.send(waitTwiml);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Amaia backend live på port ${PORT}`);
});
