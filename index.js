const express = require("express");
const bodyParser = require("body-parser");
const http = require("http");
const WebSocket = require("ws");
const path = require("path");
const { startMediaServer } = require("./mediaServer");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// WebSocket-server
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
  console.log("🟢 WebSocket ansluten från Twilio Media Stream");
  startMediaServer(ws);
});

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/audio", express.static(path.join(__dirname, "audio")));

app.post("/incoming-call", (req, res) => {
  console.log("📞 Inkommande samtal – skickar TwiML");

  const twiml = `
    <Response>
      <Start>
        <Stream url="wss://amaia-backend-3w9f.onrender.com" />
      </Start>
      <Say>Hej älskling... ett ögonblick, jag lyssnar på dig nu.</Say>
    </Response>
  `;

  res.type("text/xml");
  res.send(twiml);
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log(`✅ Amaia backend + Media Stream live på port ${PORT}`);
});
