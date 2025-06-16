// ✅ index.js – Twilio Media Streams + WebSocket server
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");
const http = require("http");
const path = require("path");

const { startMediaServer } = require("./mediaServer");

const app  = express();
const port = process.env.PORT || 10000;

/* ---------- STATIC & BODY ---------- */
app.use("/audio", express.static(path.join(__dirname, "public/audio")));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/* ---------- INCOMING VOICE CALL ---------- */
app.post("/incoming-call", (req, res) => {
  console.log("📞 Inkommande samtal från:", req.body.From);

  // WSS-URL = PUBLIC_DOMAIN men med wss://-schema
  const streamUrl = `${process.env.PUBLIC_DOMAIN.replace(/^https?/, "wss")}/media`;

  const twiml = create({ version: "1.0" })
    .ele("Response")
      .ele("Say").txt("Ge mig bara en sekund, älskling...").up()
      .ele("Pause", { length: 1 }).up()
      .ele("Start")
        .ele("Stream", { url: streamUrl, track: "inbound_audio" }).up()
      .up()
    .up()
    .end({ prettyPrint: false });

  res.type("text/xml").send(twiml);
});

/* ---------- BOOT ---------- */
const server = http.createServer(app);
server.listen(port, () => {
  console.log(`✅ Amaia backend live på port ${port}`);
});
startMediaServer(server);
