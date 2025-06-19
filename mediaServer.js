// mediaServer.js
require('dotenv').config();
const WebSocket   = require('ws');
const fetch       = require('node-fetch');
const { newSocket } = require('./stt');
const askGPT      = require('./gpt');

function startMediaServer(server) {
  const wss = new WebSocket.Server({ server, path: '/media' });

  wss.on('connection', (twilioWS) => {
    console.log('🔗 Twilio stream ansluten');

    /* 1. starta STT-socket */
    const dg = newSocket(handleUserText);

    /* 2. ta emot ljud från Twilio → STT */
    twilioWS.on('message', buf => {
      const d = JSON.parse(buf);

      if (d.event === 'media') {
        const pcm = Buffer.from(d.media.payload, 'base64');
        dg.send(pcm);                                 // pumpa in
      }
      if (d.event === 'stop') dg.finish();
    });

    twilioWS.on('close', () => dg.finish());
  });

  async function handleUserText(text) {
    console.log('🗣', text);

    /* GPT-svar */
    let reply;
    try {
      reply = await askGPT(text);
    } catch (e) {
      console.error('GPT-fel', e);
      reply = 'Förlåt, jag hörde inte riktigt...';
    }
    console.log('🤖', reply);

    /* ElevenLabs-stream */
    const resp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${process.env.ELEVEN_VOICE_ID}/stream`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': process.env.ELEVEN_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: reply,
          model_id: 'eleven_multilingual_v2',
          output_format: 'pcm_16000',
          optimize_streaming_latency: 0          // 0 = musik, 4 = lägst latens
        })
      }
    );

    /* 3. skicka chunk-för-chunk till ALLA öppna Twilio-WS */
    for await (const chunk of resp.body) {
      const payload = chunk.toString('base64');
      wss.clients.forEach(ws => {
        if (ws.readyState === WebSocket.OPEN)
          ws.send(JSON.stringify({ event: 'media', media: { payload } }));
      });
    }
  }

  console.log('🎧 MediaServer kör');
}

module.exports = { startMediaServer };
