/* index.js  –  Amaia backend 100 % stand-alone */

require("dotenv").config();             // Läser .env lokalt (ignoreras på Render)
const express       = require("express");
const bodyParser    = require("body-parser");
const { xml }       = require("xmlbuilder2");   // Liten hjälpare för TwiML
const { Configuration, OpenAIApi } = require("openai");
const { buildSystemPrompt } = require("./promptManager");

const app  = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

/* --- initiera OpenAI --- */
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

/* --- Twilio webhook --- */
app.post("/incoming-call", async (req, res) => {
  try {
    /* 1. Plocka ut kundens text  */
    const userInput =
      req.body.SpeechResult ||          // Tal‐igenkänning från Twilio
      req.body.Body          ||         // SMS fallback (om man använder sms)
      "";                               // tomt om tystnad

    /* 2. Bygg kontext  */
    const ctx = {
      userInput,
      silenceMs: +req.body.RecordingDuration === 0 ? 10000 : 0, // grov tystnadscheck
      aroused: /ah+|mmm+|åh+|kåt|skön|hard/i.test(userInput),
    };

    /* 3. Skapa system-prompt  */
    const systemPrompt = buildSystemPrompt(ctx);

    /* 4. GPT-anrop  */
    const gpt = await openai.createChatCompletion({
      model: "gpt-4o-mini",          // byt till "gpt-3.5-turbo" om du vill
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user",   content: userInput || "(tystnad)" }
      ],
      temperature: 0.9,
    });

    const aiReply = gpt.data.choices[0].message.content.trim();

    /* 5. Bygg TwiML-svar  */
    const twiml = xml({ version: "1.0" })
      .ele("Response")
        .ele("Say", { voice: "Polly.Swedish", language: "sv-SE" })
        .txt(aiReply)
        .up()
      .up()
      .end({ prettyPrint: false });

    res.type("text/xml").send(twiml);
  } catch (err) {
    console.error("Error:", err.message);
    // Felsäker fallback så samtalet inte dör
    const fallback = xml({ version: "1.0" })
      .ele("Response")
        .ele("Say", { voice: "Polly.Swedish", language: "sv-SE" })
        .txt("Tyvärr, något gick fel just nu. Ring gärna igen om en stund.")
        .up()
      .up()
      .end();
    res.type("text/xml").send(fallback);
  }
});

/* --- start server --- */
app.listen(port, () =>
  console.log(`Amaia-backend live på port ${port}`)
);
