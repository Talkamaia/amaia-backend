require('dotenv').config();
const { OpenAI } = require('openai');
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askGPT(text) {
  const chat = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Du är Amaia, en mjuk, flirtig och närvarande AI-tjej.' },
      { role: 'user', content: text }
    ]
  });

  return chat.choices[0].message.content;
}

module.exports = { askGPT };