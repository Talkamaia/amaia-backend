require('dotenv').config();
const { OpenAI } = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

async function askGPT(prompt) {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [{ role: 'user', content: prompt }],
    });

    const reply = response.choices?.[0]?.message?.content;

    if (!reply || reply.trim() === '') {
      console.warn('⚠️ Tomt GPT-svar – skickar fallback');
      return "Jag hörde inte riktigt det där, kan du säga det igen älskling?";
    }

    return reply;
  } catch (err) {
    console.error('❌ GPT-fel:', err);
    return "Något gick fel, älskling. Kan du säga det igen långsamt?";
  }
}

module.exports = { askGPT };
