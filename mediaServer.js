// ✅ mediaServer.js – WebSocket-server för Twilio Media Streams
const WebSocket = require("ws");
const fs = require("fs");
const { askGPT } = require("./gpt");
const { synthesize } = require("./eleven");
const { v4: uuidv4 } = require("uuid");

// Simulerad transkribering (ersätt med Whisper senare)
function fakeTranscribe(base64audio) {
  return "Hej Amaia, vad tänker du på?";
}

function startMediaServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("🟢 Twilio Media Stream ansluten");

    let buffer = [];

    ws.on("message", async (msg) => {
      try {
        const data = JSON.parse(msg);

        if (data.event === "start") {
          console.log("🔄 Startar Media Stream-session");
        }

        if (data.event === "media") {
          buffer.push(data.media.payload); // base64-ljud
        }

        if (data.event === "stop") {
          console.log("🛑 Media stream avslutad – bearbetar...");

          // 👉 Kombinera all inkommande ljud (simulerat)
          const userInput = fakeTranscribe(buffer.join(""));

          console.log("🗣 Användaren sa:", userInput);

          const gptReply = await askGPT(userInput);
          console.log("🤖 GPT svarar:", gptReply);

          const filename = `stream-${uuidv4()}.mp3`;
          const url = await synthesize(gptReply, filename);

          // 👇 Spela upp direkt i samtalet via Twilio <Play>
          const twiml = `
            <Response>
              <Play>https://${process.env.RENDER_EXTERNAL_HOSTNAME}/audio/${filename}</Play>
            </Response>
          `;
          ws.send(JSON.stringify({ event: "sendTwiml", twiml }));

        }

      } catch (err) {
        console.error("❌ Fel i MediaStream:", err.message);
      }
    });

    ws.on("close", () => {
      console.log("🔴 Media Stream koppling stängd");
    });
  });

  console.log("🎧 Media Server kör");
}

module.exports = { startMediaServer };

