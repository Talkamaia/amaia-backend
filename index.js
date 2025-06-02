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
    // 1. Plocka ut vad kunden sa
    const userInput =
      req.body.SpeechResult ||
      req.body.Body ||
      "";

    // 2. Tolkning av kontext (för promptstyrning)
    const ctx = {
      userInput,
      silenceMs: +req.body.RecordingDuration === 0 ? 10000 : 0,
      aroused: /ah+|mmm+|åh+|kåt|skön|hard/i.test(userInput),
    };

    // 3. Skapa GPT-prompt
    const systemPrompt = buildSystemPrompt(ctx);

    // 4. GPT-anrop
    const gpt = await openai.createChatCompletion({
      model: "gpt-4o", // eller "gpt-3.5-turbo" för billigare/snabbare
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput || "(tystnad

