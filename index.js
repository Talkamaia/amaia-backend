require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { xml } = require("xmlbuilder2");
const path = require("path");
const mongoose = require("mongoose");
const cors = require("cors");
const OpenAI = require("openai");

const { buildSystemPrompt } = require("./promptManager");
const { synthesize } = require("./eleven");
const { createOrFindUser } = require("./helpers/createOrFindUser");
const User = require("./models/User");

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use("/audio", express.static(path.join(__dirname, "public/audio")));

// 🧠 MongoDB-anslutning
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB error:", err));

// ✅ Visa saldo
app.get("/api/saldo", async (req, res) => {
  const phone = req.query.phone;
  if (!phone) return res.status(400).json({ error: "Missing phone number" });

  try {
    const user = await createOrFindUser(phone);
    res.json({ voiceSeconds: user.voiceSeconds });
  } catch (err) {
    res.status(500).json({ error: "Server error" });
  }
});

// 📞 Inkommande samtal via Twilio
app.post("/incoming-call", async (req, res) => {
  try {
    const phone = req.body.From;
    console.log("📞 Inkommande samtal från:", phone);

    const user = await createOrFindUser(phone);

    if (user.voiceSeconds <= 0) {
      // ❌ Inget saldo kvar – avsluta samtal med röstmeddelande
      const noCredit = xml({ version: "1.0" })
        .ele("Response")
          .ele("Say", { voice: "Polly.Swedish", language: "sv-SE" })
          .txt("Din samtalstid är slut, älskling. Besök amaia punkt a i för att fylla på. Jag väntar på dig där.")
          .up()
        .up()
        .end({ prettyPrint: false });

      return res.type("text/xml").send(noCredit);
    }

    const userInput = req.body.SpeechResult || req.body.Body || "";

    const ctx = {
      userInput,
      silenceMs: +req.body.RecordingDuration === 0 ? 10000 : 0,
      aroused: /ah+|mmm+|åh+|kåt|skön|hard/i.test(userInput),
    };

    const systemPrompt = buildSystemPrompt(ctx);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

    // 💸 Dra tid – antag 30 sek per svar (kan göras exakt senare)
    await User.updateOne({ phone }, { $inc: { voiceSeconds: -30 } });

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
