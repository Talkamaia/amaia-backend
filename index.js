// index.js – Twilio Media Streams med WebSocket
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");
const http = require("http");
const { startMediaServer } = require("./mediaServer");

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 10000;

/* 🔍  Tillfällig logg: visar varje inkommande HTTP-request */
app.use((req, _res, next) => {
  console.log("↘️  Received", req.method, req.originalUrl);
  next();
});

/* 📁 Ljudfiler + JSON-body */
app.use("/audio", express.static("public/audio"));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/* 📞 Inkommande samtal från Twilio → starta media stream */
app.post("/incoming-call", (req, res) => {
  console.log("📞 Inkommande samtal från:", req.body.From);

  const twiml = create({ version: "1.0" })
    .ele("Response")
      .ele("Say").txt("Ge mig bara en sekund, älskling...").up()
      .ele("Pause", { length: 1 }).up()
      .ele("Start")
        .ele("Stream", {
          url: "wss://amaia-backend-1.onrender.com/media",
          track: "inbound_audio"
        }).up()
      .up()
    .up()
    .end({ prettyPrint: false });

  res.type("text/xml").send(twiml);
});

/* 🛰️  Starta servern */
server.listen(port, () => {
  console.log(`✅ Amaia backend live på port ${port}`);
});
startMediaServer(server);
