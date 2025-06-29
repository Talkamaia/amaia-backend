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
const products = require('./products');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const ffmpegPath = require('@ffmpeg-installer/ffmpeg').path;
const ffmpeg = require('fluent-ffmpeg');
ffmpeg.setFfmpegPath(ffmpegPath);

const PORT = process.env.PORT || 10000;
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

app.use('/audio', express.static(path.join(__dirname, 'public/audio')));
app.use(express.urlencoded({ extended: false }));
app.use(express.json());

// 🔧 Konverterar ElevenLabs-mp3 till 8kHz PCM s16le
async function speakAndConvert(text, sessionId) {
  const mp3Path = path.join(__dirname, 'public/audio', `${sessionId}.mp3`);
  const rawPath = path.join(__dirname, 'public/audio', `${sessionId}.raw`);

  console.log('🗣️ TTS startar för:', text);
  await speak(text, mp3Path);
  console.log('✅ MP3 skapad:', mp3Path);

  await new Promise((resolve, reject) => {
    ffmpeg(mp3Path)
      .audioFrequency(8000)
      .audioCodec('pcm_s16le')
      .audioChannels(1)
      .format('s16le')
      .on('end', () => {
        console.log('✅ RAW skapad:', rawPath);
        resolve();
      })
      .on('error', (err) => {
        console.error('❌ FFmpeg error:', err);
        reject(err);
      })
      .save(rawPath);
  });

  const buffer = fs.readFileSync(rawPath);
  console.log('📦 Bufferlängd (bytes):', buffer.length);
  return buffer;
}

// 📞 Twilio webhook
app.post('/incoming-call', (req, res) => {
  res.type('text/xml');
  res.send(`
    <Response>
      <Start>
        <Stream url="wss://amaia-backend-1.onrender.com/media" track="inbound_track"/>
      </Start>
      <Pause length="60"/>
    </Response>
  `);
});

app.get('/incoming-call', (req, res) => {
  res.type('text/xml');
  res.send(`
    <Response>
      <Start>
        <Stream url="wss://amaia-backend-1.onrender.com/media" track="inbound_track"/>
      </Start>
      <Say voice="Polly.Joanna" language="sv-SE">Ett ögonblick älskling, jag kommer snart...</Say>
      <Pause length="90"/>
    </Response>
  `);
});

// 🧠 WebSocket stream
wss.on('connection', async (ws) => {
  console.log('🔌 WebSocket-anslutning etablerad');
  const sessionId = uuidv4();

  const deepgramLive = await deepgram.listen.live({
    model: 'nova-2-general',
    language: 'sv-SE',
    smart_format: true,
    interim_results: false,
  });

  deepgramLive.on('open', () => console.log('✅ Deepgram igång'));
  deepgramLive.on('close', () => console.log('🔒 Deepgram stängd'));
  deepgramLive.on('warning', (w) => console.warn('⚠️ DG-varning:', w));
  deepgramLive.on('error', (e) => console.error('🔥 DG-fel:', e));

  const intro = "Mmm... hej älskling. Jag är så glad att du ringde mig...";
  const introBuffer = await speakAndConvert(intro, sessionId);
  ws.send(JSON.stringify({
    event: 'media',
    media: { payload: introBuffer.toString('base64') }
  }));
  console.log('📤 Skickade intro via ElevenLabs');

  deepgramLive.on('transcriptReceived', async (data) => {
    const transcript = data.channel.alternatives[0]?.transcript;
    const timestamp = new Date().toISOString();

    if (!transcript || transcript.trim() === '') {
      console.log(`[${timestamp}] ⚠️ Tom transkription`);
      const fallback = "Förlåt älskling, jag hörde inte riktigt. Kan du säga det igen?";
      const fallbackBuffer = await speakAndConvert(fallback, sessionId);
      ws.send(JSON.stringify({ event: 'media', media: { payload: fallbackBuffer.toString('base64') } }));
      return;
    }

    console.log(`[${timestamp}] 🗣️ Du sa: "${transcript}"`);
    fs.appendFile('transcripts.log', `[${timestamp}] ${transcript}\n`, () => {});

    const gptResponse = await askGPT(transcript);
    const responseBuffer = await speakAndConvert(gptResponse, sessionId);
    ws.send(JSON.stringify({ event: 'media', media: { payload: responseBuffer.toString('base64') } }));
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
        deepgramLive.finish();
      }
    } catch (err) {
      console.error('❌ WS-fel:', err);
    }
  });

  ws.on('close', () => {
    deepgramLive.finish();
    console.log('🔌 Klient frånkopplad');
  });
});

// 💳 Stripe webhook
app.post('/stripe-webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;
  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('❌ Webhook verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const priceId = session.display_items?.[0]?.price?.id || session.line_items?.data?.[0]?.price?.id;
    const userId = session.client_reference_id || session.customer_email;

    const product = products[priceId];
    if (product && userId) {
      console.log(`💳 Köpt paket: ${product.name} (${product.amount} ${product.type}) av ${userId}`);
      let balances = {};
      try {
        balances = JSON.parse(fs.readFileSync('./user_balances.json', 'utf8') || '{}');
      } catch {
        balances = {};
      }
      if (!balances[userId]) {
        balances[userId] = { call: 0, chat: 0 };
      }
      balances[userId][product.type] += product.amount;
      fs.writeFileSync('./user_balances.json', JSON.stringify(balances, null, 2));
      console.log(`✅ Uppdaterat saldo: ${balances[userId][product.type]} ${product.type} kvar`);
    } else {
      console.warn('⚠️ Okänt price ID eller användare:', priceId);
    }
  }

  res.status(200).send('Webhook mottagen');
});

app.get('/', (req, res) => res.send('✅ Amaia backend live'));
app.get('/test', (req, res) => res.send('✅ Test OK'));

server.listen(PORT, () => {
  console.log(`✅ Amaia backend + WS + Twilio live på port ${PORT}`);
});
