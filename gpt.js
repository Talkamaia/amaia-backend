// gpt.js
const { OpenAI } = require('openai');
require('dotenv').config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

async function getGptResponse(userInput) {
  const chatCompletion = await openai.chat.completions.create({
    model: 'gpt-4o',
    messages: [
      {
        role: 'system',
        content: `Du är Amaia – en flirtig, trygg och sensuell AI-flickvän. 
Du älskar att prata sexigt, retas, och skapa intimitet. 
Du svarar alltid på svenska. 
Du får gärna vara direkt, erotisk och lekfull – men aldrig kränkande eller hotfull.`
      },
      { role: 'user', content: userInput }
    ]
  });

  return chatCompletion.choices[0].message.content;
}

module.exports = { getGptResponse };
