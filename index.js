// ✅ index.js – med direkt placeholder-röst till Twilio, sedan GPT-svar
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");
const { synthesize } = require("./eleven");
const { askGPT } = require("./gpt");
const fs = require("fs");
const path = require("path");

const app = express();
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/audio", express.static("public/audio"));

// 📞 Twilio webhook med placeholder direkt
app.post("/incoming-call", async (req, res) => {
  console.log("📞 Inkommande samtal från:", req.body.From);

  // 1. Skicka direkt placeholder-TwiML till Twilio
  const placeholderTwiml = create({ version: "1.0" })
    .ele("Response")
      .ele("Say", { voice: "Polly.Swedish", language: "sv-SE" })
        .txt("Ett ögonblick...")
      .up()
    .up()
    .end({ prettyPrint: false });

  res.type("text/xml").send(placeholderTwiml);

  // 2. Parallellt: GPT + ElevenLabs röst
  try {
    const userInput = "Hej Amaia, vad gör du just nu?"; // Testinnehåll för nu
    const gptReply = await askGPT(userInput);
    console.log("🤖 GPT-svar:", gptReply);

    const audioPath = await synthesize(gptReply, "gpt-response.mp3");
    console.log("🔊 Ljudfil skapad:", audioPath);

    // Skicka ljudet till Twilio (via Play URL senare)
    // ➜ Antingen via Twilio REST API (CallSid required)
    // ➜ Eller via Media Stream WebSocket
    // Just nu: vi sparar ljudet till static /audio/ map
  } catch (err) {
    console.error("❌ Fel i GPT-kedjan:", err.message);
  }
});

// Testa ElevenLabs
app.get("/test-voice", async (req, res) => {
  const text = "Hej, detta är ett test från Amaia.";
  try {
    const url = await synthesize(text, "test.mp3");
    res.send(`<a href="${url}" target="_blank">Spela upp testlåten</a>`);
  } catch (e) {
    res.status(500).send("Fel vid röstgenerering");
  }
});

app.listen(port, () => {
  console.log(`✅ Amaia backend + placeholder svar live på port ${port}`);
});
