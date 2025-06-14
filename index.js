// index.js – huvudfil för Amaia-backend
const express = require("express");
const bodyParser = require("body-parser");
const { startMediaServer } = require("./mediaServer");
const http = require("http");
const WebSocket = require("ws");
require("dotenv").config();

const app = express();
const server = http.createServer(app);

// WebSocket-server för Twilio Media Streams
const wss = new WebSocket.Server({ server });
wss.on("connection", (ws) => {
  console.log("🟢 WebSocket ansluten från Twilio");
  startMediaServer(ws);
});

// Middleware
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Webhook för Twilio inkommande samtal
app.post("/incoming-call", (req, res) => {
  console.log("📞 Inkommande samtal – skickar TwiML...");

  const twiml = `
    <Response>
      <Start>
        <Stream url="wss://amaia-backend-3w9f.onrender.com" />
      </Start>
      <Say>Hej älskling... Ett ögonblick, jag lyssnar på dig nu.</Say>
    </Response>
  `;

  res.type("text/xml");
  res.send(twiml);
});

// Starta server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`🚀 Servern kör på port ${PORT}`);
});

