// mediaServer.js

const { createClient } = require('@deepgram/sdk');
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const { getGptResponse } = require('./gpt');
const { speak } = require('./eleven');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');

/**
 * startTranscription
 * - ws: WebSocket-anslutningen från Twilio
 * - callSid: det unika Call SID som identifierar samtalet
 */
async function startTranscription(ws, callSid) {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken  = process.env.TWILIO_AUTH_TOKEN;

  console.log(`🎙️ Startar transkribering för ${callSid}`);

  // Skapa en live-transkriptionsström
  const dgStream = deepgram.transcription.live({
    punctuate: true,
    interim_results: false,
    language: 'sv'
  });

  // När Deepgram får färdiga transkript:
  dgStream.on('transcriptReceived', async (data) => {
    const transcript = data.channel.alternatives[0].transcript;
    if (!transcript) return;

    console.log(`📜 Transkriberat (${callSid}):`, transcript);

    // Hämta GPT-svar
    const gptReply = await getGptResponse(transcript);
    console.log(`🤖 GPT-svar (${callSid}):`, gptReply);

    // Skapa ljudfil med ElevenLabs
    const audioPath = await speak(gptReply);
    const publicUrl = `https://${process.env.RENDER_HOSTNAME}${audioPath}`;
    console.log(`🔊 Spelar upp (${callSid}):`, publicUrl);

    // Twilio-redirect med <Play>
    await axios.post(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Calls/${callSid}.xml`,
      `<Response><Play>${publicUrl}</Play></Response>`,
      {
        headers: { 'Content-Type': 'text/xml' },
        auth: { username: accountSid, password: authToken }
      }
    );
  });

  dgStream.on('error', (err) => {
    console.error('❌ Deepgram error:', err);
  });

  // Skicka alla inkommande audio-meddelanden till Deepgram
  ws.on('message', (msg) => {
    dgStream.send(msg);
  });

  ws.on('close', () => {
    console.log(`❌ WebSocket stängd för ${callSid}`);
    dgStream.finish();
  });
}

module.exports = { startTranscription };
