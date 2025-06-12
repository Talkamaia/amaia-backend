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

app.post("/incoming-call", async (req, res) => {
  console.log("📞 Inkommande samtal från:", req.body.From);

  const userInput = "Hej Amaia, vad gör du just nu?";

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
