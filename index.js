require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");
const { getGPTResponse } = require("./promptManager");
const { generateSpeech } = require("./eleven");

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/incoming-call", async (req, res) => {
  const from = req.body.From;
  console.log("📞 Inkommande samtal från:", from);

  // 1. Första GPT-svar
  const gptReply = await getGPTResponse("En person ringer in, säg något varmt och sexigt.");
  console.log("🤖 GPT-svar:", gptReply);

  // 2. Generera ElevenLabs-ljud
  const audioUrl = await generateSpeech(gptReply);
  console.log("🔊 Ljudfil från ElevenLabs:", audioUrl);

  // 3. Skicka TwiML med ljudet till Twilio
  const twiml = create({ version: "1.0" })
    .ele("Response")
      .ele("Play")
        .txt(audioUrl)
      .up()
    .up()
    .end({ prettyPrint: false });

  res.type("text/xml").send(twiml);
});

app.listen(port, () => {
  console.log(`✅ Amaia-backend live på port ${port}`);
});
