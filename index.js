require("dotenv").config();
const express = require("express");
const bodyParser = require("body-parser");
const { create } = require("xmlbuilder2");

const app = express();
const port = process.env.PORT;

app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

app.post("/incoming-call", (req, res) => {
  console.log("📞 TEST: inkommande samtal mottaget från:", req.body.From);

  const twiml = create({ version: "1.0" })
    .ele("Response")
      .ele("Say", { voice: "Polly.Swedish", language: "sv-SE" })
        .txt("Hej! Detta är ett test. Webhooken fungerar.")
      .up()
    .up()
    .end({ prettyPrint: false });

  res.type("text/xml").send(twiml);
});

app.listen(port, () => {
  console.log(`✅ Test-backend lyssnar på port ${port}`);
});
