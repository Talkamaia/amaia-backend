const express = require("express");
const bodyParser = require("body-parser");
const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.urlencoded({ extended: false }));

app.post("/incoming-call", (req, res) => {
  const response = `
    <Response>
      <Say voice="Polly.Swedish" language="sv-SE">
        Hej, det här är Amaia. Jag väntar på ditt samtal.
      </Say>
    </Response>
  `;
  res.type("text/xml");
  res.send(response);
});

app.listen(port, () => {
  console.log(`Amaia-backend lyssnar på port ${port}`);
});
