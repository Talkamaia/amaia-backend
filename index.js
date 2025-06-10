require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");
const { synthesize } = require("./eleven");

const app = express();
const port = process.env.PORT; // ⚠️ Måste vara exakt så här på Render

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Gör statiska ljudfiler tillgängliga från public/audio/
app.use("/audio", express.static("public/audio"));

// 🧪 TEST: ElevenLabs fungerar?
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

// 📞 Twilio webhook (kan byggas ut med GPT sen)
app.post("/incoming-call", (req, res) => {
  console.log("📞 Inkommande samtal från:", req.body.From);

  const twiml = create({ version: "1.0" })
    .ele("Response")
      .ele("Say", { voice: "Polly.Swedish", language: "sv-SE" })
        .txt("Hej älskling. Detta är ett testmeddelande från Amaia. Om du hör detta fungerar samtalskedjan.")
      .up()
    .up()
    .end({ prettyPrint: false });

  res.type("text/xml").send(twiml);
});

// 🚀 Starta server
app.listen(port, () => {
  console.log(`✅ Amaia backend är live på port ${port}`);
});
