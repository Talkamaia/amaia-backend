// ✅ index.js – Twilio Media Streams med WebSocket
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");
const http = require("http");
const { startMediaServer } = require("./mediaServer");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 10000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/audio", express.static("public/audio"));

// 📞 Twilio Media Stream webhook
app.post("/incoming-call", (req, res) => {
  console.log("📞 Inkommande samtal från:", req.body.From);

  const twiml = create({ version: "1.0" })
    .ele("Response")
      .ele("Start")
        .ele("Stream", {
          url: `wss://${req.get("host")}/media`,
        })
        .up()
      .up()
    .up()
    .end({ prettyPrint: false });

  res.type("text/xml").send(twiml);
});

// 🚀 Starta HTTP + WebSocket
server.listen(port, () => {
  console.log(`✅ Amaia backend + Media Stream live på port ${port}`);
});

// 🎧 Starta WebSocket-servern
startMediaServer(server);
