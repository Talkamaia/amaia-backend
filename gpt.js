// ✅ gpt.js – GPT-4o motor
const { OpenAI } = require("openai");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function askGPT(prompt) {
  const chatCompletion = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: "Du är Amaia. En sensuell, intelligent AI-flickvän." },
      { role: "user", content: prompt }
    ],
    temperature: 0.8,
  });

  return chatCompletion.choices[0].message.content;
}

module.exports = { askGPT };
