// ✅ mediaServer.js – WebSocket-server för Twilio Media Streams
const WebSocket = require("ws");

function startMediaServer(server) {
  const wss = new WebSocket.Server({ server });

  wss.on("connection", (ws) => {
    console.log("🟢 Twilio Media Stream ansluten");

    ws.on("message", (msg) => {
      try {
        const data = JSON.parse(msg);

        if (data.event === "media") {
          const audio = data.media.payload; // base64-encoded μ-law audio
          // TODO: Skicka till transkribering i nästa steg
        }

      } catch (err) {
        console.error("❌ Fel i MediaStream:", err.message);
      }
    });

    ws.on("close", () => {
      console.log("🔴 Twilio Media Stream avslutad");
    });
  });

  console.log("🎧 Media Server kör");
}

module.exports = { startMediaServer };
