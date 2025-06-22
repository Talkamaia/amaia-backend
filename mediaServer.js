// mediaServer.js

const { createClient } = require('@deepgram/sdk');
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const { getGptResponse } = require('./gpt');
const { speak } = require('./eleven');
const axios = require('axios');

async function startTranscription(ws, callSid) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;

  console.log(`🎙️ Startar transkribering för ${callSid}`);

  const connection = await deepgram.listen.live({
    model: 'nova',
    language: 'sv',
    smart_format: true,
    interim_results: false
  });

  connection.on('transcriptReceived', async (data) => {
    const transcript = data.channel?.alternatives?.[0]?.transcript;
    if (!transcript) return;

    console.log(`📜 Transkriberat (${callSid}):`, transcript);

    try {
      const gptReply = await getGptResponse(transcript);
      console.log(`🤖 GPT-svar (${callSid}):`, gptReply);

      const audioPath = await speak(gptReply);
      const publicUrl = `${process.env.BASE_URL}${audioPath}`;
      console.log(`🔊 Spelar upp (${callSid}):`, publicUrl);

      await axios.post(
        `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.xml`,
        `<Response><Play>${publicUrl}</Play></Response>`,
        {
          headers: { 'Content-Type': 'text/xml' },
          auth: { username: accountSid, password: authToken }
        }
      );
    } catch (err) {
      console.error('❌ GPT eller TTS-fel:', err);
    }
  });

  connection.on('error', (err) => {
    console.error('❌ Deepgram error:', err);
  });

  ws.on('message', (msg) => {
    connection.send(msg);
  });

  ws.on('close', () => {
    console.log(`❌ WebSocket stängd för ${callSid}`);
    connection.finish();
  });
}

module.exports = { startTranscription };
