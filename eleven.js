// ✅ eleven.js – Röstgenerering med optimerad svensk röst
const axios = require("axios");
const fs = require("fs");
const path = require("path");

const apiKey = process.env.ELEVEN_API_KEY;
const voiceId = process.env.ELEVEN_VOICE_ID;

async function synthesize(text, filename = "output.mp3") {
  const url = `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

  const response = await axios.post(
    url,
    {
      text,
      model_id: "eleven_multilingual_v2", // 🔥 Nyare modell med bättre svenska
      voice_settings: {
        stability: 0.4,            // Mer variation i röstton
        similarity_boost: 0.9     // Låter mer som originalrösten
      },
    },
    {
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
      },
      responseType: "stream",
    }
  );

  const filePath = path.join(__dirname, "public", "audio", filename);
  await new Promise((resolve, reject) => {
    const writer = fs.createWriteStream(filePath);
    response.data.pipe(writer);
    writer.on("finish", resolve);
    writer.on("error", reject);
  });

  return `/audio/${filename}`;
}

module.exports = { synthesize };

// ✅ index.js – Startpunkt för Twilio + GPT-4o + ElevenLabs
require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");
const { synthesize } = require("./eleven");
const { askGPT } = require("./gpt");

const app = express();
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/audio", express.static("public/audio"));

// 🧪 Test ElevenLabs
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

// 📞 Twilio webhook med GPT-svar
app.post("/incoming-call", async (req, res) => {
  console.log("📞 Inkommande samtal från:", req.body.From);

  const userInput = "Hej Amaia, vad gör du just nu?"; // 👈 Här lägger vi in riktig input senare

  try {
    const gptReply = await askGPT(userInput);
    console.log("🤖 GPT-svar:", gptReply);

    const audioUrl = await synthesize(gptReply, "gpt-response.mp3");
    console.log("🔊 Ljudfil:", audioUrl);

    const twiml = create({ version: "1.0" })
      .ele("Response")
        .ele("Play")
          .txt(`${req.protocol}://${req.get("host")}${audioUrl}`)
        .up()
      .up()
      .end({ prettyPrint: false });

    res.type("text/xml").send(twiml);
  } catch (err) {
    console.error("❌ Fel i GPT-kedjan:", err.message);
    res.status(500).send("Något gick fel.");
  }
});

app.listen(port, () => {
  console.log(`✅ Amaia backend är live på port ${port}`);
});

// ✅ gpt.js – GPT-4o motor
const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function askGPT(prompt) {
  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Du är Amaia. En sensuell, intelligent AI-flickvän." },
      { role: "user", content: prompt }
    ],
    temperature: 0.8, // Lite mer kreativitet
  });

  return chatCompletion.choices[0].message.content;
}

module.exports = { askGPT };
