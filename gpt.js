// gpt.js

const { OpenAI } = require('openai');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getGptResponse(userInput) {
  const chatCompletion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      { role: 'system', content: 'Du är Amaia – en flirtig, trygg och sensuell AI-flickvän. Svara på svenska.' },
      { role: 'user', content: userInput }
    ]
  });

  return chatCompletion.choices[0].message.content;
}

module.exports = { getGptResponse };
