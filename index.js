// ✅ index.js – Media Stream, GPT och röstmotor
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");
const { synthesize } = require("./eleven");
const { askGPT } = require("./gpt");
const { startMediaServer } = require("./mediaServer");
const http = require("http");

const app = express();
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/audio", express.static("public/audio"));

// 🧪 Test ElevenLabs manuellt
app.get("/test-voice", async (req, res) => {
  const text = "Hej älskling. Jag är Amaia. Viska något till mig så berättar jag en hemlighet.";
  try {
    const url = await synthesize(text, "amaia-test.mp3");
    res.send(`✅ Röstfil skapad: <a href="${url}" target="_blank">${url}</a>`);
  } catch (err) {
    console.error("❌ Fel vid röstgenerering:", err.message);
    res.status(500).send("Något gick fel.");
  }
});

// 📞 Twilio webhook – starta Media Stream
app.post("/incoming-call", (req, res) => {
  const twiml = create({ version: "1.0" })
    .ele("Response")
      .ele("Start")
        .ele("Stream", {
          url: `${req.protocol}://${req.get("host")}/media-stream`
        })
        .up()
      .up()
      .ele("Say", { voice: "Polly.Swedish", language: "sv-SE" })
        .txt("Hej älskling. Jag lyssnar på dig nu. Prata med mig.")
      .up()
    .up()
    .end({ prettyPrint: false });

  res.type("text/xml").send(twiml);
});

// 🔁 Server + WebSocket för Twilio Media Streams
const server = http.createServer(app);
startMediaServer(server);

server.listen(port, () => {
  console.log(`✅ Amaia backend + Media Stream live på port ${port}`);
});
