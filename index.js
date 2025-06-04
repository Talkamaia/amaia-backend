require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// 📞 Enkel test – inkommande samtal via Twilio
app.post("/incoming-call", (req, res) => {
  console.log("📞 Inkommande samtal från:", req.body.From);
  console.log("🧪 Fullt request body:", req.body); // EXTRA LOGG

  const twiml = create({ version: "1.0" })
    .ele("Response")
      .ele("Say", { voice: "Polly.Maja", language: "sv-SE" }) // ← Ändrat här
      .txt("Hej älskling. Detta är ett testmeddelande från Amaia. Om du hör detta fungerar samtalskedjan.")
      .up()
    .up()
    .end({ prettyPrint: false });

  res.type("text/xml").send(twiml);
});

// 🚀 Start server
app.listen(port, () => {
  console.log(`✅ Amaia test-backend är live på port ${port}`);
});

