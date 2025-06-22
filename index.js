const express = require('express');
const { getAndClearAudioUrl } = require('./mediaServer');
require('dotenv').config();

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use('/audio', express.static('public/audio'));

// Inkommande samtal – Stream + första fras + redirect till loopen
app.post('/incoming-call', (req, res) => {
  const callSid = req.body.CallSid || 'unknown';
  console.log(`📞 Inkommande samtal, CallSid = ${callSid}`);

  res.type('text/xml');
  res.send(`
    <?xml version="1.0" encoding="UTF-8"?>
    <Response>
      <Start>
        <Stream url="wss://${process.env.RENDER_HOSTNAME}/media?CallSid=${callSid}" track="inbound_audio"/>
      </Start>
      <Say voice="Polly.Swedish">Ge mig bara en sekund, älskling...</Say>
      <Redirect>/next-reply</Redirect>
    </Response>
  `);
});

// Loopen: Spela nytt ljud eller säg nåt snuskigt om inget nytt finns
app.get('/next-reply', (req, res) => {
  const url = getAndClearAudioUrl();

  res.type('text/xml');

  if (!url) {
    console.log('⏳ Inget nytt ljud – spelar väntande fras');
    res.send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Say voice="Polly.Swedish">Mmm... är du kvar älskling? Jag vill höra mer av dig...</Say>
        <Redirect>/next-reply</Redirect>
      </Response>
    `);
  } else {
    console.log('🔊 Spelar upp nytt ljud:', url);
    res.send(`
      <?xml version="1.0" encoding="UTF-8"?>
      <Response>
        <Play>${url}</Play>
        <Redirect>/next-reply</Redirect>
      </Response>
    `);
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`✅ Amaia backend live på port ${PORT}`);
});
