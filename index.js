require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { xml } = require("xmlbuilder2");
const path = require("path");

const { Configuration, OpenAIApi } = require("openai");
const { buildSystemPrompt } = require("./promptManager");
const { synthesize } = require("./eleven");

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/audio", express.static(path.join(__dirname, "public/audio")));

// Initiera OpenAI
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

// Twilio webhook – inkommande samtal
app.post("/incoming-call", async (req, res) => {
  try {
    console.log("📞 Inkommande samtal från Twilio");

    // 1. Hämta vad kunden sa (eller lämna tomt vid tystnad)
    const userInput =
      req.body.SpeechResult ||
      req.body.Body ||
      "";

    // 2. Kontextanalys
    const ctx = {
      userInput,
      silenceMs: +req.body.RecordingDuration === 0 ? 10000 : 0,
      aroused: /ah+|mmm+|åh+|kåt|skön|hard/i.test(userInput),
    };

    // 3. Bygg system-prompt
    const systemPrompt = buildSystemPrompt(ctx);

    // 4. GPT-anrop
    const gpt = await openai.createChatCompletion({
      model: "gpt-4o",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput || "(tystnad)" }
      ],
      temperature: 0.9,
    });

    const aiReply = gpt.data.choices[0].message.content.trim();
    console.log("🧠 GPT-svar:", aiReply);

    // 5. Generera ljud med ElevenLabs
    const filename = `amaia-${Date.now()}.mp3`;
    const audioPath = await synthesize(aiReply, filename);

    // 6. Skicka tillbaka TwiML med röstuppspelning
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
        .txt("Tyvärr, Amaia kunde inte svara just nu. Försök igen om en liten stund.")
        .up()
      .up()
      .end();

    res.type("text/xml").send(fallback);
  }
});

// Starta server
app.listen(port, () =>
  console.log(`✅ Amaia-backend är live på port ${port}`)
);
