// mediaServer.js – kompatibel med Deepgram SDK v3.13
require("dotenv").config();
const WebSocket = require("ws");

// ✅ V3-import & init (ingen new, inget options-objekt)
const { createClient } = require("@deepgram/sdk");
const deepgram = createClient(process.env.DEEPGRAM_API_KEY);

const twilio = require("twilio")(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const askGPT = require("./gpt");
const synth  = require("./eleven");

function startMediaServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("🟢 Twilio Media Stream ansluten");

    // ✅ V3-stream: listen.live
    const dgLive = deepgram.listen.live({
      model:        "nova-2",
      language:     "sv",
      encoding:     "mulaw",
      sample_rate:  8000,
      interim_results: false,
      smart_format:    true
    });

    /* ---------- WS events ---------- */
    ws.on("message", (msg) => {
      const data = JSON.parse(msg);

      if (data.event === "start") {
        ws.callSid = data.start.callSid;           // spara callSid
        return;
      }

      if (data.event === "media" && data.media?.payload) {
        dgLive.write(Buffer.from(data.media.payload, "base64"));
      }

      if (data.event === "stop") dgLive.end();
    });

    ws.on("close", () => dgLive.end());

    /* ---------- Deepgram → GPT → ElevenLabs → Twilio ---------- */
    dgLive.on("transcriptReceived", async (dgMsg) => {
      const text = dgMsg.channel.alternatives[0]?.transcript?.trim();
      if (!text) return;

      console.log("🗣 Användaren sa:", text);

      try {
        const reply = await askGPT(text);
        console.log("🤖 GPT svarar:", reply);

        const filename = await synth(reply);
        const playUrl  = `${process.env.PUBLIC_DOMAIN}/audio/${filename}`;

        await twilio
          .calls(ws.callSid)
          .update({ twiml: `<Response><Play>${playUrl}</Play></Response>` });

        console.log("📤 TwiML uppdaterad");
      } catch (err) {
        console.error("❌ Fel i pipeline:", err.message);
      }
    });

    dgLive.on("error", (e) => console.error("❌ Deepgram:", e.message));
  });

  console.log("🎧 MediaServer kör (DG v3.13)");
}

module.exports = { startMediaServer };
