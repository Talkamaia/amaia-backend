// ✅ gpt.js – kompatibel med openai@4.x
require("dotenv").config();
const OpenAI = require("openai").default;    // v4-SDK

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askGPT(userText) {
  const resp = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Du är Amaia – en flirtig, lyssnande AI-flickvän. Svara sensuellt, varmt och lite busigt." },
      { role: "user",   content: userText }
    ],
    temperature: 0.8,
    max_tokens: 150
  });

  return resp.choices[0].message.content.trim();
}

module.exports = askGPT;
