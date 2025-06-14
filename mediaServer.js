// ✅ mediaServer.js – realtids AI-samtal med Deepgram + GPT + ElevenLabs
const { Deepgram } = require("@deepgram/sdk");
const askGPT = require("./gpt");
const synthesize = require("./eleven");
require("dotenv").config();

const deepgram = new Deepgram(process.env.DEEPGRAM_API_KEY);

function startMediaServer(ws) {
  console.log("🎧 Media Server kör");

  const deepgramLive = deepgram.transcription.live({
    punctuate: true,
    language: "sv", // eller "en" vid engelska samtal
    encoding: "mulaw",
    sample_rate: 8000,
  });

  // 🔁 Ta emot transkript från Deepgram
  deepgramLive.on("transcriptReceived", async (data) => {
    const transcript = JSON.parse(data);
    const text = transcript.channel.alternatives[0]?.transcript;

    if (text && text.length > 1) {
      console.log("🗣 Användaren sa:", text);

      const gptResponse = await askGPT(text);
      console.log("🤖 GPT svarar:", gptResponse);

      const audioPath = await synthesize(gptResponse);
      const filename = audioPath.split("/").pop();

      const twiml = `
        <Response>
          <Play>https://amaia-backend-3w9f.onrender.com/audio/${filename}</Play>
        </Response>
      `;

      ws.send(JSON.stringify({ event: "sendTwiml", twiml }));
    }
  });

  deepgramLive.on("error", (err) => {
    console.error("❌ Deepgram-fel:", err.message);
  });

  // 🎧 Ta emot ljud från Twilio
  ws.on("message", (msg) => {
    const data = JSON.parse(msg);

    if (data.event === "media" && data.media?.payload) {
      const audioBuffer = Buffer.from(data.media.payload, "base64");
      deepgramLive.send(audioBuffer);
    }

    if (data.event === "stop") {
      console.log("🔴 Samtal avslutat");
      deepgramLive.finish();
    }
  });

  ws.on("close", () => {
    console.log("🔌 WebSocket stängd");
    deepgramLive.finish();
  });
}

module.exports = { startMediaServer };

