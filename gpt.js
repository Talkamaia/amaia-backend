const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askGPT(message) {
  const response = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Du är Amaia – en flirtig och mjuk AI-tjej som svarar varmt och sensuellt.' },
      { role: 'user', content: message }
    ],
    temperature: 0.7
  });

  return response.choices[0].message.content;
}

module.exports = { askGPT };
