const { Deepgram } = require("@deepgram/sdk");
const askGPT = require("./gpt");
const synthesize = require("./eleven");
require("dotenv").config();

const deepgram = new Deepgram({ apiKey: process.env.DEEPGRAM_API_KEY });

function startMediaServer(ws) {
  console.log("🎧 Media Server kör");

  const deepgramLive = deepgram.listen.live({
    model: "nova-2",
    language: "sv",
    encoding: "mulaw",
    sample_rate: 8000,
    smart_format: true,
    interim_results: false,
  });

  deepgramLive.on("transcriptReceived", async (data) => {
    const transcript = data.channel.alternatives[0]?.transcript;
    if (transcript && transcript.length > 1) {
      console.log("🗣 Användaren sa:", transcript);
      const gptResponse = await askGPT(transcript);
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

  deepgramLive.on("error", (err) => console.error("❌ Deepgram-fel:", err.message));

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
