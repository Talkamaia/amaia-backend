require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { xml } = require("xmlbuilder2");
const path = require("path");
const OpenAI = require("openai");

const { buildSystemPrompt } = require("./promptManager");
const { synthesize } = require("./eleven");

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/audio", express.static(path.join(__dirname, "public/audio")));

// Initiera OpenAI med nya SDK
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Twilio webhook – inkommande samtal
app.post("/incoming-call", async (req, res) => {
  try {
    console.log("📞 Inkommande samtal!");

    const userInput =
      req.body.SpeechResult ||
      req.body.Body ||
      "";

    const ctx = {
      userInput,
      silenceMs: +req.body.RecordingDuration === 0 ? 10000 : 0,
      aroused: /ah+|mmm+|åh+|kåt|skön|hard/i.test(userInput),
    };

    const systemPrompt = buildSystemPrompt(ctx);

    const gpt = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput || "(tystnad)" }
      ],
      temperature: 0.9,
    });

    const aiReply = gpt.choices[0].message.content.trim();
    console.log("🧠 GPT:", aiReply);

    const filename = `amaia-${Date.now()}.mp3`;
    const audioPath = await synthesize(aiReply, filename);

    const twiml = xml({ version: "1.0" })
      .ele("Response")
        .ele("Play")
        .txt(`https://${req.headers.host}${audioPath}`)
        .up()
      .up()
      .end({ prettyPrint: false });

    res.type("text/xml").send(twiml);
  } catch (err) {
    console.error("❌ Fel i /incoming-call:", err.message);

    const fallback = xml({ version: "1.0" })
      .ele("Response")
        .ele("Say", { voice: "Polly.Swedish", language: "sv-SE" })
        .txt("Tyvärr kunde Amaia inte svara just nu. Försök igen om en stund.")
        .up()
      .up()
      .end();

    res.type("text/xml").send(fallback);
  }
});

app.listen(port, () => {
  console.log(`✅ Amaia backend är live på port ${port}`);
});
